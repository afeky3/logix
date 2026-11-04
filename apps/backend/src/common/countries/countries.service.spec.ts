import { AppError } from '../errors/app-error';
import { countryCodeSchema, countryFilterSchema } from './country.schema';
import { CountriesService } from './countries.service';

function setup(known = ['SA', 'EG', 'AE'], orgCountry: string | null = 'EG') {
  const prisma = {
    countries: {
      findFirst: jest.fn(async ({ where }: { where: { code: string } }) =>
        known.includes(where.code) ? { code: where.code } : null,
      ),
      findMany: jest.fn(async ({ where }: { where: { code: { in: string[] } } }) =>
        where.code.in.filter((c) => known.includes(c)).map((code) => ({ code, name_ar: `ar-${code}`, name_en: `en-${code}` })),
      ),
    },
    organizations: {
      findUnique: jest.fn(async () => (orgCountry ? { country_code: orgCountry } : null)),
    },
  };
  return { service: new CountriesService(prisma as never), prisma };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('country schemas', () => {
  it('upper-cases and trims a country code', () => {
    expect(countryCodeSchema.parse(' eg ')).toBe('EG');
  });

  it.each(['SAU', 'S', '1A', ''])('rejects %p as a country code', (v) => {
    expect(countryCodeSchema.safeParse(v).success).toBe(false);
  });

  it('accepts ALL (any case) as a filter', () => {
    expect(countryFilterSchema.parse('all')).toBe('ALL');
    expect(countryFilterSchema.parse('ae')).toBe('AE');
    expect(countryFilterSchema.safeParse('EVERYTHING').success).toBe(false);
  });
});

describe('CountriesService', () => {
  it('rejects an unknown country on the countryCode field with a 400', async () => {
    const err = await failure(setup().service.assertValid('zz'));

    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.details).toEqual([{ field: 'countryCode', code: 'unknown_country' }]);
  });

  it('normalizes a known country', async () => {
    await expect(setup().service.assertValid('eg')).resolves.toBe('EG');
  });

  describe('resolveFilter', () => {
    it('uses an explicit country over the account', async () => {
      const { service, prisma } = setup();
      await expect(service.resolveFilter({ country: 'ae', organizationId: 'org-1' })).resolves.toBe('AE');
      expect(prisma.organizations.findUnique).not.toHaveBeenCalled();
    });

    it('turns the filter off for ALL, even with an account', async () => {
      await expect(setup().service.resolveFilter({ country: 'ALL', organizationId: 'org-1' })).resolves.toBeNull();
    });

    it("falls back to the account's country", async () => {
      await expect(setup().service.resolveFilter({ organizationId: 'org-1' })).resolves.toBe('EG');
    });

    it('does not filter with neither, so older apps keep working', async () => {
      await expect(setup().service.resolveFilter({})).resolves.toBeNull();
    });

    it('rejects an unknown explicit country', async () => {
      const err = await failure(setup().service.resolveFilter({ country: 'ZZ' }));
      expect(err.code).toBe('VALIDATION_FAILED');
    });

    it('404s for an account that does not exist', async () => {
      const err = await failure(setup(['SA'], null).service.resolveFilter({ organizationId: 'nope' }));
      expect(err.httpStatus).toBe(404);
    });
  });

  it('labels every code, with null names for one it cannot find', async () => {
    const labels = await setup().service.labels(['SA', 'XX', 'SA']);

    expect([...labels.keys()]).toEqual(['SA', 'XX']);
    expect(labels.get('SA')).toEqual({ countryCode: 'SA', countryNameAr: 'ar-SA', countryNameEn: 'en-SA' });
    expect(labels.get('XX')).toEqual({ countryCode: 'XX', countryNameAr: null, countryNameEn: null });
  });
});
