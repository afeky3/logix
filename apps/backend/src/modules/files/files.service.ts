import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { KybService } from '../organizations/kyb.service';

const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export interface UploadInput {
  userId: string;
  organizationId: string;
  purpose: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface UploadAvatarInput {
  userId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Files are stored directly on this server's disk — not S3 (no bucket set
 * up yet, T-skip deliberate per product call: "لسه هنستخدم S3"). The
 * storage directory lives outside any Nginx web root and is never served
 * statically; the only way to read a file's bytes is this module's
 * `download()`, which re-checks the caller is the uploader or an active
 * member of the owning organization on every request. No ClamAV scanning —
 * dropped by explicit product decision (not a gap to fill later), given
 * access is already locked down to the uploader/org members. Uploads land
 * as `scan_status: PENDING` and stay there; nothing flips it to `CLEAN`.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly kyb: KybService,
    private readonly jwt: JwtService,
  ) {}

  private get storageDir(): string {
    return resolve(this.config.get<string>('FILES_STORAGE_DIR', '/home/ubuntu/logix/storage/files'));
  }

  private async requireMembership(organizationId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  async upload(input: UploadInput) {
    await this.requireMembership(input.organizationId, input.userId);

    const ext = ALLOWED_MIME[input.mimeType];
    if (!ext) {
      throw new AppError('VALIDATION_FAILED', `Unsupported file type: ${input.mimeType}`, {
        details: [{ field: 'file', code: 'unsupported_mime_type' }],
      });
    }

    const id = randomUUID();
    const storageKey = `${input.organizationId}/${id}${ext}`;
    const absPath = this.resolveSafePath(storageKey);

    await mkdir(join(this.storageDir, input.organizationId), { recursive: true, mode: 0o700 });
    await writeFile(absPath, input.buffer, { mode: 0o600 });

    const sha256 = createHash('sha256').update(input.buffer).digest();

    const file = await this.prisma.files.create({
      data: {
        id,
        bucket: 'local-disk',
        storage_key: storageKey,
        purpose: input.purpose as never,
        mime_type: input.mimeType,
        size_bytes: BigInt(input.buffer.length),
        sha256,
        original_name: input.filename,
        organization_id: input.organizationId,
        uploaded_by_user_id: input.userId,
        upload_completed_at: new Date(),
        scan_status: 'PENDING',
      },
    });

    // Verification evidence goes straight to the admin queue (not on submit).
    if (input.purpose === 'DOCUMENT') {
      await this.kyb.queueVerificationItem(input.organizationId, 'DOCUMENT', file.id);
    }

    return {
      id: file.id,
      purpose: file.purpose,
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes),
      originalName: file.original_name,
      scanStatus: file.scan_status,
      createdAt: file.created_at,
    };
  }

  /** Throws unless `userId` may read this (non-public) file. */
  private async assertCanRead(
    file: { id: string; purpose: string; uploaded_by_user_id: string | null; organization_id: string | null },
    userId: string,
  ) {
    // Avatars, logos and product images are accessible to any authenticated user
    if (file.purpose === 'AVATAR' || file.purpose === 'PRODUCT_IMAGE') return;
    if (file.uploaded_by_user_id === userId) return;

    // Chat attachments: allow any conversation participant to download
    if (file.purpose === 'CHAT_ATTACHMENT') {
      const msg = await this.prisma.$queryRaw<[{ conversation_id: string }?]>`
        SELECT conversation_id FROM msg.messages
        WHERE ${file.id}::uuid = ANY(attachment_file_ids)
        LIMIT 1
      `;
      const convId = msg[0]?.conversation_id;
      if (!convId) throw new AppError('FORBIDDEN', 'Not permitted to view this file');
      const memberships = await this.prisma.memberships.findMany({
        where: { user_id: userId, status: 'ACTIVE' },
        select: { organization_id: true },
      });
      const orgIds = memberships.map((m) => m.organization_id);
      const participant = await this.prisma.conversation_participants.findFirst({
        where: { conversation_id: convId, organization_id: { in: orgIds }, left_at: null },
      });
      if (!participant) throw new AppError('FORBIDDEN', 'Not permitted to view this file');
      return;
    }

    // Shipment documents: both parties of the order they were attached to
    if (file.purpose === 'SHIPMENT_DOCUMENT') {
      const rows = await this.prisma.$queryRaw<{ customer_org_id: string; provider_org_id: string }[]>`
        SELECT o.customer_org_id, o.provider_org_id
        FROM svc.order_milestones m JOIN svc.orders o ON o.id = m.order_id
        WHERE ${file.id}::uuid = ANY(m.evidence_file_ids)
        UNION ALL
        SELECT o.customer_org_id, o.provider_org_id
        FROM transport.trip_events t JOIN svc.orders o ON o.id = t.order_id
        WHERE ${file.id}::uuid = ANY(t.document_file_ids)
        LIMIT 1
      `;
      const parties = rows[0];
      if (parties) {
        const membership = await this.prisma.memberships.findFirst({
          where: {
            user_id: userId,
            status: 'ACTIVE',
            organization_id: { in: [parties.customer_org_id, parties.provider_org_id] },
          },
        });
        if (membership) return;
      }
    }

    if (!file.organization_id) throw new AppError('FORBIDDEN', 'Not permitted to view this file');
    await this.requireMembership(file.organization_id, userId);
  }

  /** Returns the file's bytes plus the metadata needed for response headers,
   * after confirming `userId` is allowed to see it. Never resolves a path
   * outside `storageDir`, even if `storage_key` were ever corrupted. */
  async download(fileId: string, userId: string) {
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at) throw new AppError('NOT_FOUND', 'File not found');
    await this.assertCanRead(file, userId);
    return this.readFile(file);
  }

  private async readFile(file: { id: string; storage_key: string; mime_type: string; original_name: string | null }) {
    const absPath = this.resolveSafePath(file.storage_key);
    const buffer = await this.readStored(absPath);
    return {
      buffer,
      mimeType: file.mime_type,
      originalName: file.original_name ?? `${file.id}`,
    };
  }

  /**
   * A short-lived link the app can open in the browser (an authenticated
   * download can't be a plain URL). Access is checked now; the token only
   * proves it was, for this file, within the last minute and a half.
   */
  async createDownloadLink(fileId: string, userId: string) {
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at) throw new AppError('NOT_FOUND', 'File not found');
    await this.assertCanRead(file, userId);
    const token = await this.jwt.signAsync(
      { fid: fileId },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), audience: 'file-download', subject: userId, expiresIn: 90 },
    );
    return { path: `files/${fileId}/content?t=${token}`, expiresInSeconds: 90 };
  }

  async downloadWithToken(fileId: string, token: string | undefined) {
    let payload: { fid?: string };
    try {
      payload = await this.jwt.verifyAsync(token ?? '', {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        audience: 'file-download',
      });
    } catch {
      throw new AppError('FORBIDDEN', 'This download link is invalid or has expired');
    }
    if (payload.fid !== fileId) throw new AppError('FORBIDDEN', 'This download link is invalid or has expired');
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at) throw new AppError('NOT_FOUND', 'File not found');
    return this.readFile(file);
  }

  /** Upload a user avatar — no org required; stored under user's own folder. */
  async uploadAvatar(input: UploadAvatarInput) {
    const AVATAR_MIME: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const ext = AVATAR_MIME[input.mimeType];
    if (!ext) throw new AppError('VALIDATION_FAILED', 'Only JPEG, PNG or WebP allowed for avatars');

    const id = randomUUID();
    const storageKey = `avatars/${input.userId}/${id}${ext}`;
    const absPath = this.resolveSafePath(storageKey);
    await mkdir(join(this.storageDir, 'avatars', input.userId), { recursive: true, mode: 0o700 });
    await writeFile(absPath, input.buffer, { mode: 0o600 });
    const sha256 = createHash('sha256').update(input.buffer).digest();

    const file = await this.prisma.files.create({
      data: {
        id,
        bucket: 'local-disk',
        storage_key: storageKey,
        purpose: 'AVATAR',
        mime_type: input.mimeType,
        size_bytes: BigInt(input.buffer.length),
        sha256,
        original_name: input.filename,
        uploaded_by_user_id: input.userId,
        upload_completed_at: new Date(),
        scan_status: 'PENDING',
      },
    });

    await this.prisma.users.update({ where: { id: input.userId }, data: { avatar_file_id: id } });
    return { id: file.id };
  }

  /** Upload an org logo — requires OWNER or MANAGER membership. */
  async uploadOrgLogo(input: UploadInput) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: input.userId, organization_id: input.organizationId } },
    });
    if (!membership || membership.status !== 'ACTIVE' || !['OWNER', 'MANAGER'].includes(membership.role))
      throw new AppError('FORBIDDEN', 'Only owners or managers can update the org logo');

    const LOGO_MIME: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    const ext = LOGO_MIME[input.mimeType];
    if (!ext) throw new AppError('VALIDATION_FAILED', 'Only JPEG, PNG or WebP allowed for logos');

    const id = randomUUID();
    const storageKey = `logos/${input.organizationId}/${id}${ext}`;
    const absPath = this.resolveSafePath(storageKey);
    await mkdir(join(this.storageDir, 'logos', input.organizationId), { recursive: true, mode: 0o700 });
    await writeFile(absPath, input.buffer, { mode: 0o600 });
    const sha256 = createHash('sha256').update(input.buffer).digest();

    const file = await this.prisma.files.create({
      data: {
        id,
        bucket: 'local-disk',
        storage_key: storageKey,
        purpose: 'AVATAR',
        mime_type: input.mimeType,
        size_bytes: BigInt(input.buffer.length),
        sha256,
        original_name: input.filename,
        organization_id: input.organizationId,
        uploaded_by_user_id: input.userId,
        upload_completed_at: new Date(),
        scan_status: 'PENDING',
      },
    });

    await this.prisma.organizations.update({ where: { id: input.organizationId }, data: { logo_file_id: id } });
    return { id: file.id };
  }

  /** Public download for avatars/logos — no auth required, AVATAR purpose only. */
  async downloadAvatar(fileId: string) {
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at || file.purpose !== 'AVATAR') {
      throw new AppError('NOT_FOUND', 'Avatar not found');
    }
    const absPath = this.resolveSafePath(file.storage_key);
    const buffer = await this.readStored(absPath);
    return { buffer, mimeType: file.mime_type };
  }

  /** Staff review access — no membership check, any file. Stopgap until
   * admin-kyb gets proper case-assignment scoping. */
  async downloadAsStaff(fileId: string) {
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at) throw new AppError('NOT_FOUND', 'File not found');
    const absPath = this.resolveSafePath(file.storage_key);
    const buffer = await this.readStored(absPath);
    return { buffer, mimeType: file.mime_type, originalName: file.original_name ?? `${file.id}` };
  }

  /** A row can outlive its bytes (a wiped storage dir); that is "gone", not a server error. */
  private async readStored(absPath: string): Promise<Buffer> {
    try {
      return await readFile(absPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new AppError('NOT_FOUND', 'The file is no longer available');
      }
      throw err;
    }
  }

  private resolveSafePath(storageKey: string): string {
    const abs = resolve(join(this.storageDir, storageKey));
    if (!abs.startsWith(this.storageDir + sep) && abs !== this.storageDir) {
      throw new AppError('VALIDATION_FAILED', 'Invalid storage key');
    }
    return abs;
  }
}
