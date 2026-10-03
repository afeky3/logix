import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * S4 gap-fill: `payment_intents.expires_at` (30-minute hold —
 * orders.service.ts `PAYMENT_HOLD_MINUTES`) was always computed and shown
 * to the client, but nothing ever expired an intent the customer never
 * paid — the order and quote stayed stuck in
 * PENDING_PAYMENT/ACCEPTED_PENDING_PAYMENT forever, blocking every other
 * customer from accepting a different quote on that request (same shape
 * as the S3 request/quote expiry gap — see requests/request-expiry.service.ts).
 * Worker-only (see worker.ts/worker.module.ts): not imported by AppModule.
 */
@Injectable()
export class PaymentExpiryService {
  private readonly logger = new Logger(PaymentExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweep(): Promise<void> {
    const now = new Date();
    const stale = await this.prisma.payment_intents.findMany({
      where: { status: { in: ['INITIATED', 'PENDING'] }, expires_at: { lt: now } },
      select: { id: true, order_id: true },
    });
    if (stale.length === 0) return;

    for (const intent of stale) {
      await this.expireOne(intent.id, intent.order_id);
    }
    this.logger.log(`Expired ${stale.length} unpaid payment intent(s) past their 30-minute hold`);
  }

  private async expireOne(intentId: string, orderId: string | null): Promise<void> {
    await this.prisma.payment_intents.update({
      where: { id: intentId },
      data: { status: 'EXPIRED', failure_code: 'payment_hold_expired' },
    });
    if (!orderId) return; // only ORDER payables exist so far

    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'PENDING_PAYMENT') return; // already settled/handled

    await this.prisma.orders.update({ where: { id: orderId }, data: { status: 'VOID' } });

    const request = await this.prisma.service_requests.findUnique({ where: { id: order.request_id } });
    const now = new Date();
    const requestExpired = Boolean(request?.expires_at && request.expires_at < now);

    const quote = order.accepted_quote_id
      ? await this.prisma.quotes.findUnique({ where: { id: order.accepted_quote_id } })
      : null;
    if (quote && quote.status === 'ACCEPTED_PENDING_PAYMENT') {
      // Back on the market — unless the request's own 48h window closed
      // while payment was pending, or this quote's own validity did.
      const reopens = !requestExpired && quote.valid_until > now;
      await this.prisma.quotes.update({
        where: { id: quote.id },
        data: { status: reopens ? 'SUBMITTED' : 'EXPIRED' },
      });
    }

    if (request && request.status === 'AWAITING_PAYMENT') {
      let nextStatus: 'EXPIRED' | 'QUOTED' | 'SUBMITTED';
      if (requestExpired) {
        nextStatus = 'EXPIRED';
      } else {
        const anySubmitted = await this.prisma.quotes.count({
          where: { request_id: request.id, status: 'SUBMITTED' },
        });
        nextStatus = anySubmitted > 0 ? 'QUOTED' : 'SUBMITTED';
      }
      await this.prisma.service_requests.update({
        where: { id: request.id },
        data: { status: nextStatus },
      });
    }
  }
}
