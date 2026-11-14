import { AppError } from '../../common/errors/app-error';
import { AppAuthService } from './app-auth.service';

const PHONE = '+966500000009';
const device = { id: 'dev-1', platform: 'android' as const, appVersion: '2.0.0' };
const P = 'PLATFORM_TERMS_INTERMEDIARY' as const;
const N = 'NO_LIABILITY_GOODS_DISPUTES' as const;

function setup(existing: Record<string, unknown> | null, verifyResult: { phoneE164: string } | Error = { phoneE164: PHONE }) {
  const created: Record<string, unknown>[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake refers to itself in $transaction
  const prisma: Record<string, any> = {
    users: {
      findUnique: jest.fn(async () => existing),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { full_name: null, locale: 'ar', status: 'ACTIVE', ...data };
        created.push(row);
        return row;
      }),
      update: jest.fn(async () => ({})),
    },
    sessions: { create: jest.fn(async ({ data }: { data: { id: string } }) => ({ id: data.id })) },
    refresh_tokens: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
    memberships: { findMany: jest.fn(async () => []) },
  };
  const firebase = {
    verify: jest.fn(async () => {
      if (verifyResult instanceof Error) throw verifyResult;
      return { ...verifyResult, firebaseUid: 'uid' };
    }),
  };
  const legal = { recordRegistration: jest.fn(async () => ({ id: 'la-1' })) };
  const tokens = { issueAppTokens: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r', refreshTokenHash: 'h' })) };
  const service = new AppAuthService(
    prisma as never,
    { get: jest.fn() } as never,
    tokens as never,
    {} as never,
    { labels: jest.fn(async () => ({})) } as never,
    legal as never,
    firebase as never,
  );
  jest.spyOn(service, 'getWorkspaces').mockResolvedValue([] as never);
  return { service, prisma, firebase, legal, created };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('AppAuthService.verifyFirebase', () => {
  it('creates the account for a new phone, with its registration acceptance, and opens a session', async () => {
    const t = setup(null);
    const res = await t.service.verifyFirebase('token', device, '1.2.3.4', { termsVersion: '2026-11-06', items: [P, N], locale: 'ar' });

    expect(t.firebase.verify).toHaveBeenCalledWith('token');
    expect(t.created[0]).toMatchObject({ phone_e164: PHONE });
    expect(t.legal.recordRegistration).toHaveBeenCalledWith(
      t.prisma,
      expect.any(String),
      expect.objectContaining({ items: [P, N] }),
      expect.objectContaining({ ip: '1.2.3.4' }),
    );
    expect(res).toMatchObject({ accessToken: 'a', refreshToken: 'r', isNewUser: true, user: { phone: PHONE } });
  });

  it('signs an existing user in without creating anything', async () => {
    const t = setup({ id: 'u1', phone_e164: PHONE, full_name: 'Sara', locale: 'ar', status: 'ACTIVE' });
    const res = await t.service.verifyFirebase('token', device, '1.2.3.4');

    expect(t.prisma.users.create).not.toHaveBeenCalled();
    expect(t.prisma.users.update).toHaveBeenCalled();
    expect(res).toMatchObject({ isNewUser: false, user: { id: 'u1', fullName: 'Sara' } });
  });

  it('ignores consents for an existing user, even incomplete ones', async () => {
    const t = setup({ id: 'u1', phone_e164: PHONE, full_name: null, locale: 'ar', status: 'ACTIVE' });
    await expect(t.service.verifyFirebase('token', device, undefined, { termsVersion: 'x', items: [P], locale: 'ar' })).resolves.toBeDefined();
    expect(t.legal.recordRegistration).not.toHaveBeenCalled();
  });

  it('refuses incomplete consents for a new user and creates no account', async () => {
    const t = setup(null);
    const err = await failure(t.service.verifyFirebase('token', device, undefined, { termsVersion: 'x', items: [P], locale: 'ar' }));
    expect(err.httpStatus).toBe(422);
    expect(t.prisma.users.create).not.toHaveBeenCalled();
  });

  it('refuses a token Firebase proof rejects, and creates nothing', async () => {
    const t = setup(null, new AppError('OTP_INVALID', 'Invalid token'));
    const err = await failure(t.service.verifyFirebase('bad', device));
    expect(err.code).toBe('OTP_INVALID');
    expect(t.prisma.users.findUnique).not.toHaveBeenCalled();
    expect(t.prisma.users.create).not.toHaveBeenCalled();
  });

  it('refuses a suspended account', async () => {
    const t = setup({ id: 'u1', phone_e164: PHONE, full_name: null, locale: 'ar', status: 'SUSPENDED' });
    expect((await failure(t.service.verifyFirebase('token', device))).code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('AppAuthService.setPasswordWithFirebase', () => {
  it("sets the password of the phone's account", async () => {
    const t = setup({ id: 'u1', phone_e164: PHONE, full_name: null, locale: 'ar', status: 'ACTIVE' });
    await t.service.setPasswordWithFirebase('token', 'Passw0rd!x');
    expect(t.prisma.users.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ password_hash: expect.any(String) }) }),
    );
  });

  it('changes nothing when the proof is rejected', async () => {
    const t = setup(null, new AppError('OTP_INVALID', 'Invalid token'));
    await failure(t.service.setPasswordWithFirebase('bad', 'Passw0rd!x'));
    expect(t.prisma.users.update).not.toHaveBeenCalled();
  });
});
