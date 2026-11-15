import * as argon2 from 'argon2';
import { AppError } from '../../common/errors/app-error';
import { toBytes } from '../../common/util/bytes';
import { AppAuthService } from './app-auth.service';

const PHONE = '+201111346488';
const device = { id: 'dev-1', platform: 'android' as const, appVersion: '2.0.0' };
const P = 'PLATFORM_TERMS_INTERMEDIARY' as const;
const N = 'NO_LIABILITY_GOODS_DISPUTES' as const;
const consents = { termsVersion: '2026-11-06', items: [P, N], locale: 'ar' as const };

const company = {
  fullName: 'عبدالرحمن الفقي',
  email: 'Owner@Example.com',
  organization: { kind: 'BUSINESS' as const, displayName: 'تيست اوج ١', countryCode: 'EG', workspace: 'CUSTOMER' as const },
};

interface Options {
  existing?: Record<string, unknown> | null;
  emailTakenBy?: string | null;
  unknownCountry?: boolean;
  orgFails?: boolean;
}

/** In-memory stand-ins for the parts of Prisma, Firebase and the organization service the sign-up touches. */
function setup(o: Options = {}) {
  const order: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake refers to itself in $transaction
  const prisma: Record<string, any> = {
    users: {
      findUnique: jest.fn(async () => o.existing ?? null),
      findFirst: jest.fn(async () => (o.emailTakenBy ? { id: o.emailTakenBy } : null)),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        order.push('user');
        return { locale: 'ar', status: 'ACTIVE', full_name: null, email: null, ...data };
      }),
      update: jest.fn(async () => ({})),
    },
    otp_challenges: { findUnique: jest.fn(), update: jest.fn(async () => (order.push('otp-spent'), {})) },
    sessions: { create: jest.fn(async ({ data }: { data: { id: string } }) => ({ id: data.id })) },
    refresh_tokens: { create: jest.fn(async () => ({})) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
  };
  const organizations = {
    create: jest.fn(async (_userId: string, ..._rest: unknown[]) => {
      order.push('org');
      if (o.orgFails) throw new Error('db down');
      return { id: 'org-1' };
    }),
  };
  const countries = {
    assertValid: jest.fn(async (code: string) => {
      if (o.unknownCountry) throw new AppError('VALIDATION_FAILED', 'Unknown country', { details: [{ field: 'countryCode', code: 'unknown_country' }] });
      return code;
    }),
  };
  const legal = { recordRegistration: jest.fn(async () => (order.push('consents'), { id: 'la-1' })) };
  const firebase = { verify: jest.fn(async () => ({ phoneE164: PHONE, firebaseUid: 'uid' })) };
  const tokens = { issueAppTokens: jest.fn(async () => ({ accessToken: 'a', refreshToken: 'r', refreshTokenHash: 'h' })) };
  const service = new AppAuthService(
    prisma as never,
    { get: jest.fn() } as never,
    tokens as never,
    {} as never,
    countries as never,
    legal as never,
    firebase as never,
    organizations as never,
  );
  jest.spyOn(service, 'getWorkspaces').mockResolvedValue([] as never);
  return { service, prisma, organizations, countries, legal, order };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('sign-up writes the whole registration with the account (Firebase)', () => {
  it('the name, the e-mail and the organization with its first account are saved in the same transaction', async () => {
    const t = setup();
    const res = await t.service.verifyFirebase('token', device, '1.2.3.4', consents, undefined, company);

    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(t.prisma.users.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ phone_e164: PHONE, full_name: 'عبدالرحمن الفقي', email: 'owner@example.com' }),
    });
    expect(t.organizations.create).toHaveBeenCalledWith(
      expect.any(String),
      'BUSINESS',
      'تيست اوج ١',
      'EG',
      { workspace: 'CUSTOMER', activities: undefined },
      t.prisma, // the transaction, not a separate write
    );
    expect(t.order).toEqual(['user', 'consents', 'org']);
    expect(res).toMatchObject({ isNewUser: true, user: { fullName: 'عبدالرحمن الفقي', email: 'owner@example.com' } });
  });

  it('the organization belongs to the user the same transaction created', async () => {
    const t = setup();
    await t.service.verifyFirebase('token', device, undefined, consents, undefined, company);
    const userId = t.prisma.users.create.mock.calls[0][0].data.id;
    expect(t.organizations.create.mock.calls[0][0]).toBe(userId);
  });

  it('a registration without an organization (an individual who joins later) saves just the person', async () => {
    const t = setup();
    await t.service.verifyFirebase('token', device, undefined, consents, undefined, { fullName: 'Sara' });
    expect(t.prisma.users.create.mock.calls[0][0].data).toMatchObject({ full_name: 'Sara' });
    expect(t.prisma.users.create.mock.calls[0][0].data).not.toHaveProperty('email');
    expect(t.organizations.create).not.toHaveBeenCalled();
  });

  it('nothing in the registration is needed: the old request shape still works', async () => {
    const t = setup();
    const res = await t.service.verifyFirebase('token', device, undefined, consents);
    expect(res).toMatchObject({ isNewUser: true, user: { fullName: null } });
    expect(t.organizations.create).not.toHaveBeenCalled();
  });

  it('an e-mail another account already uses is not stored, and the registration still completes', async () => {
    const t = setup({ emailTakenBy: 'someone-else' });
    const res = await t.service.verifyFirebase('token', device, undefined, consents, undefined, company);

    expect(t.prisma.users.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'owner@example.com' } }));
    expect(t.prisma.users.create.mock.calls[0][0].data).not.toHaveProperty('email');
    expect(t.prisma.users.create.mock.calls[0][0].data).toMatchObject({ full_name: 'عبدالرحمن الفقي' });
    expect(t.organizations.create).toHaveBeenCalled();
    expect(res).toMatchObject({ isNewUser: true });
  });

  it('an unknown country is refused before anything is written', async () => {
    const t = setup({ unknownCountry: true });
    const err = await failure(t.service.verifyFirebase('token', device, undefined, consents, undefined, company));

    expect(err.code).toBe('VALIDATION_FAILED');
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
    expect(t.prisma.users.create).not.toHaveBeenCalled();
  });

  it('if the organization cannot be written the whole transaction fails (the real database rolls the user back)', async () => {
    const t = setup({ orgFails: true });
    await expect(t.service.verifyFirebase('token', device, undefined, consents, undefined, company)).rejects.toThrow('db down');
    // Both writes were inside the one transaction callback that threw.
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(t.order).toEqual(['user', 'consents', 'org']);
    expect(t.prisma.sessions.create).not.toHaveBeenCalled();
  });

  it("an existing user's registration is ignored: no write, no organization, not even a country check", async () => {
    const t = setup({ existing: { id: 'u1', phone_e164: PHONE, full_name: null, email: null, locale: 'ar', status: 'ACTIVE' } });
    const res = await t.service.verifyFirebase('token', device, undefined, consents, undefined, company);

    expect(res).toMatchObject({ isNewUser: false });
    expect(t.prisma.users.create).not.toHaveBeenCalled();
    expect(t.organizations.create).not.toHaveBeenCalled();
    expect(t.countries.assertValid).not.toHaveBeenCalled();
  });
});

