import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ReferenceGenerator } from '../../common/references/reference-generator';

/**
 * Provider payouts, staff-driven for now (client round 1, item 14): a
 * settlement is scheduled when a provider completes an order
 * (orders.service.ts completeOrder); staff mark it paid by hand once the
 * transfer is actually made from the company account. No payment gateway
 * is wired yet, so this is the whole payout flow until one is.
 */
@Injectable()
export class AdminSettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: ReferenceGenerator,
  ) {}

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

  /**
   * Staff confirms the manual bank transfer was made. settlements.payout_id
   * is a real FK (fin.payouts, itself under a payout_batches batch) — there
   * is no batch/export workflow yet, so this opens a single-item batch and
   * payout just to record the one transfer against the beneficiary's own
   * bank account on file.
   */
  async markPaid(id: string, staffId: string) {
    const settlement = await this.prisma.settlements.findUnique({ where: { id } });
    if (!settlement) throw new AppError('NOT_FOUND', 'Settlement not found');
    if (settlement.status === 'PAID') return this.get(id);
    if (settlement.status !== 'SCHEDULED' && settlement.status !== 'ON_HOLD') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a scheduled or held settlement can be marked paid');
    }

    const bankAccount = await this.prisma.bank_accounts.findFirst({
      where: { organization_id: settlement.beneficiary_org_id, deleted_at: null },
      orderBy: { is_default: 'desc' },
    });
    if (!bankAccount) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Beneficiary has no bank account on file');
    }

    const now = new Date();
    const batchId = randomUUID();
    const payoutId = randomUUID();
    // fin.payouts.reference requires TRX- followed by 7+ digits; the
    // generator gives 6, so pad one zero (same fix as settlement references).
    const batchReference = 'TRX-0' + (await this.refs.next('TRX')).slice(4);
    const payoutReference = 'TRX-0' + (await this.refs.next('TRX')).slice(4);

    await this.prisma.$transaction([
      this.prisma.payout_batches.create({
        data: {
          id: batchId,
          reference: batchReference,
          status: 'PAID',
          bank_format: 'MANUAL',
          total_amount: settlement.net_amount,
          payout_count: 1,
          created_by_staff_id: staffId,
          // ck_batch_maker_checker: approver must differ from the creator —
          // no second staff member in this manual single-item flow, so leave unapproved.
          completed_at: now,
        },
      }),
      this.prisma.payouts.create({
        data: {
          id: payoutId,
          batch_id: batchId,
          reference: payoutReference,
          beneficiary_org_id: settlement.beneficiary_org_id,
          bank_account_id: bankAccount.id,
          iban_last4: bankAccount.iban_last4,
          account_holder_snapshot: bankAccount.account_holder_name,
          amount: settlement.net_amount,
          status: 'PAID',
          paid_at: now,
        },
      }),
      this.prisma.settlements.update({
        where: { id },
        data: { status: 'PAID', paid_at: now, payout_id: payoutId },
      }),
    ]);
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
