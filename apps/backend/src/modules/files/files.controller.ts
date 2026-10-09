import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { AppError } from '../../common/errors/app-error';
import { FilesService } from './files.service';

const FILE_PURPOSES = new Set([
  'DOCUMENT',
  'EVIDENCE_PHOTO',
  'SIGNATURE',
  'PRODUCT_IMAGE',
  'CHAT_ATTACHMENT',
  'AVATAR',
  'EXPORT',
  'GENERATED_PDF',
  'SHIPMENT_DOCUMENT',
]);

/**
 * Private, server-disk file storage (no S3 bucket set up yet — by design
 * for now). Upload and download both require a valid access token;
 * download also re-checks org membership on every request. There is no
 * static/public URL for a file — see files.service.ts.
 */
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  async upload(@Req() req: FastifyRequest, @CurrentUser() user: AppTokenPayload) {
    const data = await req.file();
    if (!data) {
      throw new AppError('VALIDATION_FAILED', 'No file in the request', {
        details: [{ field: 'file', code: 'required' }],
      });
    }

    const organizationId = (data.fields.organizationId as { value?: string } | undefined)?.value;
    const purpose = (data.fields.purpose as { value?: string } | undefined)?.value ?? 'DOCUMENT';

    if (!organizationId) {
      throw new AppError('VALIDATION_FAILED', 'organizationId is required', {
        details: [{ field: 'organizationId', code: 'required' }],
      });
    }
    if (!FILE_PURPOSES.has(purpose)) {
      throw new AppError('VALIDATION_FAILED', `Unknown purpose: ${purpose}`, {
        details: [{ field: 'purpose', code: 'invalid' }],
      });
    }

    const buffer = await data.toBuffer();
    return this.files.upload({
      userId: user.sub,
      organizationId,
      purpose,
      filename: data.filename,
      mimeType: data.mimetype,
      buffer,
    });
  }

  @Post('avatar')
  async uploadAvatar(@Req() req: FastifyRequest, @CurrentUser() user: AppTokenPayload) {
    const data = await req.file();
    if (!data) throw new AppError('VALIDATION_FAILED', 'No file in the request', { details: [{ field: 'file', code: 'required' }] });
    const buffer = await data.toBuffer();
    return this.files.uploadAvatar({ userId: user.sub, filename: data.filename, mimeType: data.mimetype, buffer });
  }

  @Post('org-logo')
  async uploadOrgLogo(@Req() req: FastifyRequest, @CurrentUser() user: AppTokenPayload) {
    const data = await req.file();
    if (!data) throw new AppError('VALIDATION_FAILED', 'No file in the request', { details: [{ field: 'file', code: 'required' }] });
    const organizationId = (data.fields.organizationId as { value?: string } | undefined)?.value;
    if (!organizationId) throw new AppError('VALIDATION_FAILED', 'organizationId is required', { details: [{ field: 'organizationId', code: 'required' }] });
    const buffer = await data.toBuffer();
    return this.files.uploadOrgLogo({ userId: user.sub, organizationId, purpose: 'AVATAR', filename: data.filename, mimeType: data.mimetype, buffer });
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AppTokenPayload,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { buffer, mimeType, originalName } = await this.files.download(id, user.sub);
    res.header('Content-Type', mimeType);
    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    // Never let an intermediary cache a private, access-controlled file.
    res.header('Cache-Control', 'private, no-store');
    return buffer;
  }
}

/** Public controller — no JWT guard. Serves only AVATAR-purpose files. */
@Controller('files/avatar')
export class PublicAvatarController {
  constructor(private readonly files: FilesService) {}

  @Get(':id')
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const { buffer, mimeType } = await this.files.downloadAvatar(id);
    res.header('Content-Type', mimeType);
    res.header('Cache-Control', 'public, max-age=86400, immutable');
    return buffer;
  }
}
