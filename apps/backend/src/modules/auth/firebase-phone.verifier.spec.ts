import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../../common/errors/app-error';
import { FirebasePhoneVerifier } from './firebase-phone.verifier';

const PROJECT = 'logix-global';
const KID = 'test-key-1';

const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048 });
const good = pair();
const other = pair();
const pem = (k: ReturnType<typeof pair>) => k.publicKey.export({ type: 'spki', format: 'pem' }) as string;

const jwt = new JwtService({});
const now = () => Math.floor(Date.now() / 1000);

function token(over: Record<string, unknown> = {}, opts: { key?: ReturnType<typeof pair>; kid?: string; alg?: 'RS256' | 'HS256'; expiresIn?: string } = {}) {
  const claims = {
    sub: 'fb-uid-1',
    auth_time: now() - 10,
    phone_number: '+966500000001',
    firebase: { sign_in_provider: 'phone', identities: { phone: ['+966500000001'] } },
    ...over,
  };
  if (opts.alg === 'HS256') {
    return jwt.sign(claims, { secret: 'x'.repeat(32), algorithm: 'HS256', keyid: opts.kid ?? KID, audience: PROJECT, issuer: `https://securetoken.google.com/${PROJECT}` });
  }
  return jwt.sign(claims, {
    privateKey: (opts.key ?? good).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    algorithm: 'RS256',
    keyid: opts.kid ?? KID,
    audience: PROJECT,
    issuer: `https://securetoken.google.com/${PROJECT}`,
    expiresIn: opts.expiresIn ?? '1h',
  });
}

class TestVerifier extends FirebasePhoneVerifier {
  loads = 0;
  protected override async loadCerts() {
    this.loads++;
    return { byKid: { [KID]: pem(good) }, expiresAt: Date.now() + 3_600_000 };
  }
}

function setup(projectId: string | null = PROJECT) {
  const config = { get: jest.fn((k: string) => (k === 'FIREBASE_PROJECT_ID' ? (projectId ?? undefined) : undefined)) };
  return new TestVerifier(config as never, jwt);
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('FirebasePhoneVerifier', () => {
  it('returns the phone from a valid phone sign-in token', async () => {
    expect(await setup().verify(token())).toEqual({ phoneE164: '+966500000001', firebaseUid: 'fb-uid-1' });
  });

  it('caches the certificates', async () => {
    const v = setup();
    await v.verify(token());
    await v.verify(token());
    expect(v.loads).toBe(1);
  });

  it('is unavailable (503) when the project is not configured', async () => {
    const err = await failure(setup(null).verify(token()));
    expect(err.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('rejects a token signed with another key', async () => {
    expect((await failure(setup().verify(token({}, { key: other })))).code).toBe('OTP_INVALID');
  });

  it('rejects an unknown key id', async () => {
    expect((await failure(setup().verify(token({}, { kid: 'nope' })))).code).toBe('OTP_INVALID');
  });

  it('rejects a token that is not RS256', async () => {
    expect((await failure(setup().verify(token({}, { alg: 'HS256' })))).code).toBe('OTP_INVALID');
  });

  it('rejects another project (audience and issuer)', async () => {
    const err = await failure(setup('some-other-project').verify(token()));
    expect(err.code).toBe('OTP_INVALID');
  });

  it('rejects an expired token as OTP_EXPIRED', async () => {
    const expired = token({ iat: now() - 7200 }, { expiresIn: '-1h' });
    expect((await failure(setup().verify(expired))).code).toBe('OTP_EXPIRED');
  });

  it('rejects a sign-in that happened long ago, even if the token is still valid', async () => {
    const old = token({ auth_time: now() - 20 * 60 });
    const err = await failure(setup().verify(old));
    expect(err.code).toBe('OTP_EXPIRED');
  });

  it.each(['google.com', 'apple.com', 'password', undefined])(
    'rejects a %s sign-in: only a phone proves a phone',
    async (provider) => {
      const err = await failure(setup().verify(token({ firebase: { sign_in_provider: provider } })));
      expect(err.code).toBe('OTP_INVALID');
    },
  );

  it.each([undefined, 'not-a-phone', '0500000000', '+12'])('rejects the phone claim %p', async (phone) => {
    const err = await failure(setup().verify(token({ phone_number: phone })));
    expect(err.code).toBe('OTP_INVALID');
  });

  it('rejects garbage', async () => {
    expect((await failure(setup().verify('a'.repeat(120)))).code).toBe('OTP_INVALID');
  });
});
