import { CountriesService } from '../../common/countries/countries.service';
import { OrganizationsService } from './organizations.service';

const ORG = 'org-supplier';

function setup(over: { workspaceStatus?: string | null; products?: number; district?: string | null; ratings?: { avg: number | null; count: number }; org?: object | null } = {}) {
  const ws = over.workspaceStatus === undefined ? 'ACTIVE' : over.workspaceStatus;
  const prisma = {
    organizations: {
      findUnique: jest.fn(async () =>
        over.org === null
          ? null
          : {
              id: ORG, display_name: 'Pack Co', logo_file_id: 'logo-1', country_code: 'SA', created_at: new Date('2026-09-01T00:00:00Z'),
              org_workspaces: ws ? [{ status: ws }] : [],
              ...over.org,
            },
      ),
    },
    products: { count: jest.fn(async () => over.products ?? 3) },
    addresses: { findFirst: jest.fn(async () => (over.district === null ? null : { district: over.district ?? 'Al Olaya' })) },
    ratings: { aggregate: jest.fn(async () => ({ _avg: { stars: over.ratings?.avg ?? null }, _count: { _all: over.ratings?.count ?? 0 } })) },
    countries: {
      findFirst: jest.fn(async ({ where }: { where: { code: string } }) => ({ code: where.code })),
      findMany: jest.fn(async () => [{ code: 'SA', name_ar: 'السعودية', name_en: 'Saudi Arabia' }]),
    },
  };
  return { service: new OrganizationsService(prisma as never, new CountriesService(prisma as never)), prisma };
}

describe('GET /organizations/:id/supplier-profile', () => {
  it('returns the agreed fields from what is recorded', async () => {
    const res = await setup().service.getSupplierProfile(ORG);
    expect(res).toEqual({
      organizationId: ORG,
      displayName: 'Pack Co',
      logoFileId: 'logo-1',
      countryCode: 'SA',
      countryNameAr: 'السعودية',
      countryNameEn: 'Saudi Arabia',
      city: 'Al Olaya',
      memberSince: new Date('2026-09-01T00:00:00Z'),
      isVerified: true,
      productsCount: 3,
      completedOrdersCount: null,
      about: null,
    });
  });

  it('counts only published, live products', async () => {
    const t = setup();
    await t.service.getSupplierProfile(ORG);
    expect(t.prisma.products.count).toHaveBeenCalledWith({ where: { supplier_org_id: ORG, status: 'PUBLISHED', deleted_at: null } });
  });

  it('a supplier still waiting for verification is not marked verified', async () => {
    expect((await setup({ workspaceStatus: 'PENDING_VERIFICATION' }).service.getSupplierProfile(ORG)).isVerified).toBe(false);
  });

  it('no rating is shown without ratings: the keys are absent, nothing is made up', async () => {
    const res = await setup().service.getSupplierProfile(ORG);
    expect(res).not.toHaveProperty('ratingAvg');
    expect(res).not.toHaveProperty('ratingCount');
  });

  it('with ratings the average (2 decimals) and the count appear', async () => {
    const res = await setup({ ratings: { avg: 4.3333333, count: 3 } }).service.getSupplierProfile(ORG);
    expect(res).toMatchObject({ ratingAvg: 4.33, ratingCount: 3 });
  });

  it('the city is null when there is no registered address', async () => {
    expect((await setup({ district: null }).service.getSupplierProfile(ORG)).city).toBeNull();
  });

  it('an organization that is not a supplier, or does not exist, is a 404', async () => {
    await expect(setup({ workspaceStatus: null }).service.getSupplierProfile(ORG)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(setup({ org: null }).service.getSupplierProfile(ORG)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('exposes no contacts or documents', async () => {
    const res = await setup().service.getSupplierProfile(ORG);
    for (const k of ['phone', 'email', 'crNumber', 'vatNumber', 'iban', 'members']) expect(res).not.toHaveProperty(k);
  });
});
