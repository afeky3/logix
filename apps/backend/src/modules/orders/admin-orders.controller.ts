import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { AdminOrdersService } from './admin-orders.service';

const listQuery = z.object({
  status: z
    .enum([
      'PENDING_PAYMENT',
      'VOID',
      'CONFIRMED',
      'SCHEDULED',
      'IN_PROGRESS',
      'ACTIVE',
      'CLOSING',
      'AWAITING_ACCEPTANCE',
      'DISPUTED',
      'COMPLETED',
      'CANCELLATION_REQUESTED',
      'CANCELLED',
    ])
    .optional(),
});

/** Dashboard "order monitor" — S4's admin-facing half. */
@Controller('admin/orders')
@UseGuards(StaffAuthGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    const { status } = parseBody(listQuery, query);
    return this.orders.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }
}
