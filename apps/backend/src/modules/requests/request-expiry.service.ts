import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * S3 gap-fill: `service_requests.expires_at` (48h TTL) and
 * `quotes.valid_until` (24-168h, provider-set) were always computed and
 * shown to the client, but nothing ever flipped status to EXPIRED when the
 * time passed — the worker process had no queues/cron registered yet.
 * Worker-only (see worker.ts): not imported by AppModule, so this does not
 * also run inside the API process.
 */
@Injectable()
export class RequestExpiryService {
  private readonly logger = new Logger(RequestExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_SECONDS) // TEMP: diagnosing a no-op cron, reverting to EVERY_5_MINUTES after
  async sweep(): Promise<void> {
    this.logger.log('Expiry sweep tick');
    const now = new Date();

    const requests = await this.prisma.service_requests.updateMany({
      where: { status: { in: ['SUBMITTED', 'QUOTED'] }, expires_at: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    if (requests.count > 0) {
      this.logger.log(`Expired ${requests.count} service request(s) past their 48h TTL`);
    }

    const quotes = await this.prisma.quotes.updateMany({
      where: { status: 'SUBMITTED', valid_until: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    if (quotes.count > 0) {
      this.logger.log(`Expired ${quotes.count} quote(s) past their validity window`);
    }
  }
}
