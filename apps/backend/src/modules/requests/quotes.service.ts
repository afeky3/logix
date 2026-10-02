import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { quotes } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { Money } from '../../common/money/money';

const VAT_RATE_BPS = 1500; // 15%
const DEFAULT_VALID_HOURS = 48;

/**
 * IMPORTANT: every money/bps column in this schema uses a custom Postgres
 * domain (`core.halalas`, `core.bps`, `core.currency_code` — see
 * migrations/001_init.sql). Prisma's query engine cannot bind values to
 * these as query *parameters* — every INSERT/UPDATE touching one fails
 * with "incorrect binary data format in bind parameter N", confirmed live
 * (reproduced with a minimal `prisma.quotes.create`, fixed by hand-writing
 * the same INSERT with explicit `::core.halalas`/`::core.bps` casts via
 * `$executeRaw`). Reading them back via the typed client is fine — this
 * only affects writes. Any future module touching money (orders, invoices,
 * payments, settlements, ledger) will hit the same thing and needs the
 * same raw-SQL-for-the-write pattern used below.
 */

export interface QuoteInput {
  serviceFeeHalalas: number;
  chargesTotalHalalas?: number;
  etaDate?: string;
  durationDays?: number;
  validHours?: number;
  scopeIncluded?: string;
  exclusions?: string;
  notes?: string;
  internalCostHalalas?: number;
  targetMarginHalalas?: number;
}

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  /** Shared by preview and submit — never persists, just computes. */
  private async compute(input: QuoteInput) {
    const serviceFee = Money.fromHalalas(Math.round(input.serviceFeeHalalas));
    const chargesTotal = Money.fromHalalas(Math.round(input.chargesTotalHalalas ?? 0));
    const subtotal = serviceFee.add(chargesTotal);
    const vatAmount = subtotal.vat(VAT_RATE_BPS);
    const totalAmount = subtotal.add(vatAmount);

    const rule = await this.prisma.commission_rules.findFirst({
      where: { category: 'FREIGHT_TRANSPORT', effective_to: null },
      orderBy: { effective_from: 'desc' },
    });
    const rateBps = rule?.rate_bps ?? 1000;
    const vatOnCommission = rule?.vat_on_commission ?? true;

    const commissionAmount = serviceFee.vat(rateBps); // same half-up % math
    const commissionVat = vatOnCommission ? commissionAmount.vat(VAT_RATE_BPS) : Money.zero();
    // "net before commission taxes" — backend/md/modules/05-requests-quotes-matching.md §3.
    const netToProvider = serviceFee.subtract(commissionAmount);

    return {
      serviceFee,
      chargesTotal,
      subtotal,
      vatAmount,
      totalAmount,
      rateBps,
      commissionAmount,
      commissionVat,
      netToProvider,
    };
  }

  async preview(input: QuoteInput) {
    const c = await this.compute(input);
    return {
      serviceFee: c.serviceFee.toDto(),
      chargesTotal: c.chargesTotal.toDto(),
      subtotal: c.subtotal.toDto(),
      vatAmount: c.vatAmount.toDto(),
      totalAmount: c.totalAmount.toDto(),
      commissionRateBps: c.rateBps,
      commissionAmount: c.commissionAmount.toDto(),
      commissionVat: c.commissionVat.toDto(),
      netToProvider: c.netToProvider.toDto(),
    };
  }

  async submit(userId: string, organizationId: string, requestId: string, input: QuoteInput) {
    await this.requireMembership(organizationId, userId);

    const match = await this.prisma.request_matches.findUnique({
      where: { request_id_provider_org_id: { request_id: requestId, provider_org_id: organizationId } },
    });
    if (!match) {
      throw new AppError('FORBIDDEN', 'This request was not matched to your organization');
    }

    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request || !['SUBMITTED', 'QUOTED'].includes(request.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'This request is not open for quotes');
    }

    const existing = await this.prisma.quotes.findFirst({
      where: { request_id: requestId, provider_org_id: organizationId, status: 'SUBMITTED' },
    });
    if (existing) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'You already have an open quote on this request — revise it instead');
    }

    const c = await this.compute(input);
    const validHours = Math.min(168, Math.max(24, input.validHours ?? DEFAULT_VALID_HOURS));
    const now = new Date();

    const quoteId = randomUUID();
    const validUntil = new Date(now.getTime() + validHours * 60 * 60 * 1000);
    const etaDate = input.etaDate ? new Date(input.etaDate) : null;
    const internalCost = input.internalCostHalalas != null ? BigInt(Math.round(input.internalCostHalalas)) : null;
    const targetMargin = input.targetMarginHalalas != null ? BigInt(Math.round(input.targetMarginHalalas)) : null;

    // Raw SQL — see the class-level comment on why (core.halalas/core.bps domains).
    await this.prisma.$executeRaw`
      INSERT INTO svc.quotes (
        id, request_id, provider_org_id, status, currency,
        service_fee, charges_total, subtotal, vat_rate_bps, vat_amount, total_amount,
        commission_category, commission_rate_bps_preview, commission_amount_preview,
        commission_vat_preview, net_to_provider_preview,
        eta_date, duration_days, valid_until, scope_included, exclusions, notes,
        internal_cost, target_margin, submitted_by_user_id
      ) VALUES (
        ${quoteId}::uuid, ${requestId}::uuid, ${organizationId}::uuid, 'SUBMITTED'::core.quote_status, 'SAR'::core.currency_code,
        ${BigInt(c.serviceFee.halalas)}::core.halalas, ${BigInt(c.chargesTotal.halalas)}::core.halalas, ${BigInt(c.subtotal.halalas)}::core.halalas,
        ${VAT_RATE_BPS}::core.bps, ${BigInt(c.vatAmount.halalas)}::core.halalas, ${BigInt(c.totalAmount.halalas)}::core.halalas,
        'FREIGHT_TRANSPORT'::core.commission_category, ${c.rateBps}::core.bps, ${BigInt(c.commissionAmount.halalas)}::core.halalas,
        ${BigInt(c.commissionVat.halalas)}::core.halalas, ${BigInt(c.netToProvider.halalas)}::core.halalas,
        ${etaDate}::date, ${input.durationDays ?? null}::numeric, ${validUntil}::timestamptz,
        ${input.scopeIncluded ?? null}, ${input.exclusions ?? null}, ${input.notes ?? null},
        ${internalCost}::core.halalas, ${targetMargin}::core.signed_halalas, ${userId}::uuid
      )
    `;
    const quote = await this.prisma.quotes.findUniqueOrThrow({ where: { id: quoteId } });

    await this.prisma.request_matches.update({
      where: { id: match.id },
      data: { quoted_at: now },
    });
    await this.prisma.service_requests.update({
      where: { id: requestId },
      data: {
        status: 'QUOTED',
        quote_count: { increment: 1 },
        first_quote_at: request.first_quote_at ?? now,
      },
    });

    return this.serializeProviderView(quote);
  }

  async revise(userId: string, organizationId: string, quoteId: string, input: QuoteInput) {
    await this.requireMembership(organizationId, userId);
    const existing = await this.prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!existing || existing.provider_org_id !== organizationId) {
      throw new AppError('NOT_FOUND', 'Quote not found');
    }
    if (existing.status !== 'SUBMITTED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only an open quote can be revised');
    }

    const c = await this.compute(input);
    const validHours = Math.min(168, Math.max(24, input.validHours ?? DEFAULT_VALID_HOURS));
    const validUntil = new Date(Date.now() + validHours * 60 * 60 * 1000);
    const etaDate = input.etaDate ? new Date(input.etaDate) : null;

    // Raw SQL — see the class-level comment (core.halalas/core.bps domains).
    await this.prisma.$executeRaw`
      UPDATE svc.quotes SET
        revision = revision + 1,
        service_fee = ${BigInt(c.serviceFee.halalas)}::core.halalas,
        charges_total = ${BigInt(c.chargesTotal.halalas)}::core.halalas,
        subtotal = ${BigInt(c.subtotal.halalas)}::core.halalas,
        vat_amount = ${BigInt(c.vatAmount.halalas)}::core.halalas,
        total_amount = ${BigInt(c.totalAmount.halalas)}::core.halalas,
        commission_rate_bps_preview = ${c.rateBps}::core.bps,
        commission_amount_preview = ${BigInt(c.commissionAmount.halalas)}::core.halalas,
        commission_vat_preview = ${BigInt(c.commissionVat.halalas)}::core.halalas,
        net_to_provider_preview = ${BigInt(c.netToProvider.halalas)}::core.halalas,
        eta_date = ${etaDate}::date,
        duration_days = ${input.durationDays ?? null}::numeric,
        valid_until = ${validUntil}::timestamptz,
        scope_included = ${input.scopeIncluded ?? null},
        exclusions = ${input.exclusions ?? null},
        notes = ${input.notes ?? null},
        updated_at = now()
      WHERE id = ${quoteId}::uuid
    `;
    const quote = await this.prisma.quotes.findUniqueOrThrow({ where: { id: quoteId } });
    return this.serializeProviderView(quote);
  }

  async withdraw(userId: string, organizationId: string, quoteId: string) {
    await this.requireMembership(organizationId, userId);
    const existing = await this.prisma.quotes.findUnique({ where: { id: quoteId } });
    if (!existing || existing.provider_org_id !== organizationId) {
      throw new AppError('NOT_FOUND', 'Quote not found');
    }
    if (existing.status !== 'SUBMITTED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only an open quote can be withdrawn');
    }
    const quote = await this.prisma.quotes.update({
      where: { id: quoteId },
      data: { status: 'WITHDRAWN', withdrawn_at: new Date() },
    });
    return this.serializeProviderView(quote);
  }

  async listForProvider(userId: string, organizationId: string, status?: string) {
    await this.requireMembership(organizationId, userId);
    const rows = await this.prisma.quotes.findMany({
      where: { provider_org_id: organizationId, status: status ? (status as never) : undefined },
      orderBy: { submitted_at: 'desc' },
      include: { service_requests: { select: { reference: true, status: true } } },
    });
    return rows.map((q) => ({ ...this.serializeProviderView(q), requestReference: q.service_requests.reference, requestStatus: q.service_requests.status }));
  }

  /** Customer-facing list — never includes internalCost/targetMargin. */
  async listForCustomer(userId: string, requestId: string, sort?: string) {
    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request) throw new AppError('NOT_FOUND', 'Request not found');
    await this.requireMembership(request.customer_org_id, userId);

    const rows = await this.prisma.quotes.findMany({
      where: { request_id: requestId, status: 'SUBMITTED' },
      include: { organizations: { select: { display_name: true, rating_avg: true, completed_jobs_count: true } } },
    });

    const sorted = [...rows].sort((a, b) => {
      if (sort === 'eta') return (a.eta_date?.getTime() ?? 0) - (b.eta_date?.getTime() ?? 0);
      if (sort === 'rating') return Number(b.organizations.rating_avg ?? 0) - Number(a.organizations.rating_avg ?? 0);
      return Number(a.total_amount) - Number(b.total_amount); // price default
    });

    return sorted.map((q) => this.serializeCustomerView(q));
  }

  async getForCustomer(userId: string, quoteId: string) {
    const quote = await this.prisma.quotes.findUnique({
      where: { id: quoteId },
      include: { organizations: { select: { display_name: true, rating_avg: true, completed_jobs_count: true } }, service_requests: true },
    });
    if (!quote) throw new AppError('NOT_FOUND', 'Quote not found');
    await this.requireMembership(quote.service_requests.customer_org_id, userId);
    return this.serializeCustomerView(quote);
  }

  async compareForCustomer(userId: string, requestId: string, ids: string[]) {
    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request) throw new AppError('NOT_FOUND', 'Request not found');
    await this.requireMembership(request.customer_org_id, userId);

    const rows = await this.prisma.quotes.findMany({
      where: { id: { in: ids }, request_id: requestId },
      include: { organizations: { select: { display_name: true, rating_avg: true, completed_jobs_count: true } } },
    });
    return rows.map((q) => this.serializeCustomerView(q));
  }

  private serializeProviderView(q: quotes) {
    return {
      id: q.id,
      requestId: q.request_id,
      status: q.status,
      revision: q.revision,
      serviceFee: Money.fromHalalas(Number(q.service_fee)).toDto(),
      chargesTotal: Money.fromHalalas(Number(q.charges_total)).toDto(),
      subtotal: Money.fromHalalas(Number(q.subtotal)).toDto(),
      vatAmount: Money.fromHalalas(Number(q.vat_amount)).toDto(),
      totalAmount: Money.fromHalalas(Number(q.total_amount)).toDto(),
      commissionAmountPreview: Money.fromHalalas(Number(q.commission_amount_preview)).toDto(),
      netToProviderPreview: Money.fromHalalas(Number(q.net_to_provider_preview)).toDto(),
      etaDate: q.eta_date,
      durationDays: q.duration_days,
      validUntil: q.valid_until,
      scopeIncluded: q.scope_included,
      exclusions: q.exclusions,
      notes: q.notes,
      submittedAt: q.submitted_at,
    };
  }

  private serializeCustomerView(q: {
    id: string;
    request_id: string;
    provider_org_id: string;
    status: string;
    total_amount: bigint;
    vat_amount: bigint;
    service_fee: bigint;
    charges_total: bigint;
    eta_date: Date | null;
    duration_days: unknown;
    valid_until: Date;
    scope_included: string | null;
    exclusions: string | null;
    organizations: { display_name: string; rating_avg: unknown; completed_jobs_count: number };
  }) {
    return {
      id: q.id,
      requestId: q.request_id,
      status: q.status,
      providerId: q.provider_org_id,
      providerName: q.organizations.display_name,
      providerRating: q.organizations.rating_avg ? Number(q.organizations.rating_avg) : null,
      providerCompletedJobs: q.organizations.completed_jobs_count,
      serviceFee: Money.fromHalalas(Number(q.service_fee)).toDto(),
      chargesTotal: Money.fromHalalas(Number(q.charges_total)).toDto(),
      vatAmount: Money.fromHalalas(Number(q.vat_amount)).toDto(),
      totalAmount: Money.fromHalalas(Number(q.total_amount)).toDto(),
      etaDate: q.eta_date,
      durationDays: q.duration_days,
      validUntil: q.valid_until,
      scopeIncluded: q.scope_included,
      exclusions: q.exclusions,
    };
  }
}
