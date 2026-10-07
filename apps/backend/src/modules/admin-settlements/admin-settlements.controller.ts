import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { CurrentStaff } from '../../common/auth/current-staff.decorator';
import type { StaffTokenPayload } from '../../common/auth/jwt-payload';
import { AdminSettlementsService } from './admin-settlements.service';

const listQuery = z.object({
  status: z.enum(['SCHEDULED', 'ON_HOLD', 'IN_BATCH', 'PAID', 'FAILED', 'CANCELLED']).optional(),
});

/** Provider payouts (client round 1, item 14). Staff-only. */
@Controller('admin/settlements')
@UseGuards(StaffAuthGuard)
export class AdminSettlementsController {
  constructor(private readonly settlements: AdminSettlementsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const { status } = parseBody(listQuery, query);
    return this.settlements.list(status);
  }

  @Get('company-bank-account')
  companyBankAccount() {
    return this.settlements.companyBankAccount();
  }

  @Post(':id/mark-paid')
  markPaid(@Param('id') id: string, @CurrentStaff() staff: StaffTokenPayload) {
    return this.settlements.markPaid(id, staff.sub);
  }
}
