import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ReferenceGenerator } from '../../common/references/reference-generator';
import { InvoicesService } from './invoices.service';
import { OrderProgressService } from './order-progress.service';
import { cancellationQuote, cancellationTier } from './cancellation-policy';
import { AUTO_RECEIPT_HOURS, PAYOUT_BUSINESS_DAYS, addBusinessDays, releaseSettlementHold } from './settlement-release';

const PAYMENT_HOLD_MINUTES = 30;

interface OrderFlags {
  receiptConfirmed: boolean;
  rated: boolean;
  finalReached: boolean;
}

/**
 * S4 — Accept, pay and order (backend/md/12-execution-plan.md S4 scope;
 * full ledger/invoicing/settlements/payouts are later slices, not here —
 * see backend/md/modules/12-payments-finance.md for that larger picture).
 *
 * Gateway: D-05 isn't decided, so this is the `FakeGatewayAdapter` the
 * plan calls for — `POST /payment-intents/:id/simulate` stands in for
 * "complete 3DS in a web view, gateway calls our webhook, we verify
 * server-to-server". A real gateway swaps the simulate endpoint for a
 * webhook handler; the business logic in `_settlePayment` below is
 * exactly what that webhook would call.
 *
 * Money columns use the same custom Postgres domains (core.halalas,
 * core.bps, core.currency_code) that broke Prisma's parameter binding in
 * S3 (quotes.service.ts) — every write here goes through raw SQL with
 * explicit casts from the start.
 *
 * The 30-minute payment hold (`PAYMENT_HOLD_MINUTES`) is enforced by
 * payment-expiry.service.ts's worker-only cron: an unpaid intent past
 * `expires_at` is marked EXPIRED, its order VOID, and the quote/request
 * reopened (or expired too, if their own windows closed meanwhile) —
 * otherwise a customer who never pays blocks everyone else from
 * accepting a different quote on that request forever.
 *
 * After payment: the provider records progress (order-progress.service.ts)
 * and completes the order once the final step is recorded. Completing holds
 * the provider's settlement until the customer confirms receipt (or
 * AUTO_RECEIPT_HOURS pass — auto-receipt.service.ts); it is then payable
 * PAYOUT_BUSINESS_DAYS business days later.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: ReferenceGenerator,
    private readonly progress: OrderProgressService,
    private readonly invoices: InvoicesService,
  ) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  private async requireCustomerOrder(userId: string, orderId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const membership = await this.prisma.memberships.findFirst({
      where: { user_id: userId, organization_id: order.customer_org_id, status: 'ACTIVE' },
    });
    if (!membership) throw new AppError('FORBIDDEN', 'Not the customer on this order');
    return order;
  }

  async acceptQuote(userId: string, quoteId: string) {
    const quote = await this.prisma.quotes.findUnique({
      where: { id: quoteId },
      include: { service_requests: true },
    });
    if (!quote) throw new AppError('NOT_FOUND', 'Quote not found');
    const request = quote.service_requests;
    await this.requireMembership(request.customer_org_id, userId);

    // Idempotent: accepting again returns the existing LIVE order together
    // with a payable intent — a VOID order (payment-expiry.service.ts)
    // doesn't count, it's a dead attempt; the DB's partial unique index
    // (migrations/009) only blocks a second *live* order per quote/request.
    // An order still waiting for payment whose last intent failed or
    // expired gets a fresh intent, which is how "retry payment" works.
    const existingOrder = await this.prisma.orders.findFirst({
      where: { accepted_quote_id: quoteId, status: { not: 'VOID' } },
    });
    if (existingOrder) {
      let intent = await this.prisma.payment_intents.findFirst({
        where: { order_id: existingOrder.id },
        orderBy: { created_at: 'desc' },
      });
      if (existingOrder.status === 'PENDING_PAYMENT' && (!intent || ['FAILED', 'EXPIRED', 'CANCELLED'].includes(intent.status))) {
        const intentId = await this.createPaymentIntent(existingOrder.id, existingOrder.customer_org_id, userId, existingOrder.total_amount, existingOrder.currency);
        intent = await this.prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } });
      }
      return {
        order: await this.serializeOrder(existingOrder.id),
        paymentIntent: intent ? await this.serializePaymentIntent(intent.id) : null,
      };
    }

    if (quote.status !== 'SUBMITTED') {
      throw new AppError('QUOTE_EXPIRED', 'This quote is no longer available');
    }
    if (quote.valid_until < new Date()) {
      throw new AppError('QUOTE_EXPIRED', 'This quote has expired');
    }
    if (!['SUBMITTED', 'QUOTED'].includes(request.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'This request is not awaiting acceptance');
    }

    const rule = await this.prisma.commission_rules.findFirst({
      where: { category: quote.commission_category, effective_to: null },
      orderBy: { effective_from: 'desc' },
    });
    if (!rule) throw new AppError('BUSINESS_RULE_VIOLATION', 'No active commission rule');

    const orderId = randomUUID();
    // Its own reference, not request.reference — a request can get more
    // than one order attempt now (payment-expiry.service.ts voids one and
    // reopens the quote/request), and orders.reference is unique, so a
    // second attempt reusing the request's reference would collide with
    // the first (dead) order that already holds it.
    const orderReference = await this.refs.next('LX');

    await this.prisma.$transaction([
      this.prisma.quotes.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED_PENDING_PAYMENT' },
      }),
      this.prisma.service_requests.update({
        where: { id: request.id },
        data: { status: 'AWAITING_PAYMENT' },
      }),
      this.prisma.$executeRaw`
        INSERT INTO svc.orders (
          id, reference, service_type, request_id, accepted_quote_id,
          customer_org_id, provider_org_id, status, currency,
          service_fee, charges_total, subtotal, vat_rate_bps, vat_amount, total_amount,
          commission_category, commission_rule_id, commission_rate_bps,
          commission_amount, commission_vat_amount, net_to_provider
        ) VALUES (
          ${orderId}::uuid, ${orderReference}, ${request.service_type}::core.service_type,
          ${request.id}::uuid, ${quoteId}::uuid,
          ${request.customer_org_id}::uuid, ${quote.provider_org_id}::uuid,
          'PENDING_PAYMENT'::core.order_status, ${quote.currency}::core.currency_code,
          ${quote.service_fee}::core.halalas, ${quote.charges_total}::core.halalas,
          ${quote.subtotal}::core.halalas, ${quote.vat_rate_bps}::core.bps,
          ${quote.vat_amount}::core.halalas, ${quote.total_amount}::core.halalas,
          ${quote.commission_category}::core.commission_category, ${rule.id}::uuid,
          ${quote.commission_rate_bps_preview}::core.bps, ${quote.commission_amount_preview}::core.halalas,
          ${quote.commission_vat_preview}::core.halalas, ${quote.net_to_provider_preview}::core.halalas
        )
      `,
    ]);

    const intentId = await this.createPaymentIntent(orderId, request.customer_org_id, userId, quote.total_amount, quote.currency);

    return {
      order: await this.serializeOrder(orderId),
      paymentIntent: await this.serializePaymentIntent(intentId),
    };
  }

  private async createPaymentIntent(
    orderId: string,
    payerOrgId: string,
    userId: string,
    amount: bigint,
    currency: string,
  ): Promise<string> {
    const intentId = randomUUID();
    const expiresAt = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60 * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO fin.payment_intents (
        id, payable_type, order_id, payer_org_id, payer_user_id,
        amount, currency, method, gateway, status, expires_at
      ) VALUES (
        ${intentId}::uuid, 'ORDER'::core.payable_type, ${orderId}::uuid,
        ${payerOrgId}::uuid, ${userId}::uuid,
        ${amount}::core.halalas, ${currency}::core.currency_code,
        'CARD'::core.payment_method, 'fake', 'INITIATED'::core.payment_intent_status, ${expiresAt}::timestamptz
      )
    `;
    return intentId;
  }

  async getPaymentIntent(userId: string, intentId: string) {
    const intent = await this.prisma.payment_intents.findUnique({ where: { id: intentId } });
    if (!intent) throw new AppError('NOT_FOUND', 'Payment intent not found');
    await this.requireMembership(intent.payer_org_id, userId);
    return this.serializePaymentIntent(intentId);
  }

  /** Fake-gateway stand-in for the real webhook — see class doc. */
  async simulatePayment(userId: string, intentId: string, outcome: 'succeed' | 'fail') {
    const intent = await this.prisma.payment_intents.findUnique({ where: { id: intentId } });
    if (!intent) throw new AppError('NOT_FOUND', 'Payment intent not found');
    await this.requireMembership(intent.payer_org_id, userId);
    if (intent.status !== 'INITIATED' && intent.status !== 'PENDING') {
      throw new AppError('INVALID_STATE_TRANSITION', `Payment already ${intent.status}`);
    }

    if (outcome === 'fail') {
      await this.prisma.payment_intents.update({
        where: { id: intentId },
        data: { status: 'FAILED', failure_code: 'simulated_decline' },
      });
      return this.serializePaymentIntent(intentId);
    }

    await this._settlePayment(intent.id);
    return this.serializePaymentIntent(intentId);
  }

  /** What a real gateway's webhook handler would call after
   * server-to-server `retrievePayment` confirms success. */
  private async _settlePayment(intentId: string): Promise<void> {
    const intent = await this.prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } });
    if (!intent.order_id) return; // only ORDER payables exist so far

    const order = await this.prisma.orders.findUniqueOrThrow({ where: { id: intent.order_id } });
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.payment_intents.update({
        where: { id: intentId },
        data: { status: 'PAID', paid_at: now, gateway_payment_id: `fake_${intentId}` },
      }),
      this.prisma.orders.update({
        where: { id: order.id },
        data: { status: 'CONFIRMED', payment_status: 'PAID', confirmed_at: now, last_update_at: now },
      }),
      this.prisma.quotes.update({
        where: { id: order.accepted_quote_id },
        data: { status: 'ACCEPTED', accepted_at: now },
      }),
      this.prisma.service_requests.update({
        where: { id: order.request_id },
        data: { status: 'CONVERTED' },
      }),
    ]);

    // Every other live quote on this request is now moot.
    await this.prisma.quotes.updateMany({
      where: { request_id: order.request_id, status: 'SUBMITTED' },
      data: { status: 'NOT_SELECTED' },
    });

    await this.invoices.issueForOrderSafely(order.id);
  }

  async confirmReadiness(userId: string, orderId: string, organizationId: string) {
    await this.requireMembership(organizationId, userId);
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    if (order.provider_org_id !== organizationId) {
      throw new AppError('FORBIDDEN', 'Not the provider on this order');
    }
    if (order.status !== 'CONFIRMED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Order is not awaiting readiness confirmation');
    }
    await this.prisma.orders.update({
      where: { id: orderId },
      data: { status: 'SCHEDULED', scheduled_at: new Date(), last_update_at: new Date() },
    });
    return this.serializeOrder(orderId);
  }

  /**
   * Provider marks the service done (client round 1, item 14). Only once the
   * final step (delivery / release) is recorded. The order closes and the
   * provider's settlement is created ON_HOLD until the customer confirms
   * receipt. Idempotent: a second call returns the order without a second settlement.
   */
  async completeOrder(userId: string, orderId: string, organizationId: string) {
    await this.requireMembership(organizationId, userId);
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    if (order.provider_org_id !== organizationId) {
      throw new AppError('FORBIDDEN', 'Not the provider on this order');
    }
    if (order.status === 'COMPLETED') return this.serializeOrder(orderId);
    if (!['SCHEDULED', 'IN_PROGRESS', 'ACTIVE'].includes(order.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Order is not in progress');
    }
    const progress = await this.progress.get(orderId, order.service_type);
    if (!progress.finalReached) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Record the final delivery step before completing the order');
    }

    // fin.settlements requires STL- followed by 7+ digits; the generator gives 6, so pad one zero.
    const reference = 'STL-0' + (await this.refs.next('STL')).slice(4);
    // Matches ck_settlement_net: net = gross - commission - commission VAT.
    const settlementNet = order.service_fee - order.commission_amount - order.commission_vat_amount;
    const now = new Date();
    const autoReceiptAt = new Date(now.getTime() + AUTO_RECEIPT_HOURS * 60 * 60 * 1000);
    const provisionalPayableOn = addBusinessDays(autoReceiptAt, PAYOUT_BUSINESS_DAYS);

    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE svc.orders
        SET status = 'COMPLETED'::core.order_status, completed_at = ${now}::timestamptz,
            auto_accept_at = ${autoReceiptAt}::timestamptz, last_update_at = ${now}::timestamptz,
            settlement_status = 'ON_HOLD'::core.settlement_status
        WHERE id = ${orderId}::uuid
      `,
      this.prisma.$executeRaw`
        INSERT INTO fin.settlements (
          id, reference, beneficiary_org_id, beneficiary_role, order_id, commission_rule_id,
          gross_amount, commission_rate_bps, commission_amount, commission_vat_amount, net_amount,
          eligible_at, payable_on, status, hold_reason, held_at, version, created_at, updated_at
        ) VALUES (
          ${randomUUID()}::uuid, ${reference}, ${order.provider_org_id}::uuid, 'PROVIDER'::core.beneficiary_role,
          ${orderId}::uuid, ${order.commission_rule_id}::uuid,
          ${order.service_fee}::core.halalas, ${order.commission_rate_bps}::core.bps,
          ${order.commission_amount}::core.halalas, ${order.commission_vat_amount}::core.halalas,
          ${settlementNet}::core.halalas,
          ${autoReceiptAt}::timestamptz, ${provisionalPayableOn}::date, 'ON_HOLD'::core.settlement_status,
          'AWAITING_RECEIPT', ${now}::timestamptz, 1, now(), now()
        )
      `,
      this.prisma.order_events.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          event_type: 'COMPLETED',
          from_status: order.status,
          to_status: 'COMPLETED',
          source: 'PROVIDER',
          actor_user_id: userId,
          occurred_at: now,
        },
      }),
      this.prisma.organizations.update({
        where: { id: order.provider_org_id },
        data: { completed_jobs_count: { increment: 1 } },
      }),
    ]);
    return this.serializeOrder(orderId);
  }

  async feed(userId: string, organizationId: string, role: 'customer' | 'provider', status?: string) {
    await this.requireMembership(organizationId, userId);
    const where =
      role === 'customer'
        ? { customer_org_id: organizationId }
        : { provider_org_id: organizationId };
    const rows = await this.prisma.orders.findMany({
      where: { ...where, status: status ? (status as never) : undefined },
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        organizations_orders_customer_org_idToorganizations: { select: { display_name: true } },
        organizations_orders_provider_org_idToorganizations: { select: { display_name: true } },
      },
    });
    const flags = await this.loadFlags(rows);
    return rows.map((o) => this.serializeOrderRow(o, role, flags.get(o.id)!));
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const membership = await this.prisma.memberships.findFirst({
      where: {
        user_id: userId,
        organization_id: { in: [order.customer_org_id, order.provider_org_id] },
        status: 'ACTIVE',
      },
    });
    if (!membership) throw new AppError('FORBIDDEN', 'Not a party to this order');
    const role = membership.organization_id === order.customer_org_id ? 'customer' : 'provider';
    return this.serializeOrder(orderId, role);
  }

  async getOrderByReference(userId: string, reference: string) {
    const order = await this.prisma.orders.findUnique({ where: { reference } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    return this.getOrder(userId, order.id);
  }

  /** Either party's view of how far the order has got. */
  async getProgress(userId: string, orderId: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const membership = await this.prisma.memberships.findFirst({
      where: {
        user_id: userId,
        organization_id: { in: [order.customer_org_id, order.provider_org_id] },
        status: 'ACTIVE',
      },
    });
    if (!membership) throw new AppError('FORBIDDEN', 'Not a party to this order');
    return this.serializeProgress(await this.progress.get(orderId, order.service_type), order.status);
  }

  async recordMilestone(userId: string, orderId: string, organizationId: string, code: string, note?: string) {
    const progress = await this.progress.recordMilestone(userId, orderId, organizationId, code, note);
    const order = await this.prisma.orders.findUniqueOrThrow({ where: { id: orderId } });
    return this.serializeProgress(progress, order.status);
  }

  getInvoice(userId: string, orderId: string) {
    return this.invoices.getForOrder(userId, orderId);
  }

  private serializeProgress(p: Awaited<ReturnType<OrderProgressService['get']>>, orderStatus: string) {
    return {
      serviceType: p.serviceType,
      orderStatus,
      steps: p.steps.map((s) => ({ code: s.code, done: s.done, occurredAt: s.occurredAt })),
      currentCode: p.currentCode,
      finalReached: p.finalReached,
      lastUpdateAt: p.lastUpdateAt,
    };
  }

  /** Receipt/rating/final-step state for a batch of orders — a few queries, not one per order. */
  private async loadFlags(orders: { id: string; service_type: string }[]): Promise<Map<string, OrderFlags>> {
    const ids = orders.map((o) => o.id);
    if (ids.length === 0) return new Map();
    const [receipts, ratings, finals] = await Promise.all([
      this.prisma.receipt_confirmations.findMany({ where: { order_id: { in: ids } }, select: { order_id: true } }),
      this.prisma.ratings.findMany({ where: { order_id: { in: ids } }, select: { order_id: true } }),
      this.progress.finalReachedIds(orders),
    ]);
    const receiptIds = new Set(receipts.map((r) => r.order_id));
    const ratedIds = new Set(ratings.map((r) => r.order_id));
    return new Map(
      ids.map((id) => [
        id,
        { receiptConfirmed: receiptIds.has(id), rated: ratedIds.has(id), finalReached: finals.has(id) },
      ]),
    );
  }

  private allowedActions(status: string, role: 'customer' | 'provider', flags: OrderFlags): string[] {
    if (role === 'provider') {
      if (status === 'CONFIRMED') return ['confirm_readiness', 'update_progress'];
      if (['SCHEDULED', 'IN_PROGRESS', 'ACTIVE'].includes(status)) {
        return flags.finalReached ? ['update_progress', 'complete_order'] : ['update_progress'];
      }
      return [];
    }
    if (status === 'PENDING_PAYMENT') return ['pay'];
    if (['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'ACTIVE'].includes(status)) return ['cancel'];
    if (status === 'COMPLETED') {
      if (!flags.receiptConfirmed) return ['confirm_receipt'];
      if (!flags.rated) return ['rate'];
    }
    return [];
  }

  private async serializeOrder(orderId: string, role: 'customer' | 'provider' = 'customer') {
    const o = await this.prisma.orders.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        organizations_orders_customer_org_idToorganizations: { select: { display_name: true } },
        organizations_orders_provider_org_idToorganizations: { select: { display_name: true } },
        payment_intents: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });
    const req = o.request_id
      ? await this.prisma.service_requests.findUnique({
          where: { id: o.request_id },
          select: { origin_summary: true, destination_summary: true },
        })
      : null;
    const flags = (await this.loadFlags([o])).get(o.id)!;
    return {
      id: o.id,
      reference: o.reference,
      serviceType: o.service_type,
      acceptedQuoteId: o.accepted_quote_id,
      status: o.status,
      paymentStatus: o.payment_status,
      customerName: o.organizations_orders_customer_org_idToorganizations.display_name,
      providerName: o.organizations_orders_provider_org_idToorganizations.display_name,
      totalAmountHalalas: Number(o.total_amount),
      vatAmountHalalas: Number(o.vat_amount),
      serviceFeeHalalas: Number(o.service_fee),
      chargesHalalas: Number(o.charges_total),
      confirmedAt: o.confirmed_at,
      scheduledAt: o.scheduled_at,
      completedAt: o.completed_at,
      createdAt: o.created_at,
      lastUpdateAt: o.last_update_at,
      currentMilestone: o.current_milestone_code,
      receiptConfirmed: flags.receiptConfirmed,
      rated: flags.rated,
      latestPaymentIntentId: o.payment_intents[0]?.id ?? null,
      allowedActions: this.allowedActions(o.status, role, flags),
      originSummary: req?.origin_summary ?? null,
      destinationSummary: req?.destination_summary ?? null,
    };
  }

  /**
   * Customer confirms they got the goods/service (client workflow: net
   * proceeds are transferred after completion and the customer's receipt).
   * Only the "all fine" outcome lives here; shortage/damage goes through a
   * report (cases), which needs photos. Idempotent.
   */
  async receiptOrder(userId: string, orderId: string, input: { recipientName?: string; notes?: string }) {
    const order = await this.requireCustomerOrder(userId, orderId);
    if (order.status !== 'COMPLETED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'The provider has not completed this order yet');
    }
    const existing = await this.prisma.receipt_confirmations.findFirst({ where: { order_id: orderId } });
    if (existing) return { orderId, received: true, confirmedAt: existing.confirmed_at };

    const now = new Date();
    const consent = await this.prisma.consents.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        organization_id: order.customer_org_id,
        workspace: 'CUSTOMER',
        consent_key: 'RECEIPT_CONFIRMATION',
        context_type: 'order',
        context_id: orderId,
        context_reference: order.reference,
      },
    });
    await this.prisma.$transaction([
      this.prisma.receipt_confirmations.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          condition: 'INTACT',
          recipient_name: input.recipientName?.trim() || null,
          notes: input.notes?.trim() || null,
          is_auto: false,
          confirmed_by_user_id: userId,
          consent_id: consent.id,
          confirmed_at: now,
        },
      }),
      this.prisma.orders.update({ where: { id: orderId }, data: { accepted_at: now, last_update_at: now } }),
    ]);
    await releaseSettlementHold(this.prisma, orderId, now);
    return { orderId, received: true, confirmedAt: now };
  }

  /** One rating per order, only from the customer, only once the order is completed. */
  async rateOrder(userId: string, orderId: string, stars: number, notes?: string) {
    const order = await this.requireCustomerOrder(userId, orderId);
    if (order.status !== 'COMPLETED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'You can rate an order once it is completed');
    }
    const existing = await this.prisma.ratings.findFirst({ where: { order_id: orderId } });
    if (existing) return { orderId, stars: existing.stars, noted: !!existing.comment };

    await this.prisma.ratings.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        rater_org_id: order.customer_org_id,
        rater_user_id: userId,
        ratee_org_id: order.provider_org_id,
        stars,
        comment: notes?.trim() || null,
      },
    });
    await this.prisma.$executeRaw`
      UPDATE org.organizations o
      SET rating_count = s.c, rating_avg = s.a
      FROM (
        SELECT count(*)::int AS c, round(avg(stars)::numeric, 2) AS a
        FROM svc.ratings
        WHERE ratee_org_id = ${order.provider_org_id}::uuid AND status = 'PUBLISHED'::core.rating_status
      ) s
      WHERE o.id = ${order.provider_org_id}::uuid
    `;
    return { orderId, stars, noted: !!notes };
  }

  /** What cancelling would cost right now, by the platform's fee tiers. */
  async cancellationPreview(userId: string, orderId: string) {
    const order = await this.requireCustomerOrder(userId, orderId);
    return this.previewFor(order);
  }

  private async previewFor(order: {
    id: string;
    status: string;
    service_type: string;
    service_fee: bigint;
    charges_total: bigint;
    total_amount: bigint;
  }) {
    const total = Number(order.total_amount);
    const progress = await this.progress.get(order.id, order.service_type);
    const tier = cancellationTier(order.status, order.service_type, progress.doneCodes);
    if (!tier) return { allowed: false, tier: null, feeBps: 0, feeHalalas: 0, refundHalalas: 0, totalHalalas: total };
    const quote = cancellationQuote(tier, Number(order.service_fee) + Number(order.charges_total), total);
    return { allowed: true, ...quote, totalHalalas: total };
  }

  /**
   * Free before the provider accepts: cancelled and refunded on the spot.
   * Any fee tier is recorded and held for staff to decide how the fee is
   * split — the order shows CANCELLATION_REQUESTED until then.
   */
  async cancelOrder(userId: string, orderId: string, input: { reasonCode?: string; note?: string }) {
    const order = await this.requireCustomerOrder(userId, orderId);
    const preview = await this.previewFor(order);
    if (!preview.allowed) {
      throw new AppError('INVALID_STATE_TRANSITION', `Order cannot be cancelled in status ${order.status}`);
    }
    const existingOpen = await this.prisma.cancellation_requests.findFirst({
      where: { order_id: orderId, status: { in: ['REQUESTED', 'UNDER_REVIEW'] } },
    });
    if (existingOpen) return this.serializeOrder(orderId);

    await this.prisma.consents.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        organization_id: order.customer_org_id,
        workspace: 'CUSTOMER',
        consent_key: 'CANCELLATION_POLICY_ACK',
        context_type: 'order',
        context_id: orderId,
        context_reference: order.reference,
      },
    });

    const now = new Date();
    const free = preview.feeBps === 0;
    const requestId = randomUUID();
    const reason = input.reasonCode?.trim() || 'OTHER';
    const note = input.note?.trim() || null;
    const total = preview.totalHalalas;

    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        INSERT INTO ops.cancellation_requests (
          id, order_id, requester, requested_by_user_id, requested_by_org_id, reason_code, note,
          status_at_request, milestone_at_request, engine_outcome, engine_fee_bps, expected_fee_amount,
          status, decided_fee_amount, refund_amount, fee_to_provider_amount, fee_to_platform_amount, decided_at
        ) VALUES (
          ${requestId}::uuid, ${orderId}::uuid, 'CUSTOMER'::core.cancellation_requester,
          ${userId}::uuid, ${order.customer_org_id}::uuid, ${reason}, ${note},
          ${order.status}, ${order.current_milestone_code},
          'FEE_PERCENT'::core.cancellation_outcome, ${preview.feeBps}::core.bps, ${preview.feeHalalas}::core.halalas,
          ${free ? 'AUTO_APPROVED' : 'REQUESTED'}::core.cancellation_status,
          ${free ? 0 : null}::core.halalas, ${free ? total : null}::core.halalas,
          ${free ? 0 : null}::core.halalas, ${free ? 0 : null}::core.halalas,
          ${free ? now : null}::timestamptz
        )
      `,
      free
        ? this.prisma.orders.update({
            where: { id: orderId },
            data: { status: 'CANCELLED', cancelled_at: now, payment_status: 'REFUNDED', last_update_at: now },
          })
        : this.prisma.orders.update({
            where: { id: orderId },
            data: { status: 'CANCELLATION_REQUESTED', resume_status: order.status, last_update_at: now },
          }),
    ]);
    return this.serializeOrder(orderId);
  }

  private serializeOrderRow(
    o: {
      id: string;
      reference: string;
      service_type: string;
      status: string;
      payment_status: string;
      total_amount: bigint;
      created_at: Date;
      last_update_at: Date | null;
      current_milestone_code: string | null;
      organizations_orders_customer_org_idToorganizations: { display_name: string };
      organizations_orders_provider_org_idToorganizations: { display_name: string };
    },
    role: 'customer' | 'provider',
    flags: OrderFlags,
  ) {
    return {
      id: o.id,
      reference: o.reference,
      serviceType: o.service_type,
      status: o.status,
      paymentStatus: o.payment_status,
      customerName: o.organizations_orders_customer_org_idToorganizations.display_name,
      providerName: o.organizations_orders_provider_org_idToorganizations.display_name,
      totalAmountHalalas: Number(o.total_amount),
      createdAt: o.created_at,
      lastUpdateAt: o.last_update_at,
      currentMilestone: o.current_milestone_code,
      receiptConfirmed: flags.receiptConfirmed,
      rated: flags.rated,
      allowedActions: this.allowedActions(o.status, role, flags),
    };
  }

  private async serializePaymentIntent(intentId: string) {
    const i = await this.prisma.payment_intents.findUniqueOrThrow({ where: { id: intentId } });
    return {
      id: i.id,
      status: i.status,
      amountHalalas: Number(i.amount),
      currency: i.currency,
      gateway: i.gateway,
      orderId: i.order_id,
      expiresAt: i.expires_at,
      paidAt: i.paid_at,
      failureCode: i.failure_code,
    };
  }
}
