import { CountriesService } from '../../common/countries/countries.service';
import { OpportunitiesService } from './opportunities.service';

function setup(orgCountry = 'AE') {
  const match = {
    id: 'm1',
    activity: 'TRANSPORT_CARRIER',
    notified_at: null,
    viewed_at: null,
    quoted_at: null,
    service_requests: {
      id: 'r1',
      reference: 'LX-000001',
      status: 'SUBMITTED',
      service_type: 'TRANSPORT',
      country_code: orgCountry,
      service_date: null,
      expires_at: null,
      origin_summary: null,
      destination_summary: null,
      transport_request_details: null,
      shipping_request_details: null,
      warehousing_request_details: null,
      customs_request_details: null,
    },
  };
  const prisma = {
    memberships: { findUnique: jest.fn(async () => ({ status: 'ACTIVE' })) },
    organizations: { findUnique: jest.fn(async () => ({ country_code: orgCountry })) },
    countries: { findFirst: jest.fn(async ({ where }: { where: { code: string } }) => ({ code: where.code })) },
    request_matches: { findMany: jest.fn(async () => [match]) },
  };
  const service = new OpportunitiesService(prisma as never, new CountriesService(prisma as never));
  const where = () => (prisma.request_matches.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
  return { service, where };
}

describe('OpportunitiesService.list country filter', () => {
  it("defaults to the provider account's country", async () => {
    const t = setup('AE');
    const rows = await t.service.list('user-1', 'org-1');

    expect(t.where()).toMatchObject({
      provider_org_id: 'org-1',
      declined_at: null,
      service_requests: { country_code: 'AE' },
    });
    expect(rows[0].countryCode).toBe('AE');
  });

  it('takes an explicit country', async () => {
    const t = setup('AE');
    await t.service.list('user-1', 'org-1', 'SA');

    expect(t.where()).toMatchObject({ service_requests: { country_code: 'SA' } });
  });

  it('shows every country for ALL', async () => {
    const t = setup('AE');
    await t.service.list('user-1', 'org-1', 'ALL');

    expect(t.where()).not.toHaveProperty('service_requests');
  });
});
