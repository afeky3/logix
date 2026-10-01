import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

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

/**
 * Files are stored directly on this server's disk — not S3 (no bucket set
 * up yet, T-skip deliberate per product call: "لسه هنستخدم S3"). The
 * storage directory lives outside any Nginx web root and is never served
 * statically; the only way to read a file's bytes is this module's
 * `download()`, which re-checks the caller is the uploader or an active
 * member of the owning organization on every request. No ClamAV yet
 * (S0 gap) — uploads land as `scan_status: PENDING`, not `CLEAN`.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

    const isUploader = file.uploaded_by_user_id === userId;
    if (!isUploader) {
      if (!file.organization_id) throw new AppError('FORBIDDEN', 'Not permitted to view this file');
      await this.requireMembership(file.organization_id, userId);
    }

    const absPath = this.resolveSafePath(file.storage_key);
    const buffer = await readFile(absPath);
    return {
      buffer,
      mimeType: file.mime_type,
      originalName: file.original_name ?? `${file.id}`,
    };
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
