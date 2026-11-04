import { CountriesService } from '../../common/countries/countries.service';
import { OrganizationsService } from './organizations.service';

function setup(role: string | null = 'OWNER', known = ['SA', 'EG']) {
  const prisma = {
    memberships: {
      findUnique: jest.fn(async () => (role ? { status: 'ACTIVE', role } : null)),
    },
    countries: {
      findFirst: jest.fn(async ({ where }: { where: { code: string } }) => (known.includes(where.code) ? { code: where.code } : null)),
      findMany: jest.fn(async ({ where }: { where: { code: { in: string[] } } }) =>
        where.code.in.map((code) => ({ code, name_ar: `ar-${code}`, name_en: `en-${code}` })),
      ),
    },
    organizations: {
      update: jest.fn(async () => ({})),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: data.id,
        kind: data.kind,
        display_name: data.display_name,
        status: 'ACTIVE',
        country_code: data.country_code ?? 'SA',
      })),
    },
  };
  return { service: new OrganizationsService(prisma as never, new CountriesService(prisma as never)), prisma };
}

describe('OrganizationsService country', () => {
  it('creates an account in the given country', async () => {
    const t = setup();
    const org = await t.service.create('user-1', 'BUSINESS', 'Acme', 'eg');

    expect(t.prisma.organizations.create.mock.calls[0][0].data).toMatchObject({ country_code: 'EG' });
    expect(org).toMatchObject({ countryCode: 'EG', countryNameEn: 'en-EG' });
  });

  it('leaves the column default (SA) when no country is sent', async () => {
    const t = setup();
    const org = await t.service.create('user-1', 'BUSINESS', 'Acme');

    expect(t.prisma.organizations.create.mock.calls[0][0].data).not.toHaveProperty('country_code');
    expect(org.countryCode).toBe('SA');
  });

  it('rejects an unknown country before creating anything', async () => {
    const t = setup();

    await expect(t.service.create('user-1', 'BUSINESS', 'Acme', 'ZZ')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(t.prisma.organizations.create).not.toHaveBeenCalled();
  });

  it.each(['OWNER', 'MANAGER'])('lets a %s change the country', async (role) => {
    const t = setup(role);
    const result = await t.service.setCountry('org-1', 'user-1', 'eg');

    expect(t.prisma.organizations.update).toHaveBeenCalledWith({ where: { id: 'org-1' }, data: { country_code: 'EG' } });
    expect(result).toMatchObject({ id: 'org-1', countryCode: 'EG' });
  });

  it('refuses a plain member', async () => {
    const t = setup('MEMBER');

    await expect(t.service.setCountry('org-1', 'user-1', 'EG')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(t.prisma.organizations.update).not.toHaveBeenCalled();
  });

  it('refuses someone outside the account', async () => {
    const t = setup(null);

    await expect(t.service.setCountry('org-1', 'user-1', 'EG')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown country with a 400 on countryCode', async () => {
    const t = setup('OWNER');

    await expect(t.service.setCountry('org-1', 'user-1', 'ZZ')).rejects.toMatchObject({
      httpStatus: 400,
      details: [{ field: 'countryCode', code: 'unknown_country' }],
    });
    expect(t.prisma.organizations.update).not.toHaveBeenCalled();
  });
});
