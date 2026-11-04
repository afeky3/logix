import { Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Body, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { RequireStaffPermission, StaffPermissionGuard } from '../../common/auth/staff-permission.guard';
import { CurrentStaff } from '../../common/auth/current-staff.decorator';
import type { StaffTokenPayload } from '../../common/auth/jwt-payload';
import { AdminPaymentsService, type RequestMeta } from './admin-payments.service';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listQuery = z.object({
  status: z.enum(['AWAITING_VERIFICATION', 'PAID', 'REJECTED', 'EXPIRED']).optional(),
  from: day.optional(),
  to: day.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const rejectBody = z.object({ reason: z.string().trim().min(3).max(500) });

const meta = (req: FastifyRequest): RequestMeta => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'] ?? null,
  requestId: (req.headers['x-request-id'] as string | undefined) ?? null,
});

/** Bank-transfer verification for the dashboard's Payments page. Staff-only, permission-gated. */
@Controller('admin/payments')
@UseGuards(StaffAuthGuard, StaffPermissionGuard)
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get()
  @RequireStaffPermission('finance.payments.read')
  list(@Query() query: Record<string, unknown>) {
    return this.payments.list(parseBody(listQuery, query));
  }

  @Get(':id')
  @RequireStaffPermission('finance.payments.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.get(id);
  }

  @Post(':id/approve')
  @RequireStaffPermission('finance.payments.verify')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentStaff() staff: StaffTokenPayload,
    @Req() req: FastifyRequest,
  ) {
    return this.payments.approve(id, staff.sub, meta(req));
  }

  @Post(':id/reject')
  @RequireStaffPermission('finance.payments.verify')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentStaff() staff: StaffTokenPayload,
    @Req() req: FastifyRequest,
  ) {
    const { reason } = parseBody(rejectBody, body);
    return this.payments.reject(id, staff.sub, reason, meta(req));
  }
}
