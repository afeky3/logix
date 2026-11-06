import { CountriesService } from '../../common/countries/countries.service';
import { ProductsService } from './products.service';

const USER = 'user-1';
const ORG = '11111111-1111-1111-1111-111111111111';

function setup(over: { membership?: { status: string } | null; orgCountry?: string } = {}) {
  const row = (id: string, country: string) => ({
    id,
    name: id,
    unit_price: 100n,
    moq: 1,
    stock_qty: 5,
    country_code: country,
    organizations: { display_name: 'Supplier' },
    product_categories: { slug: 'other', name_ar: 'x', name_en: 'x' },
    product_images: [],
  });
  const prisma = {
    memberships: {
      findUnique: jest.fn(async () => ('membership' in over ? over.membership : { status: 'ACTIVE' })),
    },
    organizations: { findUnique: jest.fn(async () => ({ country_code: over.orgCountry ?? 'EG' })) },
    countries: {
      findFirst: jest.fn(async ({ where }: { where: { code: string } }) => ({ code: where.code })),
      findMany: jest.fn(async ({ where }: { where: { code: { in: string[] } } }) =>
        where.code.in.map((code) => ({ code, name_ar: `ar-${code}`, name_en: `en-${code}` })),
      ),
    },
    products: { findMany: jest.fn(async () => [row('p1', 'EG'), row('p2', 'SA')]) },
  };
  const service = new ProductsService(prisma as never, new CountriesService(prisma as never), {} as never);
  const where = () => (prisma.products.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
  return { service, prisma, where };
}

describe('ProductsService.list country filter', () => {
  it("filters by the active account's country when only organizationId is sent", async () => {
    const t = setup({ orgCountry: 'EG' });
    await t.service.list(USER, { limit: 50, organizationId: ORG });

    expect(t.where()).toMatchObject({ status: 'PUBLISHED', country_code: 'EG' });
  });

  it('lets an explicit country override the account', async () => {
    const t = setup({ orgCountry: 'EG' });
    await t.service.list(USER, { limit: 50, organizationId: ORG, country: 'AE' });

    expect(t.where()).toMatchObject({ country_code: 'AE' });
  });

  it('shows every country for ALL', async () => {
    const t = setup();
    await t.service.list(USER, { limit: 50, organizationId: ORG, country: 'ALL' });

    expect(t.where()).not.toHaveProperty('country_code');
  });

  it('does not filter when the app sends neither (old app versions)', async () => {
    const t = setup();
    await t.service.list(USER, { limit: 50 });

    expect(t.where()).not.toHaveProperty('country_code');
    expect(t.prisma.memberships.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an account the user does not belong to', async () => {
    const t = setup({ membership: null });

    await expect(t.service.list(USER, { limit: 50, organizationId: ORG })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      httpStatus: 403,
    });
    expect(t.prisma.products.findMany).not.toHaveBeenCalled();
  });

  it("puts each product's country and its names on the row", async () => {
    const t = setup();
    const rows = await t.service.list(USER, { limit: 50 });

    expect(rows.map((r) => [r.id, r.countryCode, r.countryNameEn])).toEqual([
      ['p1', 'EG', 'en-EG'],
      ['p2', 'SA', 'en-SA'],
    ]);
  });
});
