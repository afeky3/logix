import { AdminKybService } from './admin-kyb.service';

const CASE = 'case-1';
const ORG = 'org-1';

function setup(status = 'SUBMITTED', workspace = 'PROVIDER') {
  const sent: Record<string, unknown>[] = [];
  const calls: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake refers to itself in $transaction
  const prisma: Record<string, any> = {
    verification_cases: {
      findUnique: jest.fn(async () => ({ id: CASE, organization_id: ORG, workspace, status })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        calls.push('case');
        return { id: CASE, status: data.status, decided_at: data.decided_at };
      }),
    },
    org_workspaces: { updateMany: jest.fn(async () => (calls.push('workspace'), { count: 1 })) },
    provider_activities: { updateMany: jest.fn(async () => (calls.push('activities'), { count: 1 })) },
    memberships: {
      // Only owners and managers are asked for; the fake honours the filter.
      findMany: jest.fn(async ({ where }: { where: { role: { in: string[] } } }) =>
        [
          { user_id: 'owner', role: 'OWNER' },
          { user_id: 'manager', role: 'MANAGER' },
          { user_id: 'member', role: 'MEMBER' },
          { user_id: 'driver', role: 'DRIVER' },
        ].filter((m) => where.role.in.includes(m.role)),
      ),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
  };
  const notifications = { create: jest.fn(async (n: Record<string, unknown>[]) => void sent.push(...n)) };
  return { service: new AdminKybService(prisma as never, notifications as never), prisma, notifications, sent, calls };
}

describe('AdminKybService.decideCase', () => {
  it('approving opens the account and tells the owner and the managers', async () => {
    const t = setup();
    const res = await t.service.decideCase('staff-1', CASE, 'APPROVED', 'All documents verified');

    expect(res).toMatchObject({ id: CASE, status: 'APPROVED' });
    expect(t.prisma.org_workspaces.updateMany).toHaveBeenCalledWith({
      where: { organization_id: ORG, workspace: 'PROVIDER' },
      data: { status: 'ACTIVE', activated_at: expect.any(Date) },
    });
    expect(t.prisma.provider_activities.updateMany).toHaveBeenCalled();
    expect(t.sent.map((n) => [n.userId, n.type])).toEqual([
      ['owner', 'verification.approved'],
      ['manager', 'verification.approved'],
    ]);
    expect(t.sent[0]).toMatchObject({
      organizationId: ORG,
      workspace: 'PROVIDER',
      category: 'ACCOUNT',
      titleKey: 'notifications.verification.approved.title',
      params: { workspace: 'PROVIDER', reason: 'All documents verified' },
    });
  });

  it.each([
    ['CHANGES_REQUESTED', 'verification.changes_requested'],
    ['REJECTED', 'verification.rejected'],
  ] as const)('%s keeps the account closed and sends the reason', async (decision, type) => {
    const t = setup();
    await t.service.decideCase('staff-1', CASE, decision, 'The license has expired');

    expect(t.prisma.org_workspaces.updateMany).not.toHaveBeenCalled();
    expect(t.prisma.provider_activities.updateMany).not.toHaveBeenCalled();
    expect(t.sent.map((n) => n.type)).toEqual([type, type]);
    expect(t.sent[0]).toMatchObject({ params: { reason: 'The license has expired' } });
  });

  it('the notice is written inside the same transaction as the decision', async () => {
    const t = setup();
    await t.service.decideCase('staff-1', CASE, 'APPROVED');

    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(t.notifications.create).toHaveBeenCalledWith(expect.any(Array), t.prisma);
  });

  it.each(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'])('a case already %s cannot be decided again: 409, no notices', async (status) => {
    const t = setup(status);

    await expect(t.service.decideCase('staff-1', CASE, 'APPROVED')).rejects.toMatchObject({ httpStatus: 409 });
    expect(t.prisma.verification_cases.update).not.toHaveBeenCalled();
    expect(t.sent).toHaveLength(0);
  });

  it('an unknown case is a 404', async () => {
    const t = setup();
    t.prisma.verification_cases.findUnique.mockResolvedValueOnce(null);
    await expect(t.service.decideCase('staff-1', 'nope', 'APPROVED')).rejects.toMatchObject({ httpStatus: 404 });
  });
});
