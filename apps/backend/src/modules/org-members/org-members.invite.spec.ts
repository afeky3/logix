import { OrgMembersService } from './org-members.service';

function setup(role: string | null) {
  const prisma = {
    memberships: {
      findUnique: jest.fn(async () => (role ? { id: 'm1', status: 'ACTIVE', role } : null)),
      upsert: jest.fn(async () => ({ id: 'm-new' })),
    },
    org_invitations: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: { id: string; token: string; expires_at: Date } }) => data),
    },
    users: { findUnique: jest.fn(async () => null) },
  };
  return { service: new OrgMembersService(prisma as never), prisma };
}

describe('OrgMembersService.invite is for the owner only', () => {
  it.each(['MANAGER', 'MEMBER', 'DRIVER'] as const)('lets the owner invite a %s', async (role) => {
    const t = setup('OWNER');
    const res = await t.service.invite('org-1', 'owner', '+966500000001', role);

    expect(res.token).toEqual(expect.any(String));
    expect(t.prisma.org_invitations.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role, phone_e164: '+966500000001' }) }),
    );
  });

  it.each(['MANAGER', 'MEMBER', 'DRIVER'])('refuses a %s: no invitation and no membership row', async (role) => {
    const t = setup(role);

    await expect(t.service.invite('org-1', 'u2', '+966500000001', 'MANAGER')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      httpStatus: 403,
    });
    expect(t.prisma.org_invitations.create).not.toHaveBeenCalled();
    expect(t.prisma.memberships.upsert).not.toHaveBeenCalled();
  });

  it('refuses someone outside the organization', async () => {
    const t = setup(null);
    await expect(t.service.invite('org-1', 'stranger', '+966500000001', 'MEMBER')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(t.prisma.org_invitations.create).not.toHaveBeenCalled();
  });
});
