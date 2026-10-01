import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { CurrentStaff } from '../../common/auth/current-staff.decorator';
import type { StaffTokenPayload } from '../../common/auth/jwt-payload';
import { AdminKybService } from './admin-kyb.service';
import { FilesService } from '../files/files.service';

const listQuery = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED']).optional(),
});

const itemDecisionSchema = z.object({
  status: z.enum(['ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED']),
  reasonNote: z.string().max(2000).optional(),
});

const caseDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']),
  reason: z.string().max(2000).optional(),
});

/** Admin KYB review stopgap — backend/md/modules/02-organizations-kyb-terms.md
 * "KYB review (dashboard)". Staff-only (separate `aud: "staff"` token). */
@Controller('admin')
@UseGuards(StaffAuthGuard)
export class AdminKybController {
  constructor(
    private readonly kyb: AdminKybService,
    private readonly files: FilesService,
  ) {}

  @Get('verification-cases')
  listCases(@Query() query: Record<string, unknown>) {
    const { status } = parseBody(listQuery, query);
    return this.kyb.listCases(status);
  }

  @Get('organizations/:id')
  getOrganization(@Param('id') id: string) {
    return this.kyb.getOrganization(id);
  }

  @Get('files/:id')
  async downloadFile(@Param('id') id: string, @Res({ passthrough: true }) res: FastifyReply) {
    const { buffer, mimeType, originalName } = await this.files.downloadAsStaff(id);
    res.header('Content-Type', mimeType);
    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    res.header('Cache-Control', 'private, no-store');
    return buffer;
  }

  @Post('verification-cases/:id/assign')
  assign(@Param('id') caseId: string, @CurrentStaff() staff: StaffTokenPayload) {
    return this.kyb.assign(staff.sub, caseId);
  }

  @Post('verification-cases/:id/items/:itemId/decision')
  decideItem(
    @Param('id') caseId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentStaff() staff: StaffTokenPayload,
  ) {
    const { status, reasonNote } = parseBody(itemDecisionSchema, body);
    return this.kyb.decideItem(staff.sub, caseId, itemId, status, reasonNote);
  }

  @Post('verification-cases/:id/decision')
  decideCase(
    @Param('id') caseId: string,
    @Body() body: unknown,
    @CurrentStaff() staff: StaffTokenPayload,
  ) {
    const { decision, reason } = parseBody(caseDecisionSchema, body);
    return this.kyb.decideCase(staff.sub, caseId, decision, reason);
  }
}
