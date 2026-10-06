import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { CustomsService } from './customs.service';

const detailsSchema = z.object({
  movement: z.enum(['IMPORT', 'EXPORT', 'TRANSIT']),
  billOfLadingNo: z.string().max(100).optional(),
  hsCode: z.string().max(20).optional(),
  goodsDescription: z.string().max(1000).optional(),
});

const attachSchema = z.object({
  docType: z.enum(['CERTIFICATE_OF_ORIGIN', 'BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'ORIGIN_INVOICE', 'PACKING_LIST']),
  fileId: z.string().uuid(),
});

/** Customs requests: movement details and the required shipping documents. */
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
}
