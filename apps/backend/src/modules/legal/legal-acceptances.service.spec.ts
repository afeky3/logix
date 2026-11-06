import { AppError } from '../../common/errors/app-error';
import { LegalAcceptancesService } from './legal-acceptances.service';

const USER = 'user-1';
const ORG = 'org-customer';
const SUPPLIER = 'org-supplier';
const QUOTE = 'quote-1';
const PRODUCT = 'product-1';
const P = 'PLATFORM_TERMS_INTERMEDIARY' as const;
const N = 'NO_LIABILITY_GOODS_DISPUTES' as const;
const V = 'VENDOR_RETURN_POLICY' as const;
const E = 'ESCROW_PAYMENT_TERMS' as const;
const meta = { ip: '203.0.113.9', userAgent: 'LogixApp/1.4 (Android)', appVersion: '1.4.0', sessionId: 's-1' };

function setup(opts: { policyVersion?: number | null; cr?: string | null; member?: boolean; enforced?: string } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const prisma = {
    quotes: { findUnique: jest.fn(async () => ({ service_requests: { customer_org_id: ORG } })) },
    products: { findUnique: jest.fn(async () => ({ supplier_org_id: SUPPLIER, deleted_at: null })) },
    memberships: {
      findUnique: jest.fn(async () => (opts.member === false ? null : { status: 'ACTIVE', role: 'OWNER' })),
    },
    business_profiles: {
      findUnique: jest.fn(async () => (opts.cr === null ? null : { cr_number: opts.cr ?? '1010101010' })),
    },
    sessions: { findUnique: jest.fn(async () => ({ app_version: '1.3.9' })) },
    legal_acceptances: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        inserted.push(data);
        return { id: data.id, accepted_at: new Date('2026-11-06T09:00:00Z') };
      }),
      findFirst: jest.fn(async () => null as unknown),
    },
  };
  const policies = {
    currentVersion: jest.fn(async () =>
      opts.policyVersion ? { id: 'rpv-' + opts.policyVersion, version: opts.policyVersion } : null,
    ),
  };
  const config = { get: jest.fn(() => opts.enforced ?? true) };
  const service = new LegalAcceptancesService(prisma as never, policies as never, config as never);
  return { service, prisma, inserted };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

const base = { termsVersion: '2026-11-06', locale: 'ar' as const };

