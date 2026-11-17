import { KybService } from './kyb.service';
import { businessProfileSchema } from './kyb.controller';

const ORG = 'org-1';
const USER = 'user-1';

const stored = (over: Record<string, unknown> = {}) => ({
  organization_id: ORG, legal_name: 'Old Co', trade_name: 'Old', cr_number: '1010123456', cr_expiry: null, vat_number: '300000000000003',
  contact_phone: '0500000000', contact_email: 'a@b.co', registered_address_id: null, verification_status: 'APPROVED', ...over,
});

function setup(profile: ReturnType<typeof stored> | null, openItem: unknown = null) {
  const queued: unknown[][] = [];
  const audits: Record<string, unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake refers to itself in $transaction
  const prisma: Record<string, any> = {
    memberships: { findUnique: jest.fn(async () => ({ status: 'ACTIVE' })) },
    business_profiles: {
      findUnique: jest.fn(async () => profile),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ verification_status: 'DRAFT', ...data })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...profile, ...data })),
    },
    verification_items: { findFirst: jest.fn(async () => openItem) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const audit = { logUser: jest.fn(async (e: Record<string, unknown>) => void audits.push(e)) };
  const service = new KybService(prisma as never, { getOrThrow: () => 'k' } as never, audit as never);
  jest.spyOn(service, 'queueVerificationItem').mockImplementation(async (...args: unknown[]) => (queued.push(args), { caseId: 'c1' }));
  return { service, prisma, queued, audits };
}

describe('PUT business-profile: null clears, missing stays', () => {
  it('schema: null is accepted for the clearable fields only', () => {
    expect(businessProfileSchema.safeParse({ tradeName: null, vatNumber: null, contactPhone: null, contactEmail: null, crExpiry: null, registeredAddressId: null }).success).toBe(true);
    expect(businessProfileSchema.safeParse({ legalName: null }).success).toBe(false);
    expect(businessProfileSchema.safeParse({ crNumber: null }).success).toBe(false);
  });

  it('sends null to the column and leaves unsent fields alone (undefined)', async () => {
    const t = setup(stored());
    await t.service.putBusinessProfile(ORG, USER, { tradeName: null, contactPhone: null });
    const data = t.prisma.business_profiles.update.mock.calls[0][0].data;
    expect(data.trade_name).toBeNull();
    expect(data.contact_phone).toBeNull();
    expect(data.contact_email).toBeUndefined();
    expect(data.legal_name).toBeUndefined();
  });

  it('a new profile needs legalName and crNumber', async () => {
    await expect(setup(null).service.putBusinessProfile(ORG, USER, { tradeName: 'x' })).rejects.toMatchObject({ httpStatus: 400 });
    const ok = await setup(null).service.putBusinessProfile(ORG, USER, { legalName: 'N', crNumber: '1010123456' });
    expect(ok.legalName).toBe('N');
  });
});

describe('editing an approved business identity sends it back to review', () => {
  it.each([
    ['legalName', { legalName: 'New Co' }, { legalName: { from: 'Old Co', to: 'New Co' } }],
    ['crNumber', { crNumber: '1010999999' }, { crNumber: { from: '1010123456', to: '1010999999' } }],
    ['vatNumber', { vatNumber: '300000000000013' }, { vatNumber: { from: '300000000000003', to: '300000000000013' } }],
  ] as const)('%s: UNDER_REVIEW, review item with from/to, audit with old and new', async (_f, input, changes) => {
    const t = setup(stored());
    await t.service.putBusinessProfile(ORG, USER, input as never);
    expect(t.prisma.business_profiles.update.mock.calls[0][0].data.verification_status).toBe('UNDER_REVIEW');
    expect(t.queued).toHaveLength(1);
    expect(t.queued[0].slice(0, 3)).toEqual([ORG, 'BUSINESS_PROFILE', ORG]);
    expect(t.queued[0][3]).toMatchObject({ autoCheck: { kind: 'PROFILE_CHANGED_AFTER_APPROVAL', changes } });
    expect(t.audits).toHaveLength(1);
    expect(t.audits[0]).toMatchObject({
      action: 'business_profile.changed_after_approval',
      entityId: ORG,
      before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
      after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])),
    });
  });

  it('clearing the VAT number is a change too', async () => {
    const t = setup(stored());
    await t.service.putBusinessProfile(ORG, USER, { vatNumber: null });
    expect(t.queued).toHaveLength(1);
  });

  it('tradeName, contact phone and email never send it back', async () => {
    const t = setup(stored());
    await t.service.putBusinessProfile(ORG, USER, { tradeName: 'Other', contactPhone: '0511111111', contactEmail: 'x@y.co' });
    expect(t.prisma.business_profiles.update.mock.calls[0][0].data.verification_status).toBeUndefined();
    expect(t.queued).toHaveLength(0);
    expect(t.audits).toHaveLength(0);
  });

  it('sending the same values again is not a change', async () => {
    const t = setup(stored());
    await t.service.putBusinessProfile(ORG, USER, { legalName: 'Old Co', crNumber: '1010123456', vatNumber: '300000000000003' });
    expect(t.queued).toHaveLength(0);
  });

  it('a profile not yet approved is not put back: its first review is still ahead', async () => {
    const t = setup(stored({ verification_status: 'SUBMITTED' }));
    await t.service.putBusinessProfile(ORG, USER, { legalName: 'New Co' });
    expect(t.prisma.business_profiles.update.mock.calls[0][0].data.verification_status).toBeUndefined();
    expect(t.queued).toHaveLength(0);
  });

  it('a second edit while the review is open updates the same item and keeps the first "from"', async () => {
    const open = { auto_check_result: { kind: 'PROFILE_CHANGED_AFTER_APPROVAL', changes: { legalName: { from: 'Original', to: 'Old Co' } } } };
    const t = setup(stored({ verification_status: 'UNDER_REVIEW' }), open);
    await t.service.putBusinessProfile(ORG, USER, { legalName: 'Newest Co' });
    expect(t.queued[0][3]).toMatchObject({ autoCheck: { changes: { legalName: { from: 'Original', to: 'Newest Co' } } } });
  });

  it('editing back to the original value leaves nothing to review in that field', async () => {
    const open = { auto_check_result: { changes: { legalName: { from: 'Old Co', to: 'Temp' } } } };
    const t = setup(stored({ verification_status: 'UNDER_REVIEW', legal_name: 'Temp' }), open);
    await t.service.putBusinessProfile(ORG, USER, { legalName: 'Old Co' });
    expect(t.queued[0][3]).toMatchObject({ autoCheck: { changes: {} } });
  });
});
