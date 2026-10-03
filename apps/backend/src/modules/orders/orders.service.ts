import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ReferenceGenerator } from '../../common/references/reference-generator';

const PAYMENT_HOLD_MINUTES = 30;

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
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: ReferenceGenerator,
  ) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  async acceptQuote(userId: string, quoteId: string) {
    const quote = await this.prisma.quotes.findUnique({
      where: { id: quoteId },
      include: { service_requests: true },
    });
    if (!quote) throw new AppError('NOT_FOUND', 'Quote not found');
    const request = quote.service_requests;
    await this.requireMembership(request.customer_org_id, userId);

    // Idempotent: a second accept on an already-accepted quote just
    // returns the existing LIVE order instead of erroring — a VOID one
    // (payment-expiry.service.ts) doesn't count, it's a dead attempt;
    // the DB's partial unique index (migrations/009) only blocks a second
    // *live* order per quote/request, not a VOID one.
    const existingOrder = await this.prisma.orders.findFirst({
      where: { accepted_quote_id: quoteId, status: { not: 'VOID' } },
    });
    if (existingOrder) return this.getOrder(userId, existingOrder.id);

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
    const now = new Date();
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

    const intentId = randomUUID();
    const expiresAt = new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000);
    await this.prisma.$executeRaw`
      INSERT INTO fin.payment_intents (
        id, payable_type, order_id, payer_org_id, payer_user_id,
        amount, currency, method, gateway, status, expires_at
      ) VALUES (
        ${intentId}::uuid, 'ORDER'::core.payable_type, ${orderId}::uuid,
        ${request.customer_org_id}::uuid, ${userId}::uuid,
        ${quote.total_amount}::core.halalas, ${quote.currency}::core.currency_code,
        'CARD'::core.payment_method, 'fake', 'INITIATED'::core.payment_intent_status, ${expiresAt}::timestamptz
      )
    `;

    return {
      order: await this.serializeOrder(orderId),
      paymentIntent: await this.serializePaymentIntent(intentId),
    };
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
        data: { status: 'CONFIRMED', payment_status: 'PAID', confirmed_at: now },
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
      data: { status: 'SCHEDULED', scheduled_at: new Date() },
    });
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
    return rows.map((o) => this.serializeOrderRow(o, role));
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

  private allowedActions(status: string, role: 'customer' | 'provider'): string[] {
    if (role === 'provider' && status === 'CONFIRMED') return ['confirm_readiness'];
    if (role === 'customer' && status === 'PENDING_PAYMENT') return ['pay'];
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
    return {
      id: o.id,
      reference: o.reference,
      serviceType: o.service_type,
      status: o.status,
      paymentStatus: o.payment_status,
      customerName: o.organizations_orders_customer_org_idToorganizations.display_name,
      providerName: o.organizations_orders_provider_org_idToorganizations.display_name,
      totalAmountHalalas: Number(o.total_amount),
      vatAmountHalalas: Number(o.vat_amount),
      confirmedAt: o.confirmed_at,
      scheduledAt: o.scheduled_at,
      completedAt: o.completed_at,
      createdAt: o.created_at,
      latestPaymentIntentId: o.payment_intents[0]?.id ?? null,
      allowedActions: this.allowedActions(o.status, role),
    };
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
      organizations_orders_customer_org_idToorganizations: { display_name: string };
      organizations_orders_provider_org_idToorganizations: { display_name: string };
    },
    role: 'customer' | 'provider',
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
      allowedActions: this.allowedActions(o.status, role),
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
