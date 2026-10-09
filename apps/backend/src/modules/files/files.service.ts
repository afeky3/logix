import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  /** Returns the file's bytes plus the metadata needed for response headers,
   * after confirming `userId` is allowed to see it. Never resolves a path
   * outside `storageDir`, even if `storage_key` were ever corrupted. */
  async download(fileId: string, userId: string) {
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at) throw new AppError('NOT_FOUND', 'File not found');

    // Avatars and logos are accessible to any authenticated user
    if (file.purpose !== 'AVATAR') {
      const isUploader = file.uploaded_by_user_id === userId;
      if (!isUploader) {
        if (!file.organization_id) throw new AppError('FORBIDDEN', 'Not permitted to view this file');
        await this.requireMembership(file.organization_id, userId);
      }
    }

    const absPath = this.resolveSafePath(file.storage_key);
    const buffer = await readFile(absPath);
    return {
      buffer,
      mimeType: file.mime_type,
      originalName: file.original_name ?? `${file.id}`,
    };
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

  /** Staff review access — no membership check, any file. Stopgap until
   * admin-kyb gets proper case-assignment scoping. */
  async downloadAsStaff(fileId: string) {
    const file = await this.prisma.files.findUnique({ where: { id: fileId } });
    if (!file || file.deleted_at) throw new AppError('NOT_FOUND', 'File not found');
    const absPath = this.resolveSafePath(file.storage_key);
    const buffer = await readFile(absPath);
    return { buffer, mimeType: file.mime_type, originalName: file.original_name ?? `${file.id}` };
  }

  private resolveSafePath(storageKey: string): string {
    const abs = resolve(join(this.storageDir, storageKey));
    if (!abs.startsWith(this.storageDir + sep) && abs !== this.storageDir) {
      throw new AppError('VALIDATION_FAILED', 'Invalid storage key');
    }
    return abs;
  }
}
