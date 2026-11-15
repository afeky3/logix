import { CountriesService } from '../../common/countries/countries.service';
import { OrganizationsService } from './organizations.service';

type Row = Record<string, unknown>;

function setup(role: string | null = 'OWNER', existingWorkspace = false) {
  const prisma = {
    memberships: { findUnique: jest.fn(async () => (role ? { status: 'ACTIVE', role } : null)) },
    countries: {
      findFirst: jest.fn(async ({ where }: { where: { code: string } }) => ({ code: where.code })),
      findMany: jest.fn(async () => [{ code: 'SA', name_ar: 'السعودية', name_en: 'Saudi Arabia' }]),
    },
    organizations: {
      // Echoes the nested writes back, as Prisma does with `include`.
      create: jest.fn(async ({ data }: { data: Row }) => {
        const nested = data.org_workspaces as { create: Row } | undefined;
        return {
          id: data.id,
          kind: data.kind,
          display_name: data.display_name,
          status: 'ACTIVE',
          country_code: 'SA',
          org_workspaces: nested ? [{ ...nested.create }] : [],
        };
      }),
    },
    org_workspaces: {
      findUnique: jest.fn(async () => (existingWorkspace ? { id: 'ws-old' } : null)),
      create: jest.fn(async ({ data }: { data: Row }) => data),
    },
    provider_activities: { createMany: jest.fn(async () => ({ count: 0 })) },
  };
  return { service: new OrganizationsService(prisma as never, new CountriesService(prisma as never)), prisma };
}

describe('OrganizationsService.addWorkspace is for the owner only', () => {
  it('lets the owner add an account', async () => {
    const t = setup('OWNER');
    const ws = await t.service.addWorkspace('org-1', 'u1', 'SUPPLIER');

    expect(ws).toMatchObject({ workspace: 'SUPPLIER', status: 'PENDING_VERIFICATION' });
    expect(t.prisma.org_workspaces.create).toHaveBeenCalledTimes(1);
  });

  it.each(['MANAGER', 'MEMBER', 'DRIVER'])('refuses a %s and creates nothing', async (role) => {
    const t = setup(role);

    await expect(t.service.addWorkspace('org-1', 'u1', 'PROVIDER')).rejects.toMatchObject({ code: 'FORBIDDEN', httpStatus: 403 });
    expect(t.prisma.org_workspaces.create).not.toHaveBeenCalled();
    expect(t.prisma.provider_activities.createMany).not.toHaveBeenCalled();
  });

  it('refuses someone who is not in the organization', async () => {
    const t = setup(null);
    await expect(t.service.addWorkspace('org-1', 'stranger', 'CUSTOMER')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(t.prisma.org_workspaces.create).not.toHaveBeenCalled();
  });

  it('still refuses a second account of the same kind', async () => {
    const t = setup('OWNER', true);
    await expect(t.service.addWorkspace('org-1', 'u1', 'CUSTOMER')).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});

describe('OrganizationsService.create with a first account', () => {
  it('writes the organization, its owner, the account and the activities in one create', async () => {
    const t = setup();
    const org = await t.service.create('u1', 'BUSINESS', 'Acme Haulers', 'SA', {
      workspace: 'PROVIDER',
      activities: ['TRANSPORT_CARRIER', 'WAREHOUSE'],
    });

    // One write is one transaction: no state exists where the organization has no account.
    expect(t.prisma.organizations.create).toHaveBeenCalledTimes(1);
    const data = t.prisma.organizations.create.mock.calls[0][0].data as Row;
    expect(data.memberships).toMatchObject({ create: { user_id: 'u1', role: 'OWNER' } });
    expect(data.org_workspaces).toMatchObject({ create: { workspace: 'PROVIDER', status: 'PENDING_VERIFICATION' } });
    const activities = (data.provider_activities as { createMany: { data: Row[] } }).createMany.data;
    expect(activities.map((a) => a.activity)).toEqual(['TRANSPORT_CARRIER', 'WAREHOUSE']);
    expect(t.prisma.org_workspaces.create).not.toHaveBeenCalled(); // no second round trip
    expect(org).toMatchObject({ displayName: 'Acme Haulers', workspace: { workspace: 'PROVIDER', status: 'PENDING_VERIFICATION' } });
  });

  it('a customer account is active at once', async () => {
    const t = setup();
    const org = await t.service.create('u1', 'INDIVIDUAL', 'Sara', undefined, { workspace: 'CUSTOMER' });

    const data = t.prisma.organizations.create.mock.calls[0][0].data as Row;
    expect((data.org_workspaces as { create: Row }).create).toMatchObject({
      workspace: 'CUSTOMER',
      status: 'ACTIVE',
      activated_at: expect.any(Date),
    });
    expect(data).not.toHaveProperty('provider_activities');
    expect(org.workspace).toMatchObject({ status: 'ACTIVE' });
  });

  it('without a first account it behaves as before', async () => {
    const t = setup();
    const org = await t.service.create('u1', 'BUSINESS', 'Acme');

    const data = t.prisma.organizations.create.mock.calls[0][0].data as Row;
    expect(data).not.toHaveProperty('org_workspaces');
    expect(org).not.toHaveProperty('workspace');
  });

  it('leaves nothing behind when the write fails', async () => {
    const t = setup();
    t.prisma.organizations.create.mockRejectedValueOnce(new Error('db down'));

    await expect(t.service.create('u1', 'BUSINESS', 'Acme', 'SA', { workspace: 'SUPPLIER' })).rejects.toThrow('db down');
    expect(t.prisma.org_workspaces.create).not.toHaveBeenCalled();
    expect(t.prisma.provider_activities.createMany).not.toHaveBeenCalled();
  });
});
