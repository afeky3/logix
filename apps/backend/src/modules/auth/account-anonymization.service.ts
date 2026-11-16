import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Days a deleted account is kept (identity only) before it is anonymized. */
export const ANONYMIZE_AFTER_DAYS = Number(process.env.ACCOUNT_ANONYMIZATION_DAYS ?? 30);

/**
 * Identity of accounts deleted more than [ANONYMIZE_AFTER_DAYS] days ago is erased: name, the phone and
 * e-mail kept aside at deletion, the avatar. Invoices, payments, contracts and legal acceptances stay
 * (they point at the now-anonymous user). Worker-only (see worker.module.ts).
 */
@Injectable()
export class AccountAnonymizationService {
  private readonly logger = new Logger(AccountAnonymizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweep(): Promise<void> {
    const n = await this.anonymizeDue();
    if (n) this.logger.log(`Anonymized ${n} deleted account(s)`);
  }

  async anonymizeDue(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ANONYMIZE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const due = await this.prisma.users.findMany({
      where: { status: 'DELETED', anonymized_at: null, deleted_at: { lt: cutoff } },
      select: { id: true, avatar_file_id: true },
      take: 200,
    });
    for (const u of due) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.users.update({
            where: { id: u.id },
            data: { full_name: null, erasable_phone_e164: null, erasable_email: null, avatar_file_id: null, anonymized_at: now },
          });
          if (u.avatar_file_id) await tx.files.updateMany({ where: { id: u.avatar_file_id }, data: { deleted_at: now } });
        });
      } catch (err) {
        this.logger.error(`Anonymizing user ${u.id} failed`, err instanceof Error ? err.stack : String(err));
      }
    }
    return due.length;
  }
}
