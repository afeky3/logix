// @nestjs/schedule ships as ESM, which jest cannot load; only its decorators are used.
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined, CronExpression: { EVERY_DAY_AT_3AM: '0 3 * * *' } }));

import { AppError } from '../../common/errors/app-error';
import { AccountAnonymizationService } from './account-anonymization.service';
import { AccountDeletionService } from './account-deletion.service';

const USER = 'user-1';
const ORG = 'org-1';

interface Opts {
  role?: 'OWNER' | 'MANAGER' | 'MEMBER' | 'DRIVER';
  otherMembers?: number;
  orders?: number;
  requests?: number;
  payments?: number;
  settlements?: number;
  contracts?: number;
  trips?: number;
  status?: string;
  publicUser?: boolean;
}

function setup(o: Opts = {}) {
  const writes: string[] = [];
  const log = (name: string) => jest.fn(async (_args?: unknown) => (writes.push(name), { count: 1 }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake refers to itself in $transaction
  const prisma: Record<string, any> = {
    users: {
      findUnique: jest.fn(async () => ({ id: USER, phone_e164: '+966500000001', email: 'a@b.co', status: o.status ?? 'ACTIVE' })),
      findUniqueOrThrow: jest.fn(async () => ({ id: USER, phone_e164: '+966500000001', email: 'a@b.co' })),
      update: jest.fn(async (_args: unknown) => (writes.push('user'), {})),
    },
    memberships: {
      findMany: jest.fn(async () => [{ id: 'm1', organization_id: ORG, role: o.role ?? 'OWNER' }]),
      count: jest.fn(async () => o.otherMembers ?? 0),
      update: log('membership'),
    },
    orders: { count: jest.fn(async () => o.orders ?? 0) },
    service_requests: { count: jest.fn(async () => o.requests ?? 0) },
    payment_intents: { count: jest.fn(async () => o.payments ?? 0) },
    settlements: { count: jest.fn(async () => o.settlements ?? 0) },
    recurring_contracts: { count: jest.fn(async () => o.contracts ?? 0) },
    trip_assignments: { findFirst: jest.fn(async () => (o.trips ? { id: 't1' } : null)) },
    drivers: { updateMany: log('driver') },
    organizations: { update: log('org-closed') },
    org_workspaces: { updateMany: log('workspaces') },
    products: { updateMany: log('products') },
    quotes: { updateMany: log('quotes') },
    org_invitations: { updateMany: log('invitations') },
    sessions: {
      findMany: jest.fn(async () => [{ id: 's1' }]),
      updateMany: log('sessions'),
    },
    refresh_tokens: { updateMany: log('refresh-tokens') },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
  };
  if (o.publicUser === false) prisma.users.findUnique = jest.fn(async () => null);
  const auth = {
    requestOtp: jest.fn(async () => ({ challengeId: 'real-challenge', expiresAt: new Date('2026-11-16T10:00:00Z') })),
    spendChallenge: jest.fn(async () => ({ user_id: USER })),
    normalizePhoneNumber: jest.fn((p: string) => p),
  };
  const audit = { logUser: jest.fn(async () => undefined) };
  const service = new AccountDeletionService(prisma as never, auth as never, audit as never);
  return { service, prisma, auth, audit, writes };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('what blocks a deletion', () => {
  it('nothing, for an owner alone with nothing in flight', async () => {
    expect(await setup().service.blockers(USER)).toEqual([]);
  });

  it('an owner with other members', async () => {
    expect(await setup({ otherMembers: 2 }).service.blockers(USER)).toEqual(['OWNER_HAS_MEMBERS']);
  });

  it('everything in flight, listed together', async () => {
    const t = setup({ orders: 1, requests: 2, payments: 1, settlements: 1, contracts: 1 });
    expect(await t.service.blockers(USER)).toEqual(['ACTIVE_ORDERS', 'OPEN_REQUESTS', 'PENDING_PAYMENTS', 'PENDING_SETTLEMENTS', 'ACTIVE_CONTRACTS']);
  });

  it('a manager or a member only leaves: the organization is not looked at', async () => {
    for (const role of ['MANAGER', 'MEMBER'] as const) {
      const t = setup({ role, orders: 5, otherMembers: 3 });
      expect(await t.service.blockers(USER)).toEqual([]);
      expect(t.prisma.orders.count).not.toHaveBeenCalled();
    }
  });

  it('a driver with a trip in progress', async () => {
    expect(await setup({ role: 'DRIVER', trips: 1 }).service.blockers(USER)).toEqual(['ACTIVE_TRIPS']);
    expect(await setup({ role: 'DRIVER' }).service.blockers(USER)).toEqual([]);
  });

  it('only live statuses count', async () => {
    const t = setup();
    await t.service.blockers(USER);
    const statuses = (t.prisma.orders.count.mock.calls[0][0] as { where: { status: { in: string[] } } }).where.status.in;
    expect(statuses).toEqual(expect.arrayContaining(['PENDING_PAYMENT', 'IN_PROGRESS', 'DISPUTED']));
    expect(statuses).not.toEqual(expect.arrayContaining(['COMPLETED']));
    expect(statuses).not.toEqual(expect.arrayContaining(['CANCELLED']));
  });
});

describe('refusing, in the language of the app', () => {
  it('409 ACCOUNT_DELETION_BLOCKED with a translated message and the reasons', async () => {
    const t = setup({ otherMembers: 1, orders: 0 });
    const ar = await failure(t.service.requestOtp(USER, 'ar'));
    expect(ar.code).toBe('ACCOUNT_DELETION_BLOCKED');
    expect(ar.httpStatus).toBe(409);
    expect(ar.message).toContain('لا يمكن حذف الحساب');
    expect(ar.details).toEqual([{ field: 'account', code: 'OWNER_HAS_MEMBERS' }]);
    const en = await failure(t.service.requestOtp(USER, 'en'));
    expect(en.message).toContain('cannot be deleted');
  });

  it('no code is sent when it is blocked', async () => {
    const t = setup({ orders: 1 });
    await failure(t.service.requestOtp(USER, 'en'));
    expect(t.auth.requestOtp).not.toHaveBeenCalled();
  });

  it('a blocked confirm does not spend the code', async () => {
    const t = setup({ orders: 1 });
    await failure(t.service.confirm(USER, 'c1', '123456', 'en'));
    expect(t.auth.spendChallenge).not.toHaveBeenCalled();
  });
});

describe('the code', () => {
  it('goes to the user\'s own phone, for this purpose and this user', async () => {
    const t = setup();
    const res = await t.service.requestOtp(USER, 'ar', '1.2.3.4');
    expect(t.auth.requestOtp).toHaveBeenCalledWith('+966500000001', '1.2.3.4', undefined, { purpose: 'ACCOUNT_DELETION', userId: USER });
    expect(res).toEqual({ challengeId: 'real-challenge', expiresAt: new Date('2026-11-16T10:00:00Z') });
  });

  it('a wrong or foreign code deletes nothing', async () => {
    const t = setup();
    t.auth.spendChallenge.mockRejectedValueOnce(new AppError('OTP_INVALID', 'Incorrect code'));
    await failure(t.service.confirm(USER, 'c1', '000000', 'ar'));
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.auth.spendChallenge).toHaveBeenCalledWith('c1', '000000', 'ACCOUNT_DELETION', USER);
  });
});

describe('deleting', () => {
  it('an owner alone: the account is soft-deleted, the organization closes, sessions and tokens end', async () => {
    const t = setup();
    const res = await t.service.confirm(USER, 'c1', '123456', 'ar', { ip: '1.2.3.4' });

    expect(res.deletedAt).toBeInstanceOf(Date);
    expect(t.writes).toEqual(expect.arrayContaining(['membership', 'org-closed', 'workspaces', 'products', 'quotes', 'invitations', 'refresh-tokens', 'sessions', 'user']));
    expect(t.prisma.organizations.update).toHaveBeenCalledWith({ where: { id: ORG }, data: { status: 'CLOSED' } });
    expect(t.prisma.products.updateMany).toHaveBeenCalledWith({ where: { supplier_org_id: ORG, status: 'PUBLISHED' }, data: { status: 'PAUSED' } });
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('the phone and e-mail are released at once and kept aside; the password goes', async () => {
    const t = setup();
    await t.service.confirm(USER, 'c1', '123456', 'ar');
    const data = (t.prisma.users.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;

    expect(data).toMatchObject({
      status: 'DELETED',
      erasable_phone_e164: '+966500000001',
      erasable_email: 'a@b.co',
      email: null,
      password_hash: null,
    });
    expect(data.phone_e164).toMatch(/^\+999\d{10}$/); // valid for ck_users_phone, and not anyone's number
    expect(data.deleted_at).toBeInstanceOf(Date);
  });

  it('push tokens are cleared and every live session is revoked', async () => {
    const t = setup();
    await t.service.confirm(USER, 'c1', '123456', 'ar');
    const calls = t.prisma.sessions.updateMany.mock.calls.map((c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data);
    expect(calls[0]).toMatchObject({ push_token: null });
    expect(calls[1]).toMatchObject({ revoke_reason: 'ACCOUNT_DELETED' });
    expect(t.prisma.refresh_tokens.updateMany).toHaveBeenCalledWith({
      where: { session_id: { in: ['s1'] }, revoked_at: null },
      data: { revoked_at: expect.any(Date) },
    });
  });

  it('is audited', async () => {
    const t = setup();
    await t.service.confirm(USER, 'c1', '123456', 'ar', { ip: '1.2.3.4', userAgent: 'app' });
    expect(t.audit.logUser).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, action: 'account.deleted', ip: '1.2.3.4' }), t.prisma);
  });

  it('a manager leaves without closing the organization', async () => {
    const t = setup({ role: 'MANAGER', orders: 3 });
    await t.service.confirm(USER, 'c1', '123456', 'ar');
    expect(t.prisma.organizations.update).not.toHaveBeenCalled();
    expect(t.prisma.memberships.update).toHaveBeenCalled();
  });

  it('a driver is suspended as a driver', async () => {
    const t = setup({ role: 'DRIVER' });
    await t.service.confirm(USER, 'c1', '123456', 'ar');
    expect(t.prisma.drivers.updateMany).toHaveBeenCalledWith({ where: { membership_id: 'm1' }, data: { status: 'SUSPENDED' } });
  });

  it('something that started after the first check stops it, and nothing is written', async () => {
    const t = setup();
    t.prisma.orders.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const err = await failure(t.service.confirm(USER, 'c1', '123456', 'en'));
    expect(err.code).toBe('ACCOUNT_DELETION_BLOCKED');
    expect(t.writes).toEqual([]);
  });

  it('an account already deleted is not found', async () => {
    expect((await failure(setup({ status: 'DELETED' }).service.requestOtp(USER, 'ar'))).code).toBe('NOT_FOUND');
  });
});

describe('the public form', () => {
  it('sends a code only when an active account has the phone', async () => {
    const t = setup();
    const res = await t.service.requestPublicOtp('+966500000001', '9.9.9.9');
    expect(res.challengeId).toBe('real-challenge');
    expect(t.auth.requestOtp).toHaveBeenCalledWith('+966500000001', '9.9.9.9', undefined, { purpose: 'ACCOUNT_DELETION', userId: USER });
  });

  it('answers the same for an unknown phone, and sends nothing, so the form cannot reveal who is registered', async () => {
    const t = setup({ publicUser: false });
    const res = await t.service.requestPublicOtp('+966599999999');
    expect(res.challengeId).toEqual(expect.any(String));
    expect(res.expiresAt).toBeInstanceOf(Date);
    expect(t.auth.requestOtp).not.toHaveBeenCalled();
  });

  it('a deleted account looks unknown too', async () => {
    const t = setup({ status: 'DELETED' });
    await t.service.requestPublicOtp('+966500000001');
    expect(t.auth.requestOtp).not.toHaveBeenCalled();
  });

  it('confirm: the proven phone gets the reason when it is blocked, and nothing is deleted', async () => {
    const t = setup({ otherMembers: 1 });
    const err = await failure(t.service.confirmPublic('c1', '123456', 'en'));
    expect(err.code).toBe('ACCOUNT_DELETION_BLOCKED');
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('confirm deletes the account the code belongs to', async () => {
    const t = setup();
    const res = await t.service.confirmPublic('c1', '123456', 'ar');
    expect(res.deletedAt).toBeInstanceOf(Date);
    expect(t.auth.spendChallenge).toHaveBeenCalledWith('c1', '123456', 'ACCOUNT_DELETION');
  });

  it('a code with no user behind it (the made-up one) is just a wrong code', async () => {
    const t = setup();
    t.auth.spendChallenge.mockResolvedValueOnce({ user_id: null as never });
    expect((await failure(t.service.confirmPublic('fake', '123456', 'ar'))).code).toBe('OTP_INVALID');
  });
});

describe('anonymization, 30 days on', () => {
  function anon(rows: { id: string; avatar_file_id: string | null }[]) {
    const prisma: Record<string, any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
      users: { findMany: jest.fn(async () => rows), update: jest.fn(async () => ({})) },
      files: { updateMany: jest.fn(async () => ({ count: 1 })) },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
    };
    return { service: new AccountAnonymizationService(prisma as never), prisma };
  }

  it('only accounts deleted before the cutoff and not yet anonymized are picked', async () => {
    const t = anon([]);
    const now = new Date('2026-12-20T00:00:00Z');
    await t.service.anonymizeDue(now);
    const where = (t.prisma.users.findMany.mock.calls[0][0] as { where: { deleted_at: { lt: Date }; status: string; anonymized_at: null } }).where;
    expect(where.status).toBe('DELETED');
    expect(where.anonymized_at).toBeNull();
    expect(where.deleted_at.lt.toISOString()).toBe('2026-11-20T00:00:00.000Z'); // 30 days earlier
  });

  it('clears the name, the aside phone and e-mail and the avatar, and leaves everything else alone', async () => {
    const t = anon([{ id: 'u1', avatar_file_id: 'f1' }, { id: 'u2', avatar_file_id: null }]);
    const now = new Date('2026-12-20T00:00:00Z');
    expect(await t.service.anonymizeDue(now)).toBe(2);
    expect(t.prisma.users.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { full_name: null, erasable_phone_e164: null, erasable_email: null, avatar_file_id: null, anonymized_at: now },
    });
    expect(t.prisma.files.updateMany).toHaveBeenCalledTimes(1); // only the one with an avatar
  });
});