describe('LegalAcceptancesService.record', () => {
  it('records server-side facts and a CR snapshot, ignoring nothing from the client', async () => {
    const t = setup();
    const res = await t.service.record(USER, { ...base, context: 'APP_LAUNCH', items: [P, N, N], organizationId: ORG }, meta);

    expect(res).toEqual({ id: expect.any(String), acceptedAt: new Date('2026-11-06T09:00:00Z') });
    expect(t.inserted[0]).toMatchObject({
      user_id: USER,
      organization_id: ORG,
      context: 'APP_LAUNCH',
      items: [P, N], // de-duplicated
      terms_version: '2026-11-06',
      identity_number: '1010101010',
      identity_type: 'CR',
      ip: '203.0.113.9',
      user_agent: 'LogixApp/1.4 (Android)',
      app_version: '1.4.0',
    });
    expect(t.inserted[0]).not.toHaveProperty('accepted_at'); // the database clock sets it
  });

  it('records a null identity (and no type) when the organization has no CR', async () => {
    const t = setup({ cr: null });
    await t.service.record(USER, { ...base, context: 'APP_LAUNCH', items: [P, N], organizationId: ORG }, meta);
    expect(t.inserted[0]).toMatchObject({ identity_number: null, identity_type: null });
  });

  it('falls back to the session app version when no header is sent', async () => {
    const t = setup();
    await t.service.record(USER, { ...base, context: 'APP_LAUNCH', items: [P, N] }, { ...meta, appVersion: null });
    expect(t.inserted[0]).toMatchObject({ app_version: '1.3.9', organization_id: null, identity_number: null });
  });

  it('a quote acceptance takes the customer organization from the quote', async () => {
    const t = setup();
    await t.service.record(USER, { ...base, context: 'ORDER', items: [P, N, E], quoteId: QUOTE }, meta);
    expect(t.inserted[0]).toMatchObject({ organization_id: ORG, quote_id: QUOTE, product_id: null });
  });

  it('refuses a quote acceptance for another organization or by a non-member', async () => {
    const other = setup();
    const err = await failure(
      other.service.record(USER, { ...base, context: 'ORDER', items: [P, N, E], quoteId: QUOTE, organizationId: 'org-x' }, meta),
    );
    expect(err.httpStatus).toBe(422);
    const outsider = setup({ member: false });
    expect((await failure(outsider.service.record(USER, { ...base, context: 'ORDER', items: [P, N, E], quoteId: QUOTE }, meta))).code).toBe('FORBIDDEN');
    expect(outsider.inserted).toHaveLength(0);
  });

  describe('product order and the return-policy version', () => {
    const order = (v: string | null) => ({
      ...base,
      context: 'ORDER' as const,
      items: [P, N, V],
      productId: PRODUCT,
      supplierOrgId: SUPPLIER,
      returnPolicyVersion: v,
    });

    it('links the exact version the buyer saw', async () => {
      const t = setup({ policyVersion: 3 });
      await t.service.record(USER, order('3'), meta);
      expect(t.inserted[0]).toMatchObject({
        product_id: PRODUCT,
        supplier_org_id: SUPPLIER,
        return_policy_version_id: 'rpv-3',
        return_policy_version: '3',
      });
    });

    it.each(['2', null])('answers 422 RETURN_POLICY_OUTDATED for version %p when 3 is current', async (v) => {
      const t = setup({ policyVersion: 3 });
      const err = await failure(t.service.record(USER, order(v), meta));
      expect(err.code).toBe('RETURN_POLICY_OUTDATED');
      expect(err.httpStatus).toBe(422);
      expect(t.inserted).toHaveLength(0);
    });

    it('records no version when the supplier has no policy', async () => {
      const t = setup({ policyVersion: null });
      await t.service.record(USER, order('7'), meta);
      expect(t.inserted[0]).toMatchObject({ return_policy_version_id: null, return_policy_version: null });
    });

    it('refuses a supplier that does not own the product', async () => {
      const t = setup();
      const err = await failure(t.service.record(USER, { ...order(null), supplierOrgId: 'org-other' }, meta));
      expect(err.httpStatus).toBe(422);
      expect(err.details).toEqual([{ field: 'supplierOrgId', code: 'product_mismatch' }]);
    });
  });

  it('two identical calls are two events', async () => {
    const t = setup();
    const a = await t.service.record(USER, { ...base, context: 'APP_LAUNCH', items: [P, N] }, meta);
    const b = await t.service.record(USER, { ...base, context: 'APP_LAUNCH', items: [P, N] }, meta);
    expect(a.id).not.toBe(b.id);
    expect(t.inserted).toHaveLength(2);
  });
});

describe('LegalAcceptancesService.assertQuoteConsent', () => {
  it('answers 422 CONSENT_REQUIRED when nothing is on record', async () => {
    const t = setup();
    const err = await failure(t.service.assertQuoteConsent(USER, QUOTE));
    expect(err.code).toBe('CONSENT_REQUIRED');
    expect(err.httpStatus).toBe(422);
    expect(t.prisma.legal_acceptances.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: USER, context: 'ORDER', quote_id: QUOTE, items: { hasEvery: [P, N, E] } },
      }),
    );
  });

  it('passes once this user accepted for this quote', async () => {
    const t = setup();
    t.prisma.legal_acceptances.findFirst.mockResolvedValueOnce({ id: 'la-1' });
    await expect(t.service.assertQuoteConsent(USER, QUOTE)).resolves.toBeUndefined();
  });

  it('can be switched off by configuration', async () => {
    const t = setup({ enforced: 'false' });
    await expect(t.service.assertQuoteConsent(USER, QUOTE)).resolves.toBeUndefined();
    expect(t.prisma.legal_acceptances.findFirst).not.toHaveBeenCalled();
  });
});

describe('LegalAcceptancesService.platformTerms', () => {
  it('reports the most recent acceptance by time', async () => {
    const t = setup();
    t.prisma.legal_acceptances.findFirst.mockResolvedValueOnce({
      terms_version: '2026-09-01',
      accepted_at: new Date('2026-11-05T10:00:00Z'),
    });
    expect(await t.service.platformTerms(USER)).toEqual({
      acceptedVersion: '2026-09-01',
      acceptedAt: new Date('2026-11-05T10:00:00Z'),
    });
    expect(t.prisma.legal_acceptances.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: USER, context: { in: ['REGISTRATION', 'APP_LAUNCH'] } },
        orderBy: { accepted_at: 'desc' },
      }),
    );
  });

  it('is null before any acceptance', async () => {
    expect(await setup().service.platformTerms(USER)).toEqual({ acceptedVersion: null, acceptedAt: null });
  });
});