describe('sign-up with our own OTP: the registration is checked before the code is spent', () => {
  async function otpSetup(o: Options = {}) {
    const t = setup(o);
    t.prisma.otp_challenges.findUnique.mockResolvedValue({
      id: 'ch1',
      phone_e164: PHONE,
      verified_at: null,
      locked_at: null,
      attempts: 0,
      max_attempts: 5,
      expires_at: new Date(Date.now() + 60_000),
      code_hash: toBytes(await argon2.hash('123456')),
    });
    return t;
  }

  it('saves the registration with the account and spends the code', async () => {
    const t = await otpSetup();
    const res = await t.service.verifyOtp('ch1', '123456', device, undefined, consents, undefined, company);

    expect(t.prisma.users.create.mock.calls[0][0].data).toMatchObject({ full_name: 'عبدالرحمن الفقي' });
    expect(t.order).toEqual(['otp-spent', 'user', 'consents', 'org']);
    expect(res).toMatchObject({ isNewUser: true });
  });

  it('an unknown country leaves the code unspent, so the form can be corrected and sent again', async () => {
    const t = await otpSetup({ unknownCountry: true });
    await failure(t.service.verifyOtp('ch1', '123456', device, undefined, consents, undefined, company));

    expect(t.prisma.otp_challenges.update).not.toHaveBeenCalled();
    expect(t.prisma.users.create).not.toHaveBeenCalled();
  });
});
