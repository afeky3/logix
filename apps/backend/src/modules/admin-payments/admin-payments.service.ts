import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService, type NewNotification } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { ContractsService } from '../orders/contracts.service';
import { bankTransferHoldMs } from '../orders/payment-hold';

export const PAYMENT_ENTITY = 'payment_intent';
export const REJECTED_CODE = 'bank_transfer_rejected';

/** What the Payments page filters on; the intent's own status is `status` in every row. */
export type VerificationStatus = 'AWAITING_VERIFICATION' | 'PAID' | 'REJECTED' | 'EXPIRED';

export interface ListFilters {
  status?: VerificationStatus;
  from?: string;
  to?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

interface IntentRow {
  id: string;
  payable_type: 'ORDER' | 'CONTRACT_CYCLE' | string;
  status: string;
  amount: bigint;
  currency: string;
  method: string;
  failure_code: string | null;
  failure_message: string | null;
  created_at: Date;
  paid_at: Date | null;
  expires_at: Date;
  payer_org_id: string;
  payer_user_id: string;
  order_id: string;
  order_reference: string;
  order_status: string;
  service_type: string;
  provider_org_id: string;
  customer_name: string;
  payer_user_name: string | null;
  payer_phone: string | null;
  cycle_id: string | null;
  cycle_no: number | null;
  cycle_status: string | null;
}

type Verdict = { ok: true; late: boolean } | { ok: false; message: string };

const LIVE = ['INITIATED', 'PENDING'];

/** Straight from the intent row, without the joins that need a lock — enough for list and details. */
const FROM = Prisma.sql`
  FROM fin.payment_intents pi
  LEFT JOIN svc.contract_cycles cc ON cc.id = pi.contract_cycle_id
  LEFT JOIN svc.recurring_contracts rc ON rc.id = cc.contract_id
  JOIN svc.orders o ON o.id = COALESCE(pi.order_id, rc.order_id)
  JOIN org.organizations cust ON cust.id = pi.payer_org_id
  JOIN identity.users u ON u.id = pi.payer_user_id`;

const COLUMNS = Prisma.sql`
  pi.id, pi.payable_type::text AS payable_type, pi.status::text AS status, pi.amount, pi.currency::text AS currency,
  pi.method::text AS method, pi.failure_code, pi.failure_message, pi.created_at, pi.paid_at, pi.expires_at,
  pi.payer_org_id, pi.payer_user_id,
  o.id AS order_id, o.reference AS order_reference, o.status::text AS order_status,
  o.service_type::text AS service_type, o.provider_org_id,
  cust.display_name AS customer_name, u.full_name AS payer_user_name, u.phone_e164 AS payer_phone,
  cc.id AS cycle_id, cc.cycle_no::int AS cycle_no, cc.status::text AS cycle_status`;

function verificationStatus(status: string): string {
  if (LIVE.includes(status)) return 'AWAITING_VERIFICATION';
  if (status === 'FAILED') return 'REJECTED';
  return status;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Staff verification of manual bank transfers. The customer transfers outside the app and taps
 * "transferred" (acceptQuote / payCycle opens the intent); here staff confirm it arrived or reject
 * it with a reason. Both decisions run in one transaction under a row lock on the intent, so the
 * same transfer can't be approved twice or approved and rejected, and each leaves an audit row.
 */
@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly contracts: ContractsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(filters: ListFilters) {
    const where: Prisma.Sql[] = [Prisma.sql`pi.method = 'BANK_TRANSFER'`];
    switch (filters.status) {
      case 'AWAITING_VERIFICATION':
        where.push(Prisma.sql`pi.status IN ('INITIATED', 'PENDING')`);
        break;
      case 'PAID':
        where.push(Prisma.sql`pi.status = 'PAID'`);
        break;
      case 'REJECTED':
        where.push(Prisma.sql`pi.status = 'FAILED'`);
        break;
      case 'EXPIRED':
        where.push(Prisma.sql`pi.status = 'EXPIRED'`);
        break;
    }
    // Dates are the dashboard user's Riyadh calendar days.
    if (filters.from) {
      where.push(Prisma.sql`pi.created_at >= (${filters.from}::date)::timestamp AT TIME ZONE 'Asia/Riyadh'`);
    }
    if (filters.to) {
      where.push(Prisma.sql`pi.created_at < ((${filters.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Riyadh')`);
    }
    if (filters.q) {
      const like = `%${escapeLike(filters.q)}%`;
      where.push(Prisma.sql`(o.reference ILIKE ${like} OR cust.display_name ILIKE ${like})`);
    }
    const whereSql = Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}`;
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, counted] = await Promise.all([
      this.prisma.$queryRaw<IntentRow[]>`
        SELECT ${COLUMNS} ${FROM} ${whereSql}
        ORDER BY pi.created_at DESC
        LIMIT ${filters.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total ${FROM} ${whereSql}`,
    ]);

    return {
      items: rows.map((r) => this.summary(r)),
      page: filters.page,
      pageSize: filters.pageSize,
      total: Number(counted[0]?.total ?? 0),
    };
  }

  async get(id: string) {
    const row = await this.load(this.prisma, id);
    const verdict = await this.evaluateApprove(this.prisma, row);
    const canDecide = LIVE.includes(row.status) && row.method === 'BANK_TRANSFER';

    const history = await this.prisma.audit_logs.findMany({
      where: { entity_type: PAYMENT_ENTITY, entity_id: id },
      orderBy: { occurred_at: 'asc' },
    });
    const staffIds = [...new Set(history.map((h) => h.actor_staff_id).filter((s): s is string => s !== null))];
    const staff = await this.prisma.staff_users.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, full_name: true },
    });
    const staffName = new Map(staff.map((s) => [s.id, s.full_name]));

    return {
      ...this.summary(row),
      serviceType: row.service_type,
      payerName: row.payer_user_name,
      payerPhone: row.payer_phone,
      orderStatus: row.order_status,
      canApprove: verdict.ok,
      canReject: canDecide,
      // True when approving would be a late approval (the hold lapsed before staff got to it).
      approveIsLate: verdict.ok && verdict.late,
      approveBlockedReason: verdict.ok ? null : verdict.message,
      reviews: history.map((h) => ({
        action: h.action,
        staffName: h.actor_staff_id ? (staffName.get(h.actor_staff_id) ?? null) : null,
        reason: h.reason,
        at: h.occurred_at,
      })),
    };
  }

  async approve(id: string, staffId: string, meta: RequestMeta) {
    let settled: IntentRow;
    let late = false;
    try {
      settled = await this.prisma.$transaction(async (tx) => {
        const row = await this.load(tx, id, true);
        const verdict = await this.evaluateApprove(tx, row);
        if (!verdict.ok) throw new AppError('INVALID_STATE_TRANSITION', verdict.message);
        late = verdict.late;

        const now = new Date();
        const gatewayPaymentId = `bank_transfer_${row.id}`;
        if (row.payable_type === 'CONTRACT_CYCLE' && row.cycle_id) {
          await this.contracts.settleCycleIntentTx(tx, row.id, row.cycle_id, gatewayPaymentId, now);
        } else {
          await this.orders.settleOrderIntentTx(tx, row.id, row.order_id, gatewayPaymentId, now);
        }

        await this.audit.logStaff(
          {
            staffId,
            action: late ? 'payment.approved_late' : 'payment.approved',
            entityType: PAYMENT_ENTITY,
            entityId: row.id,
            entityReference: row.order_reference,
            before: { status: row.status },
            after: { status: 'PAID', late },
            reason: late ? 'Approved after the payment hold expired' : null,
            ...meta,
          },
          tx,
        );
        await this.notifications.create(await this.approvedNotifications(tx, row), tx);
        return row;
      });
    } catch (e) {
      // ux_intents_order_live: another live or paid intent for the same order slipped in.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('INVALID_STATE_TRANSITION', 'This order already has another live or paid payment');
      }
      throw e;
    }

    // The money is recorded; a failure issuing the invoice must not turn a committed approval into an error.
    try {
      if (settled.payable_type === 'CONTRACT_CYCLE' && settled.cycle_id) {
        await this.contracts.finishCycleSettlement(settled.cycle_id);
      } else {
        await this.orders.finishOrderSettlement(settled.order_id);
      }
    } catch (e) {
      this.logger.error(
        `Payment ${id} approved but post-settlement (invoice/contract) failed`,
        e instanceof Error ? e.stack : String(e),
      );
    }
    return this.get(id);
  }

  async reject(id: string, staffId: string, reason: string, meta: RequestMeta) {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.load(tx, id, true);
      if (row.method !== 'BANK_TRANSFER') {
        throw new AppError('BUSINESS_RULE_VIOLATION', 'Only bank transfers are verified here');
      }
      if (!LIVE.includes(row.status)) {
        throw new AppError('INVALID_STATE_TRANSITION', `Payment is already ${row.status.toLowerCase()}`);
      }

      // The customer must have time to send a corrected transfer: payment-expiry.service.ts voids the
      // order once a FAILED intent is past expires_at and nothing newer is live, so the hold restarts.
      const retryUntil = new Date(Date.now() + bankTransferHoldMs());
      await tx.payment_intents.update({
        where: { id },
        data: { status: 'FAILED', failure_code: REJECTED_CODE, failure_message: reason, expires_at: retryUntil },
      });
      await this.audit.logStaff(
        {
          staffId,
          action: 'payment.rejected',
          entityType: PAYMENT_ENTITY,
          entityId: id,
          entityReference: row.order_reference,
          before: { status: row.status },
          after: { status: 'FAILED', failureCode: REJECTED_CODE },
          reason,
          ...meta,
        },
        tx,
      );
      await this.notifications.create(
        [
          {
            userId: row.payer_user_id,
            organizationId: row.payer_org_id,
            workspace: 'CUSTOMER',
            type: 'payment.rejected',
            category: 'FINANCE',
            titleKey: 'notifications.payment.rejected.title',
            bodyKey: 'notifications.payment.rejected.body',
            params: this.params(row, { reason }),
            deepLink: `logix://orders/${row.order_id}`,
            priority: 'HIGH',
          },
        ],
        tx,
      );
    });
    return this.get(id);
  }

  /** Loads one bank-transfer-capable intent; `lock` takes a row lock held until the transaction ends. */
  private async load(db: Prisma.TransactionClient | PrismaService, id: string, lock = false): Promise<IntentRow> {
    const lockSql = lock ? Prisma.sql`FOR UPDATE OF pi` : Prisma.empty;
    const rows = await db.$queryRaw<IntentRow[]>`
      SELECT ${COLUMNS} ${FROM} WHERE pi.id = ${id}::uuid ${lockSql}`;
    if (rows.length === 0) throw new AppError('NOT_FOUND', 'Payment not found');
    return rows[0];
  }

  /** Whether approving is allowed now, and whether it would be a late approval. */
  private async evaluateApprove(db: Prisma.TransactionClient | PrismaService, row: IntentRow): Promise<Verdict> {
    if (row.method !== 'BANK_TRANSFER') {
      return { ok: false, message: 'Only bank transfers are verified here' };
    }
    const late = row.status === 'EXPIRED';
    if (!LIVE.includes(row.status) && !late) {
      return { ok: false, message: `Payment is already ${row.status.toLowerCase()}` };
    }

    if (row.payable_type === 'CONTRACT_CYCLE' && row.cycle_id) {
      if (row.cycle_status !== 'DUE' && row.cycle_status !== 'OVERDUE') {
        return { ok: false, message: `The cycle is ${(row.cycle_status ?? 'unknown').toLowerCase()}` };
      }
      const other = await db.payment_intents.count({
        where: { contract_cycle_id: row.cycle_id, id: { not: row.id }, status: 'PAID' },
      });
      if (other > 0) return { ok: false, message: 'This cycle is already paid by another payment' };
    } else {
      // A VOID order was already released back to the market and can't be revived.
      if (row.order_status !== 'PENDING_PAYMENT') {
        return { ok: false, message: `The order is ${row.order_status.toLowerCase()}, not awaiting payment` };
      }
      const other = await db.payment_intents.count({
        where: { order_id: row.order_id, id: { not: row.id }, status: { in: ['INITIATED', 'PENDING', 'PAID'] } },
      });
      if (other > 0) return { ok: false, message: 'This order already has another live or paid payment' };
    }
    return { ok: true, late };
  }

  private async approvedNotifications(tx: Prisma.TransactionClient, row: IntentRow): Promise<NewNotification[]> {
    const isCycle = row.payable_type === 'CONTRACT_CYCLE';
    const members = await tx.memberships.findMany({
      where: { organization_id: row.provider_org_id, status: 'ACTIVE' },
      select: { user_id: true },
    });
    const deepLink = `logix://orders/${row.order_id}`;
    return [
      {
        userId: row.payer_user_id,
        organizationId: row.payer_org_id,
        workspace: 'CUSTOMER',
        type: 'payment.approved',
        category: 'FINANCE',
        titleKey: 'notifications.payment.approved.title',
        bodyKey: 'notifications.payment.approved.body',
        params: this.params(row),
        deepLink,
        priority: 'HIGH',
      },
      ...members.map(
        (m): NewNotification => ({
          userId: m.user_id,
          organizationId: row.provider_org_id,
          workspace: 'PROVIDER',
          type: isCycle ? 'contract.cycle_paid' : 'order.confirmed',
          category: 'ORDERS',
          titleKey: isCycle ? 'notifications.contract.cycle_paid.title' : 'notifications.order.confirmed.title',
          bodyKey: isCycle ? 'notifications.contract.cycle_paid.body' : 'notifications.order.confirmed.body',
          params: this.params(row),
          deepLink,
          priority: 'NORMAL',
        }),
      ),
    ];
  }

  private params(row: IntentRow, extra: Prisma.InputJsonObject = {}): Prisma.InputJsonObject {
    return {
      orderReference: row.order_reference,
      amountHalalas: Number(row.amount),
      ...(row.cycle_no !== null ? { cycleNo: row.cycle_no } : {}),
      ...extra,
    };
  }

  private summary(r: IntentRow) {
    return {
      id: r.id,
      paymentType: r.payable_type === 'CONTRACT_CYCLE' ? 'CONTRACT_CYCLE' : 'ORDER',
      status: r.status,
      verificationStatus: verificationStatus(r.status),
      amountHalalas: Number(r.amount),
      currency: r.currency,
      orderId: r.order_id,
      orderReference: r.order_reference,
      cycleNo: r.cycle_no,
      customerName: r.customer_name,
      createdAt: r.created_at,
      paidAt: r.paid_at,
      expiresAt: r.expires_at,
      failureCode: r.failure_code,
      failureMessage: r.failure_message,
    };
  }
}
