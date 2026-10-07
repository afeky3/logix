import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/**
 * Provider payouts, staff-driven for now (client round 1, item 14): a
 * settlement is scheduled when a provider completes an order
 * (orders.service.ts completeOrder); staff mark it paid by hand once the
 * transfer is actually made from the company account. No payment gateway
 * is wired yet, so this is the whole payout flow until one is.
 */
@Injectable()
export class AdminSettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async companyBankAccount() {
    const row = await this.prisma.app_config.findUnique({ where: { key: 'COMPANY_BANK_ACCOUNT' } });
    return row?.value ?? null;
  }

  async list(status?: string) {
    const rows = await this.prisma.settlements.findMany({
      where: { status: status ? (status as never) : undefined },
      orderBy: { eligible_at: 'desc' },
      take: 200,
      include: { organizations: { select: { display_name: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      reference: s.reference,
      beneficiaryName: s.organizations.display_name,
      beneficiaryRole: s.beneficiary_role,
      orderId: s.order_id,
      grossAmount: Number(s.gross_amount),
      commissionAmount: Number(s.commission_amount),
      commissionVatAmount: Number(s.commission_vat_amount),
      netAmount: Number(s.net_amount),
      status: s.status,
      eligibleAt: s.eligible_at,
      payableOn: s.payable_on,
      paidAt: s.paid_at,
    }));
  }

  /** Staff confirms the manual bank transfer was made. */
  async markPaid(id: string, staffId: string) {
    const settlement = await this.prisma.settlements.findUnique({ where: { id } });
    if (!settlement) throw new AppError('NOT_FOUND', 'Settlement not found');
    if (settlement.status === 'PAID') return this.get(id);
    if (settlement.status !== 'SCHEDULED' && settlement.status !== 'ON_HOLD') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a scheduled or held settlement can be marked paid');
    }
    await this.prisma.settlements.update({
      where: { id },
      data: { status: 'PAID', paid_at: new Date(), payout_id: randomUUID() },
    });
    void staffId; // who confirmed it — audited via staff session logs, not stored on the row yet
    return this.get(id);
  }

  private async get(id: string) {
    const s = await this.prisma.settlements.findUniqueOrThrow({
      where: { id },
      include: { organizations: { select: { display_name: true } } },
    });
    return {
      id: s.id,
      reference: s.reference,
      beneficiaryName: s.organizations.display_name,
      status: s.status,
      paidAt: s.paid_at,
    };
  }
}
