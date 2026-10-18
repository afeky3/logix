import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { CUSTOMS_DOC_TYPES, CustomsService } from './customs.service';

const detailsSchema = z.object({
  movement: z.enum(['IMPORT', 'EXPORT', 'TRANSIT']),
  portType: z.enum(['SEA', 'AIR', 'LAND']),
  billOfLadingNo: z.string().max(100).optional(),
  hsCode: z.string().max(20).optional(),
  goodsDescription: z.string().max(1000).optional(),
});

const attachSchema = z.object({
  docType: z.enum(CUSTOMS_DOC_TYPES),
  fileId: z.string().uuid(),
});

const attachmentSchema = z.object({
  fileId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

/** Customs requests: movement details, shipping documents and broker attachments. */
@Controller('service-requests/:id')
@UseGuards(JwtAuthGuard)
export class CustomsController {
  constructor(private readonly customs: CustomsService) {}

  @Put('customs-details')
  saveDetails(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.customs.saveDetails(id, user.sub, parseBody(detailsSchema, body));
  }

  @Get('customs-documents')
  status(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.customs.status(id, user.sub);
  }

  @Post('customs-documents')
  attach(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { docType, fileId } = parseBody(attachSchema, body);
    return this.customs.attachDocument(id, user.sub, docType, fileId);
  }

  @Get('customs-attachments')
  listAttachments(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.customs.listAttachments(id, user.sub);
  }

  @Post('customs-attachments')
  addAttachment(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { fileId, note } = parseBody(attachmentSchema, body);
    return this.customs.addAttachment(id, user.sub, fileId, note);
  }

  @Delete('customs-attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.customs.removeAttachment(id, user.sub, attachmentId);
  }
}
