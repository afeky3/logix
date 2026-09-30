import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AppTokenPayload, StaffTokenPayload } from '../../common/auth/jwt-payload';
import { toBytes, bytesToUtf8 } from '../../common/util/bytes';

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: Uint8Array<ArrayBuffer>;
}

/**
 * Signs/verifies access + refresh JWTs for both audiences (app, staff).
 * Access and refresh use different secrets so a leaked refresh token can't
 * be replayed as an access token. Refresh tokens are also hashed and stored
 * (identity.sessions / identity.staff_sessions) so they can be revoked and
 * reuse can be detected — see backend/md/modules/01-auth-identity.md.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get accessSecret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }
  private get refreshSecret(): string {
    return this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
  private get accessTtl(): string {
    return this.config.get<string>('JWT_ACCESS_TTL', '15m');
  }
  private get refreshTtlDays(): number {
    return this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);
  }

  async issueAppTokens(userId: string, sessionId: string): Promise<IssuedTokens> {
    return this.issue({ sub: userId, sid: sessionId, aud: 'app' });
  }

  async issueStaffTokens(staffId: string, staffSessionId: string): Promise<IssuedTokens> {
    return this.issue({ sub: staffId, sid: staffSessionId, aud: 'staff' });
  }

  private async issue(
    payload: Omit<AppTokenPayload, never> | Omit<StaffTokenPayload, never>,
  ): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, jti: randomUUID() },
      { secret: this.refreshSecret, expiresIn: `${this.refreshTtlDays}d` },
    );
    const refreshTokenHash = await this.hashRefreshToken(refreshToken);
    return { accessToken, refreshToken, refreshTokenHash };
  }

  /** Short-lived token between staff password check and MFA verification. */
  async issueMfaChallengeToken(staffId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: staffId, aud: 'staff-mfa' },
      { secret: this.refreshSecret, expiresIn: '5m' },
    );
  }

  async verifyMfaChallengeToken(token: string): Promise<{ sub: string }> {
    return this.jwt.verifyAsync(token, { secret: this.refreshSecret });
  }

  async verifyAppRefreshToken(token: string): Promise<AppTokenPayload & { jti: string }> {
    return this.jwt.verifyAsync(token, { secret: this.refreshSecret });
  }

  async verifyStaffRefreshToken(token: string): Promise<StaffTokenPayload & { jti: string }> {
    return this.jwt.verifyAsync(token, { secret: this.refreshSecret });
  }

  /** Refresh tokens are opaque-ish JWTs; only their (PHC-encoded) hash is
   * stored — like a password — never the raw digest, which argon2.verify
   * can't check against on its own. */
  async hashRefreshToken(token: string): Promise<Uint8Array<ArrayBuffer>> {
    return toBytes(await argon2.hash(token));
  }

  verifyRefreshTokenHash(token: string, hash: Uint8Array): Promise<boolean> {
    return argon2.verify(bytesToUtf8(hash), token);
  }
}
