import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { OrdersService } from './orders.service';

const simulateSchema = z.object({ outcome: z.enum(['succeed', 'fail']) });
const confirmReadinessSchema = z.object({ organizationId: z.string().uuid() });
const ratingSchema = z.object({ stars: z.number().int().min(1).max(5), notes: z.string().max(1000).optional() });
const cancelConfirmedSchema = z.object({ reasonCode: z.string().max(100).optional() });
const feedQuery = z.object({
  organizationId: z.string().uuid(),
  role: z.enum(['customer', 'provider']),
  status: z.string().optional(),
});

/** S4 — Accept, pay and order (transport only, same scope as S3).
 * backend/md/modules/12-payments-finance.md (trimmed to the S4 slice —
 * see orders.service.ts class doc). */
@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('quotes/:id/accept')
  accept(@Param('id') quoteId: string, @CurrentUser() user: AppTokenPayload) {
    return this.orders.acceptQuote(user.sub, quoteId);
  }

  @Get('payment-intents/:id')
  getPaymentIntent(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.orders.getPaymentIntent(user.sub, id);
  }

  @Post('payment-intents/:id/simulate')
  simulate(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { outcome } = parseBody(simulateSchema, body);
    return this.orders.simulatePayment(user.sub, id, outcome);
  }

  @Get('orders/feed')
  feed(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, role, status } = parseBody(feedQuery, query);
    return this.orders.feed(user.sub, organizationId, role, status);
  }

  @Get('orders/by-reference/:reference')
  getByReference(@Param('reference') reference: string, @CurrentUser() user: AppTokenPayload) {
    return this.orders.getOrderByReference(user.sub, reference);
  }

  @Get('orders/:id')
  get(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.orders.getOrder(user.sub, id);
  }

  @Post('orders/:id/complete')
  complete(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId } = parseBody(confirmReadinessSchema, body);
    return this.orders.completeOrder(user.sub, id, organizationId);
  }

  @Post('orders/:id/confirm-readiness')
  confirmReadiness(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId } = parseBody(confirmReadinessSchema, body);
    return this.orders.confirmReadiness(user.sub, id, organizationId);
  }

  @Post('orders/:id/receipt')
  receipt(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.orders.receiptOrder(user.sub, id);
  }

  @Post('orders/:id/rating')
  rate(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { stars, notes } = parseBody(ratingSchema, body);
    return this.orders.rateOrder(user.sub, id, stars, notes);
  }

  @Post('orders/:id/cancel')
  cancelConfirmed(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { reasonCode } = parseBody(cancelConfirmedSchema, body);
    return this.orders.cancelOrder(user.sub, id, reasonCode);
  }
}
