import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ReferenceGenerator } from '../../common/references/reference-generator';
import { InvoicesService } from './invoices.service';
import { PAYOUT_BUSINESS_DAYS, addBusinessDays } from './settlement-release';

/** A cycle is created, and the customer reminded, this many days before it falls due. */
export const CYCLE_REMINDER_DAYS = 5;
const PAYMENT_HOLD_MINUTES = 30;

/** Contract length chosen on the request; null = open ended, renews monthly until the customer stops it. */
const TERM_MONTHS: Record<string, number | null> = {
  MONTHLY: null,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
  OTHER: null,
};

const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Same day next month, clamped to the month's last day (31 Jan + 1 month = 28 Feb). */
export function addMonthsUTC(date: Date, months: number): Date {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return first;
}

export interface ContractSummary {
  status: string;
  termMonths: number | null;
  nextDueDate: string | null;
  dueCycleId: string | null;
  dueAmountHalalas: number | null;
  overdue: boolean;
}

/**
 * Recurring (long-term) transport contracts. The quote is the price of one
 * month: the first month is paid when the offer is accepted, every later
 * month becomes a cycle opened CYCLE_REMINDER_DAYS before it starts. An
 * unpaid cycle suspends the contract (no trips) until it is paid. The
 * provider is settled once per paid cycle when its month has passed.
 */
