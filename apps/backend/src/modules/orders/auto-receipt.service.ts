import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { releaseSettlementHold } from './settlement-release';

/**
 * A customer who never confirms receipt must not hold the provider's money
 * forever: AUTO_RECEIPT_HOURS after completion the receipt is confirmed for
 * them (flagged is_auto) and the settlement is released the same way.
 * Worker-only (see worker.module.ts): not imported by AppModule.
 */
@Injectable()
export class AutoReceiptService {
  private readonly logger = new Logger(AutoReceiptService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.orders.findMany({
      where: {
        status: 'COMPLETED',
        auto_accept_at: { lt: now },
        accepted_at: null,
        receipt_confirmations: { none: {} },
      },
      select: { id: true },
      take: 200,
    });
    for (const { id } of due) {
      try {
        await this.prisma.$transaction([
          this.prisma.receipt_confirmations.create({
            data: { id: randomUUID(), order_id: id, condition: 'INTACT', is_auto: true, confirmed_at: now },
          }),
          this.prisma.orders.update({ where: { id }, data: { accepted_at: now, last_update_at: now } }),
        ]);
        await releaseSettlementHold(this.prisma, id, now);
      } catch (err) {
        this.logger.error(`Auto-receipt failed for order ${id}`, err instanceof Error ? err.stack : String(err));
      }
    }
    if (due.length) this.logger.log(`Auto-confirmed receipt on ${due.length} completed order(s)`);
  }
}
