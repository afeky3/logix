import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { CurrentStaff } from '../../common/auth/current-staff.decorator';
import type { StaffTokenPayload } from '../../common/auth/jwt-payload';
import { AdminCasesService } from './admin-cases.service';

const listQuery = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'WAITING_ON_PROVIDER', 'WAITING_ON_SUPPLIER', 'RESOLVED', 'REOPENED', 'CLOSED']).optional(),
});

const decisionSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED']),
  resolutionCode: z
    .enum(['RESOLVED_REFUND', 'RESOLVED_ADJUSTMENT', 'RESOLVED_REPLACEMENT', 'RESOLVED_NO_FAULT', 'RESOLVED_INSURANCE', 'DUPLICATE', 'INVALID', 'WITHDRAWN'])
    .optional(),
  resolutionNote: z.string().max(2000).optional(),
});

/** Staff review of buyer-reported issues (client round 1). */
@Controller('admin/cases')
@UseGuards(StaffAuthGuard)
export class AdminCasesController {
  constructor(private readonly cases: AdminCasesService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const { status } = parseBody(listQuery, query);
    return this.cases.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cases.get(id);
  }

  @Post(':id/decision')
  decide(@Param('id') id: string, @Body() body: unknown, @CurrentStaff() staff: StaffTokenPayload) {
    const { status, resolutionCode, resolutionNote } = parseBody(decisionSchema, body);
    return this.cases.decide(id, staff.sub, status, resolutionCode, resolutionNote);
  }
}
