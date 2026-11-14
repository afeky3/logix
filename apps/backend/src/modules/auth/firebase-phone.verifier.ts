import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../../common/errors/app-error';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
/** How old the phone sign-in may be. A token is valid for an hour, but the code was just typed. */
const MAX_AUTH_AGE_SECONDS = 5 * 60;

export interface VerifiedPhone {
  phoneE164: string;
  /** Firebase's uid for this phone (not our user id). */
  firebaseUid: string;
}

interface Claims {
  sub?: string;
  auth_time?: number;
  phone_number?: string;
  firebase?: { sign_in_provider?: string };
}

/**
 * Checks a Firebase ID token that proves control of a phone number (Firebase Phone Auth sent and
 * checked the SMS code; we only trust the signed result). Needs just the project id: the token is
 * verified against Google's public certificates, so no service account or secret lives on the server.
 */
@Injectable()
export class FirebasePhoneVerifier {
  private readonly logger = new Logger(FirebasePhoneVerifier.name);
  private certs: { byKid: Record<string, string>; expiresAt: number } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async verify(idToken: string): Promise<VerifiedPhone> {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      throw new AppError('UPSTREAM_UNAVAILABLE', 'Phone sign-in with Firebase is not configured');
    }

    const decoded = this.jwt.decode(idToken, { complete: true }) as
      | { header?: { alg?: string; kid?: string } }
      | null;
    const kid = decoded?.header?.kid;
    // Pin RS256: refusing "none"/HS256 keeps a forged token from slipping through.
    if (!kid || decoded?.header?.alg !== 'RS256') throw invalid('Malformed token');

    const cert = await this.certificateFor(kid);
    if (!cert) throw invalid('Unknown signing key');

    let claims: Claims;
    try {
      claims = await this.jwt.verifyAsync<Claims>(idToken, {
        publicKey: cert,
        algorithms: ['RS256'],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
      });
    } catch (e) {
      const expired = (e as { name?: string }).name === 'TokenExpiredError';
      throw expired
        ? new AppError('OTP_EXPIRED', 'This verification has expired, request a new code')
        : invalid('Invalid token');
    }

    // The project may also issue Google/Apple tokens: only a phone sign-in proves a phone number.
    if (claims.firebase?.sign_in_provider !== 'phone') throw invalid('Not a phone sign-in');
    if (!claims.sub) throw invalid('Missing subject');
    const phone = claims.phone_number;
    if (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone)) throw invalid('No phone number');

    const age = Math.floor(Date.now() / 1000) - (claims.auth_time ?? 0);
    if (!claims.auth_time || age > MAX_AUTH_AGE_SECONDS) {
      throw new AppError('OTP_EXPIRED', 'This verification has expired, request a new code');
    }

    return { phoneE164: phone, firebaseUid: claims.sub };
  }

  /** Google rotates these keys; the response says how long a copy may be kept. */
  private async certificateFor(kid: string): Promise<string | undefined> {
    const now = Date.now();
    if (!this.certs || this.certs.expiresAt <= now || !this.certs.byKid[kid]) {
      // An unknown kid can mean a rotation we haven't seen: refetch once, but not on every bad token.
      const stale = this.certs && this.certs.expiresAt > now && !this.certs.byKid[kid];
      if (!stale || now - (this.lastForcedFetch ?? 0) > 60_000) {
        if (stale) this.lastForcedFetch = now;
        this.certs = await this.loadCerts();
      }
    }
    return this.certs?.byKid[kid];
  }
  private lastForcedFetch?: number;

  /** Overridable in tests. */
  protected async loadCerts(): Promise<{ byKid: Record<string, string>; expiresAt: number }> {
    try {
      const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`certs responded ${res.status}`);
      const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1];
      return {
        byKid: (await res.json()) as Record<string, string>,
        expiresAt: Date.now() + Number(maxAge ?? 3600) * 1000,
      };
    } catch (e) {
      this.logger.error(`Could not load Firebase signing certificates: ${e instanceof Error ? e.message : e}`);
      throw new AppError('UPSTREAM_UNAVAILABLE', 'Could not verify the phone sign-in, try again');
    }
  }
}

const invalid = (message: string) => new AppError('OTP_INVALID', message);
