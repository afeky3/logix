import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import {
  assertItems,
  legalValidation,
  QUOTE_ORDER_ITEMS,
  type LegalContext,
  type LegalItem,
} from './legal.rules';
import { ReturnPoliciesService } from './return-policies.service';

type Tx = Prisma.TransactionClient;

export interface AcceptanceInput {
  termsVersion: string;
  context: LegalContext;
  items: LegalItem[];
  locale: 'ar' | 'en';
  organizationId?: string;
  quoteId?: string;
  productId?: string;
  supplierOrgId?: string;
  returnPolicyVersion?: string | null;
}

/** What the server reads off the connection itself, never from the body. */
export interface AcceptanceMeta {
  ip?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  sessionId?: string | null;
}

@Injectable()
export class LegalAcceptancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: ReturnPoliciesService,
    private readonly config: ConfigService,
  ) {}

  /** POST /me/consents. Each call is its own event (no de-duplication, by design). */
  async record(userId: string, input: AcceptanceInput, meta: AcceptanceMeta) {
    assertItems(input);

    let organizationId = input.organizationId ?? null;
    let returnPolicyVersionId: string | null = null;
    let returnPolicyVersion: string | null = null;

    if (input.quoteId) {
      const quote = await this.prisma.quotes.findUnique({
        where: { id: input.quoteId },
        select: { service_requests: { select: { customer_org_id: true } } },
      });
      if (!quote) throw new AppError('NOT_FOUND', 'Quote not found');
      const customerOrg = quote.service_requests.customer_org_id;
      if (organizationId && organizationId !== customerOrg) {
        throw legalValidation('The quote belongs to another organization', [
          { field: 'organizationId', code: 'quote_mismatch' },
        ]);
      }
      organizationId = customerOrg;
    }

    if (input.productId) {
      const product = await this.prisma.products.findUnique({
        where: { id: input.productId },
        select: { supplier_org_id: true, deleted_at: true },
      });
      if (!product || product.deleted_at) throw new AppError('NOT_FOUND', 'Product not found');
      if (product.supplier_org_id !== input.supplierOrgId) {
        throw legalValidation('supplierOrgId is not the supplier of this product', [
          { field: 'supplierOrgId', code: 'product_mismatch' },
        ]);
      }
      const current = await this.policies.currentVersion(product.supplier_org_id);
      if (current) {
        // Null or an older version: the buyer did not see the text in force now.
        if (input.returnPolicyVersion !== String(current.version)) {
          throw new AppError('RETURN_POLICY_OUTDATED', 'The supplier has changed its return policy', {
            details: [{ field: 'returnPolicyVersion', code: `current_${current.version}` }],
          });
        }
        returnPolicyVersionId = current.id;
        returnPolicyVersion = String(current.version);
      }
    }

    if (organizationId) await this.requireMember(organizationId, userId);

    const appVersion = meta.appVersion ?? (await this.sessionAppVersion(meta.sessionId));
    return this.insert(this.prisma, {
      userId,
      organizationId,
      input,
      returnPolicyVersionId,
      returnPolicyVersion,
      meta: { ...meta, appVersion },
    });
  }

  /** The registration acceptance written inside OTP verify's transaction (no organization yet). */
  async recordRegistration(
    tx: Tx,
    userId: string,
    consents: { termsVersion: string; items: LegalItem[]; locale: 'ar' | 'en' },
    meta: AcceptanceMeta,
  ) {
    const input: AcceptanceInput = { ...consents, context: 'REGISTRATION' };
    assertItems(input);
    return this.insert(tx, {
      userId,
      organizationId: null,
      input,
      returnPolicyVersionId: null,
      returnPolicyVersion: null,
      meta,
    });
  }

  /** GET /me/consents/platform-terms: the most recent by time, not the largest version string. */
  async platformTerms(userId: string) {
    const last = await this.prisma.legal_acceptances.findFirst({
      where: { user_id: userId, context: { in: ['REGISTRATION', 'APP_LAUNCH'] } },
      orderBy: { accepted_at: 'desc' },
      select: { terms_version: true, accepted_at: true },
    });
    return { acceptedVersion: last?.terms_version ?? null, acceptedAt: last?.accepted_at ?? null };
  }

  /** Quote acceptance gate: 422 CONSENT_REQUIRED unless this user recorded an ORDER acceptance
   * for this quote with every required item. CONSENT_REQUIRED_ON_QUOTE_ACCEPT=false turns it off
   * (an escape hatch while older app builds are still in use). */
  async assertQuoteConsent(userId: string, quoteId: string) {
    const enforced = this.config.get<boolean | string>('CONSENT_REQUIRED_ON_QUOTE_ACCEPT');
    if (enforced === false || enforced === 'false') return;
    const found = await this.prisma.legal_acceptances.findFirst({
      where: { user_id: userId, context: 'ORDER', quote_id: quoteId, items: { hasEvery: QUOTE_ORDER_ITEMS } },
      select: { id: true },
    });
    if (!found) {
      throw new AppError('CONSENT_REQUIRED', 'Accept the order terms before accepting this quote', {
        details: QUOTE_ORDER_ITEMS.map((i) => ({ field: 'items', code: `required_${i}` })),
      });
    }
  }

  private async insert(
    db: Tx | PrismaService,
    a: {
      userId: string;
      organizationId: string | null;
      input: AcceptanceInput;
      returnPolicyVersionId: string | null;
      returnPolicyVersion: string | null;
      meta: AcceptanceMeta;
    },
  ) {
    const identity = await this.identitySnapshot(db, a.organizationId);
    const row = await db.legal_acceptances.create({
      data: {
        id: randomUUID(),
        user_id: a.userId,
        organization_id: a.organizationId,
        context: a.input.context,
        items: [...new Set(a.input.items)],
        terms_version: a.input.termsVersion,
        locale: a.input.locale,
        quote_id: a.input.quoteId ?? null,
        product_id: a.input.productId ?? null,
        supplier_org_id: a.input.productId ? (a.input.supplierOrgId ?? null) : null,
        return_policy_version_id: a.returnPolicyVersionId,
        return_policy_version: a.returnPolicyVersion,
        identity_number: identity?.number ?? null,
        identity_type: identity?.type ?? null,
        ip: a.meta.ip ?? null,
        user_agent: a.meta.userAgent?.slice(0, 500) ?? null,
        app_version: a.meta.appVersion?.slice(0, 50) ?? null,
      },
      select: { id: true, accepted_at: true },
    });
    return { id: row.id, acceptedAt: row.accepted_at };
  }

  /** The organization's CR as it stands now. Individuals have no number yet (NATIONAL_ID later). */
  private async identitySnapshot(db: Tx | PrismaService, orgId: string | null) {
    if (!orgId) return null;
    const profile = await db.business_profiles.findUnique({
      where: { organization_id: orgId },
      select: { cr_number: true },
    });
    return profile?.cr_number ? { number: profile.cr_number, type: 'CR' as const } : null;
  }

  private async sessionAppVersion(sessionId?: string | null) {
    if (!sessionId) return null;
    const s = await this.prisma.sessions.findUnique({ where: { id: sessionId }, select: { app_version: true } });
    return s?.app_version ?? null;
  }

  private async requireMember(orgId: string, userId: string) {
    const m = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!m || m.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'Not a member of this organization');
  }
}
