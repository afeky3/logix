import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { AdminRequestsService } from './admin-requests.service';

const listQuery = z.object({
  status: z
    .enum(['DRAFT', 'SUBMITTED', 'QUOTED', 'AWAITING_PAYMENT', 'CONVERTED', 'EXPIRED', 'CANCELLED'])
    .optional(),
  zeroQuoteOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/** Dashboard "request monitor" — backend/md/modules/05-requests-quotes-matching.md. */
@Controller('admin/service-requests')
@UseGuards(StaffAuthGuard)
export class AdminRequestsController {
  constructor(private readonly requests: AdminRequestsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const { status, zeroQuoteOnly } = parseBody(listQuery, query);
    return this.requests.list(status, zeroQuoteOnly);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.requests.get(id);
  }
}