@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly refs: ReferenceGenerator,
  ) {}

  /** Called once an order is paid. Does nothing unless the request asked for a long-term contract. */
  async createForPaidOrder(orderId: string, firstInvoiceId: string | null): Promise<void> {
    try {
      const existing = await this.prisma.recurring_contracts.findUnique({ where: { order_id: orderId } });
      if (existing) return;
      const order = await this.prisma.orders.findUniqueOrThrow({ where: { id: orderId } });
      const details = await this.prisma.transport_request_details.findUnique({
        where: { request_id: order.request_id },
        select: { long_term_contract: true, contract_term: true },
      });
      if (!details?.long_term_contract) return;

      const term = TERM_MONTHS[details.contract_term ?? 'MONTHLY'] ?? null;
      const now = new Date();
      const start = dayStart(order.confirmed_at ?? now);
      const end = addMonthsUTC(start, 1);
      const contractId = randomUUID();
      await this.prisma.$transaction([
        this.prisma.$executeRaw`
          INSERT INTO svc.recurring_contracts (
            id, order_id, customer_org_id, provider_org_id, term_months, cycle_amount, start_date, status
          ) VALUES (
            ${contractId}::uuid, ${orderId}::uuid, ${order.customer_org_id}::uuid, ${order.provider_org_id}::uuid,
            ${term}::smallint, ${order.total_amount}::core.halalas, ${start}::date, 'ACTIVE'::core.contract_status
          )
        `,
        this.prisma.$executeRaw`
          INSERT INTO svc.contract_cycles (
            id, contract_id, cycle_no, period_start, period_end, due_date, amount, status, paid_at, invoice_id
          ) VALUES (
            ${randomUUID()}::uuid, ${contractId}::uuid, 1, ${start}::date, ${end}::date, ${start}::date,
            ${order.total_amount}::core.halalas, 'PAID'::core.contract_cycle_status, ${now}::timestamptz,
            ${firstInvoiceId}::uuid
          )
        `,
      ]);
    } catch (err) {
      this.logger.error(`Contract creation failed for order ${orderId}`, err instanceof Error ? err.stack : String(err));
    }
  }

  private async requireParty(userId: string, orderId: string, side: 'customer' | 'provider' | 'either') {
    const contract = await this.prisma.recurring_contracts.findUnique({
      where: { order_id: orderId },
      include: { contract_cycles: { orderBy: { cycle_no: 'asc' } } },
    });
    if (!contract) throw new AppError('NOT_FOUND', 'This order has no recurring contract');
    const orgIds =
      side === 'customer'
        ? [contract.customer_org_id]
        : side === 'provider'
          ? [contract.provider_org_id]
          : [contract.customer_org_id, contract.provider_org_id];
    const membership = await this.prisma.memberships.findFirst({
      where: { user_id: userId, organization_id: { in: orgIds }, status: 'ACTIVE' },
    });
    if (!membership) throw new AppError('FORBIDDEN', 'Not a party to this contract');
    return contract;
  }

  async get(userId: string, orderId: string) {
    const contract = await this.requireParty(userId, orderId, 'either');
    const today = dayStart(new Date());
    const summary = this.summarize(contract);
    const lastPaid = [...contract.contract_cycles].reverse().find((c) => c.status === 'PAID');
    const fixedTermDone = contract.term_months != null && lastPaid?.cycle_no === contract.term_months;
    return {
      id: contract.id,
      orderId: contract.order_id,
      status: contract.status,
      termMonths: contract.term_months,
      startDate: isoDate(contract.start_date),
      cycleAmountHalalas: Number(contract.cycle_amount),
      nextDueDate: summary.nextDueDate,
      canEnd:
        contract.term_months == null &&
        (contract.status === 'ACTIVE' || contract.status === 'SUSPENDED') &&
        !summary.overdue,
      endsOn: contract.status === 'ENDING' || fixedTermDone ? (lastPaid ? isoDate(lastPaid.period_end) : null) : null,
      cycles: contract.contract_cycles.map((c) => ({
        id: c.id,
        cycleNo: c.cycle_no,
        periodStart: isoDate(c.period_start),
        periodEnd: isoDate(c.period_end),
        dueDate: isoDate(c.due_date),
        amountHalalas: Number(c.amount),
        status: c.status,
        paidAt: c.paid_at,
        daysUntilDue: Math.round((+dayStart(c.due_date) - +today) / 86_400_000),
        hasInvoice: c.status === 'PAID',
      })),
    };
  }

  /** What an order list or order screen needs to show about the contract. */
  async summaries(orderIds: string[]): Promise<Map<string, ContractSummary>> {
    if (orderIds.length === 0) return new Map();
    const contracts = await this.prisma.recurring_contracts.findMany({
      where: { order_id: { in: orderIds } },
      include: { contract_cycles: { orderBy: { cycle_no: 'asc' } } },
    });
    return new Map(contracts.map((c) => [c.order_id, this.summarize(c)]));
  }

  private summarize(contract: {
    status: string;
    term_months: number | null;
    start_date: Date;
    contract_cycles: { cycle_no: number; status: string; due_date: Date; amount: bigint; id: string }[];
  }): ContractSummary {
    const open = contract.contract_cycles.find((c) => c.status === 'DUE' || c.status === 'OVERDUE');
    const last = contract.contract_cycles.at(-1);
    let nextDueDate: string | null = open ? isoDate(open.due_date) : null;
    if (!open && contract.status === 'ACTIVE' && last) {
      const n = last.cycle_no + 1;
      if (contract.term_months == null || n <= contract.term_months) {
        nextDueDate = isoDate(addMonthsUTC(contract.start_date, n - 1));
      }
    }
    return {
      status: contract.status,
      termMonths: contract.term_months,
      nextDueDate,
      dueCycleId: open?.id ?? null,
      dueAmountHalalas: open ? Number(open.amount) : null,
      overdue: open?.status === 'OVERDUE',
    };
  }

  /** The customer opens a payment for a due or overdue cycle. */
  async payCycle(userId: string, orderId: string, cycleId: string) {
    const contract = await this.requireParty(userId, orderId, 'customer');
    const cycle = contract.contract_cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found');
    if (cycle.status !== 'DUE' && cycle.status !== 'OVERDUE') {
      throw new AppError('INVALID_STATE_TRANSITION', `This cycle is ${cycle.status.toLowerCase()}`);
    }

    const now = new Date();
    const live = await this.prisma.payment_intents.findFirst({
      where: { contract_cycle_id: cycleId, status: { in: ['INITIATED', 'PENDING'] }, expires_at: { gt: now } },
      orderBy: { created_at: 'desc' },
    });
    const intentId = live?.id ?? (await this.createCycleIntent(cycleId, contract.customer_org_id, userId, cycle.amount));
    return this.serializeIntent(intentId);
  }

  private async createCycleIntent(cycleId: string, payerOrgId: string, userId: string, amount: bigint): Promise<string> {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO fin.payment_intents (
        id, payable_type, contract_cycle_id, payer_org_id, payer_user_id,
        amount, currency, method, gateway, status, expires_at
      ) VALUES (
        ${id}::uuid, 'CONTRACT_CYCLE'::core.payable_type, ${cycleId}::uuid,
        ${payerOrgId}::uuid, ${userId}::uuid,
        ${amount}::core.halalas, 'SAR'::core.currency_code,
        'CARD'::core.payment_method, 'fake', 'INITIATED'::core.payment_intent_status, ${expiresAt}::timestamptz
      )
    `;
    return id;
  }

  private async serializeIntent(intentId: string) {
    const i = await this.prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } });
    return {
      id: i.id,
      status: i.status,
      amountHalalas: Number(i.amount),
      currency: i.currency,
      gateway: i.gateway,
      orderId: i.order_id,
      contractCycleId: i.contract_cycle_id,
      expiresAt: i.expires_at,
      paidAt: i.paid_at,
      failureCode: i.failure_code,
    };
  }

  /** What the gateway's success webhook does for a cycle payment. */
  async settleCyclePayment(intentId: string): Promise<void> {
    const intent = await this.prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } });
    if (!intent.contract_cycle_id) return;
    const cycleId = intent.contract_cycle_id;
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.payment_intents.update({
        where: { id: intentId },
        data: { status: 'PAID', paid_at: now, gateway_payment_id: `fake_${intentId}` },
      }),
      this.prisma.$executeRaw`
        UPDATE svc.contract_cycles
        SET status = 'PAID'::core.contract_cycle_status, paid_at = ${now}::timestamptz
        WHERE id = ${cycleId}::uuid AND status IN ('DUE'::core.contract_cycle_status, 'OVERDUE'::core.contract_cycle_status)
      `,
      // Paying the overdue cycle lifts the suspension.
      this.prisma.$executeRaw`
        UPDATE svc.recurring_contracts
        SET status = 'ACTIVE'::core.contract_status, suspended_at = NULL
        WHERE status = 'SUSPENDED'::core.contract_status
          AND id = (SELECT contract_id FROM svc.contract_cycles WHERE id = ${cycleId}::uuid)
          AND NOT EXISTS (
            SELECT 1 FROM svc.contract_cycles c
            WHERE c.contract_id = svc.recurring_contracts.id AND c.status = 'OVERDUE'::core.contract_cycle_status
          )
      `,
    ]);
    await this.invoices.issueForCycleSafely(cycleId);
  }

  /** The customer stops an open-ended contract from renewing; it runs to the end of the month already paid. */
  async end(userId: string, orderId: string) {
    const contract = await this.requireParty(userId, orderId, 'customer');
    if (contract.term_months != null) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'A fixed-term contract ends by itself when its term is over');
    }
    if (contract.status === 'ENDING' || contract.status === 'ENDED') return this.get(userId, orderId);
    if (contract.contract_cycles.some((c) => c.status === 'OVERDUE')) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Pay the overdue amount before ending the contract');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE svc.contract_cycles SET status = 'VOID'::core.contract_cycle_status
        WHERE contract_id = ${contract.id}::uuid AND status = 'DUE'::core.contract_cycle_status
      `,
      this.prisma.$executeRaw`
        UPDATE svc.recurring_contracts
        SET status = 'ENDING'::core.contract_status, end_requested_at = ${now}::timestamptz
        WHERE id = ${contract.id}::uuid
      `,
    ]);
    return this.get(userId, orderId);
  }

  async isSuspended(orderId: string): Promise<boolean> {
    const c = await this.prisma.recurring_contracts.findUnique({ where: { order_id: orderId }, select: { status: true } });
    return c?.status === 'SUSPENDED';
  }

  /** Daily-ish housekeeping: open cycles, mark overdue ones, settle finished months, close ended contracts. */
  async sweep(now = new Date()): Promise<void> {
    const today = dayStart(now);
    const contracts = await this.prisma.recurring_contracts.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED', 'ENDING'] } },
      include: { contract_cycles: { orderBy: { cycle_no: 'asc' } } },
    });
    for (const contract of contracts) {
      try {
        await this.sweepOne(contract, today, now);
      } catch (err) {
        this.logger.error(`Contract sweep failed for ${contract.id}`, err instanceof Error ? err.stack : String(err));
      }
    }
  }

  private async sweepOne(
    contract: Prisma.recurring_contractsGetPayload<{ include: { contract_cycles: true } }>,
    today: Date,
    now: Date,
  ): Promise<void> {
    let status: string = contract.status;
    const cycles = contract.contract_cycles.map((c) => ({ ...c }));

    // 1. A due cycle past its date is overdue, and an overdue cycle suspends the contract.
    for (const c of cycles) {
      if (c.status === 'DUE' && dayStart(c.due_date) < today) {
        await this.prisma.$executeRaw`
          UPDATE svc.contract_cycles SET status = 'OVERDUE'::core.contract_cycle_status WHERE id = ${c.id}::uuid
        `;
        c.status = 'OVERDUE';
      }
    }
    if (cycles.some((c) => c.status === 'OVERDUE') && status === 'ACTIVE') {
      await this.prisma.$executeRaw`
        UPDATE svc.recurring_contracts
        SET status = 'SUSPENDED'::core.contract_status, suspended_at = ${now}::timestamptz
        WHERE id = ${contract.id}::uuid
      `;
      status = 'SUSPENDED';
    }

    // 2. Open the next month's cycle once its reminder window starts.
    const last = cycles.at(-1);
    if (status === 'ACTIVE' && last?.status === 'PAID') {
      const n = last.cycle_no + 1;
      if (contract.term_months == null || n <= contract.term_months) {
        const due = addMonthsUTC(contract.start_date, n - 1);
        if (today >= addDays(due, -CYCLE_REMINDER_DAYS)) {
          const end = addMonthsUTC(contract.start_date, n);
          await this.prisma.$executeRaw`
            INSERT INTO svc.contract_cycles (
              id, contract_id, cycle_no, period_start, period_end, due_date, amount, status, reminder_at
            ) VALUES (
              ${randomUUID()}::uuid, ${contract.id}::uuid, ${n}::smallint, ${due}::date, ${end}::date, ${due}::date,
              ${contract.cycle_amount}::core.halalas, 'DUE'::core.contract_cycle_status, ${now}::timestamptz
            )
          `;
        }
      }
    }

    // 3. A paid month that has passed is settled to the provider.
    for (const c of cycles) {
      if (c.status === 'PAID' && !c.settlement_id && dayStart(c.period_end) <= today) {
        await this.createCycleSettlement(contract, c, now);
      }
    }

    // 4. Close the contract when the last paid month is over and nothing more will be billed.
    const lastPaid = [...cycles].reverse().find((c) => c.status === 'PAID');
    const nothingMore =
      status === 'ENDING' || (contract.term_months != null && lastPaid?.cycle_no === contract.term_months);
    if (nothingMore && lastPaid && dayStart(lastPaid.period_end) <= today && !cycles.some((c) => c.status === 'DUE' || c.status === 'OVERDUE')) {
      await this.prisma.$executeRaw`
        UPDATE svc.recurring_contracts
        SET status = 'ENDED'::core.contract_status, ended_at = ${now}::timestamptz
        WHERE id = ${contract.id}::uuid
      `;
    }
  }

  private async createCycleSettlement(
    contract: { id: string; order_id: string; provider_org_id: string },
    cycle: { id: string; cycle_no: number; period_end: Date },
    now: Date,
  ): Promise<void> {
    const order = await this.prisma.orders.findUniqueOrThrow({ where: { id: contract.order_id } });
    // fin.settlements requires STL- followed by 7+ digits; the generator gives 6, so pad one zero.
    const reference = 'STL-0' + (await this.refs.next('STL')).slice(4);
    const net = order.service_fee - order.commission_amount - order.commission_vat_amount;
    const payableOn = addBusinessDays(cycle.period_end, PAYOUT_BUSINESS_DAYS);
    const settlementId = randomUUID();
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        INSERT INTO fin.settlements (
          id, reference, beneficiary_org_id, beneficiary_role, order_id, period_no, commission_rule_id,
          gross_amount, commission_rate_bps, commission_amount, commission_vat_amount, net_amount,
          eligible_at, payable_on, status, version, created_at, updated_at
        ) VALUES (
          ${settlementId}::uuid, ${reference}, ${order.provider_org_id}::uuid, 'PROVIDER'::core.beneficiary_role,
          ${order.id}::uuid, ${cycle.cycle_no}::smallint, ${order.commission_rule_id}::uuid,
          ${order.service_fee}::core.halalas, ${order.commission_rate_bps}::core.bps,
          ${order.commission_amount}::core.halalas, ${order.commission_vat_amount}::core.halalas,
          ${net}::core.halalas,
          ${now}::timestamptz, ${payableOn}::date, 'SCHEDULED'::core.settlement_status, 1, now(), now()
        )
      `,
      this.prisma.$executeRaw`
        UPDATE svc.contract_cycles SET settlement_id = ${settlementId}::uuid WHERE id = ${cycle.id}::uuid
      `,
    ]);
  }
}
