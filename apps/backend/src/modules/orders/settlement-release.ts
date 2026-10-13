import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** The customer has this long to confirm receipt before it is confirmed for them. */
export const AUTO_RECEIPT_HOURS = 72;
/** Provider payout is due this many business days after receipt is confirmed. */
export const PAYOUT_BUSINESS_DAYS = 3;

/** Saudi working week: Sunday to Thursday; Friday and Saturday are the weekend. */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 5 && dow !== 6) left -= 1;
  }
  return d;
}

/**
 * Receipt confirmed (by the customer or automatically): the provider's held
 * settlement becomes payable PAYOUT_BUSINESS_DAYS business days from `at`.
 */
export async function releaseSettlementHold(prisma: PrismaService, orderId: string, at: Date): Promise<void> {
  const payableOn = addBusinessDays(at, PAYOUT_BUSINESS_DAYS);
  await prisma.$executeRaw`
    UPDATE fin.settlements
    SET status = 'SCHEDULED'::core.settlement_status, hold_reason = NULL,
        released_at = ${at}::timestamptz, eligible_at = ${at}::timestamptz,
        payable_on = ${payableOn}::date, version = version + 1
    WHERE order_id = ${orderId}::uuid AND beneficiary_role = 'PROVIDER'::core.beneficiary_role
      AND status = 'ON_HOLD'::core.settlement_status
  `;
  await prisma.$executeRaw`
    UPDATE svc.orders SET settlement_status = 'SCHEDULED'::core.settlement_status
    WHERE id = ${orderId}::uuid AND settlement_status = 'ON_HOLD'::core.settlement_status
  `;
}
