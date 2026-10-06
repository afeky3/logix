import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { toBytes, bytesToUtf8 } from '../../common/util/bytes';
import { TokenService } from './token.service';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const STAFF_SESSION_IDLE_MIN = 30;
const STAFF_SESSION_ABSOLUTE_HOURS = 8;
const BACKUP_CODE_COUNT = 8;

/**
 * Staff login + TOTP MFA — backend/md/06-security-compliance.md §1.
 *
 * TODO(hardening): `totp_secret_enc` is stored as plain UTF-8 bytes for now.
 * The schema names it "enc" because it should be envelope-encrypted (KMS);
 * that needs a secrets/KMS setup this test server doesn't have yet.
 */
@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Password login. The TOTP step is switched off for now (testing), so a
   * correct password opens the session right away. To bring MFA back, return
   * the mfaToken challenge here instead, as `setupMfa`/`verifyMfa` expect.
   */
  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const staff = await this.prisma.staff_users.findUnique({ where: { email } });
    // Same response whether the email exists or not, to avoid enumeration.
    const genericError = () => new AppError('UNAUTHENTICATED', 'Invalid email or password');

    // INVITED = allowed to log in only to complete first-time MFA enrollment
    // (ck_staff_active_2fa forbids ACTIVE without TOTP set).
    if (!staff || staff.status === 'DEACTIVATED') throw genericError();
    if (staff.locked_until && staff.locked_until > new Date()) {
      throw new AppError('ACCOUNT_SUSPENDED', 'Account temporarily locked. Try again later.');
    }
    if (!staff.password_hash) throw genericError();

    const ok = await argon2.verify(staff.password_hash, password);
    if (!ok) {
      const failed = staff.failed_login_count + 1;
      await this.prisma.staff_users.update({
        where: { id: staff.id },
        data: {
          failed_login_count: failed,
          locked_until:
            failed >= MAX_FAILED_LOGINS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : undefined,
        },
      });
      throw genericError();
    }

    await this.prisma.staff_users.update({
      where: { id: staff.id },
      data: { failed_login_count: 0 },
    });

    return this.openSession(staff, ip, userAgent, new Date());
  }

  async setupMfa(mfaToken: string) {
    const { sub: staffId } = await this.verifyMfaToken(mfaToken);
    const staff = await this.prisma.staff_users.findUniqueOrThrow({ where: { id: staffId } });

    const secret = authenticator.generateSecret();
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase(),
    );
    const backupCodeHashes = await Promise.all(
      backupCodes.map((c) => argon2.hash(c)),
    );

    await this.prisma.staff_users.update({
      where: { id: staff.id },
      data: { totp_secret_enc: toBytes(secret), backup_code_hashes: backupCodeHashes },
    });

    const issuer = this.config.get<string>('STAFF_MFA_ISSUER', 'Logix');
    return {
      otpauthUrl: authenticator.keyuri(staff.email, issuer, secret),
      secret,
      backupCodes,
    };
  }

  async verifyMfa(mfaToken: string, code: string, ip?: string, userAgent?: string) {
    const { sub: staffId } = await this.verifyMfaToken(mfaToken);
    const staff = await this.prisma.staff_users.findUniqueOrThrow({ where: { id: staffId } });
    if (!staff.totp_secret_enc) {
      throw new AppError('VALIDATION_FAILED', 'Call mfa/setup first');
    }

    const secret = bytesToUtf8(staff.totp_secret_enc);
    let matched = authenticator.check(code, secret);
    let usedBackupCode: string | null = null;

    if (!matched) {
      for (const hash of staff.backup_code_hashes) {
        if (await argon2.verify(hash, code)) {
          matched = true;
          usedBackupCode = hash;
          break;
        }
      }
    }
    if (!matched) throw new AppError('OTP_INVALID', 'Invalid authentication code');

    await this.prisma.staff_users.update({
      where: { id: staff.id },
      data: {
        totp_enrolled_at: staff.totp_enrolled_at ?? new Date(),
        status: staff.status === 'INVITED' ? 'ACTIVE' : undefined,
        last_login_at: new Date(),
        backup_code_hashes: usedBackupCode
          ? staff.backup_code_hashes.filter((h) => h !== usedBackupCode)
          : undefined,
      },
    });

    return this.openSession(staff, ip, userAgent, new Date());
  }

  /** Creates the staff session row and returns its tokens (shared by login and MFA verify). */
  private async openSession(
    staff: { id: string; email: string; full_name: string },
    ip: string | undefined,
    userAgent: string | undefined,
    now: Date,
  ) {
    const session = await this.prisma.staff_sessions.create({
      data: {
        id: randomUUID(),
        staff_user_id: staff.id,
        refresh_token_hash: new Uint8Array(), // replaced right below
        ip,
        user_agent: userAgent,
        mfa_verified_at: now,
        idle_expires_at: new Date(now.getTime() + STAFF_SESSION_IDLE_MIN * 60 * 1000),
        absolute_expires_at: new Date(now.getTime() + STAFF_SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000),
      },
    });

    const issued = await this.tokens.issueStaffTokens(staff.id, session.id);
    await this.prisma.staff_sessions.update({
      where: { id: session.id },
      data: { refresh_token_hash: issued.refreshTokenHash },
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      staff: { id: staff.id, email: staff.email, fullName: staff.full_name },
    };
  }

  /** Staff sessions hold one refresh token hash each (no separate table like
   * identity.refresh_tokens for app sessions) — rotation just replaces it. */
  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = await this.tokens.verifyStaffRefreshToken(refreshToken);
    } catch {
      throw new AppError('TOKEN_EXPIRED', 'Invalid or expired refresh token');
    }

    const session = await this.prisma.staff_sessions.findUnique({ where: { id: payload.sid } });
    if (!session || session.revoked_at || session.absolute_expires_at < new Date()) {
      throw new AppError('UNAUTHENTICATED', 'Session no longer valid');
    }

    const matches = await this.tokens.verifyRefreshTokenHash(refreshToken, session.refresh_token_hash);
    if (!matches) {
      await this.prisma.staff_sessions.update({
        where: { id: session.id },
        data: { revoked_at: new Date() },
      });
      throw new AppError('UNAUTHENTICATED', 'Refresh token reuse detected — session revoked');
    }
    if (session.idle_expires_at < new Date()) {
      await this.prisma.staff_sessions.update({
        where: { id: session.id },
        data: { revoked_at: new Date() },
      });
      throw new AppError('UNAUTHENTICATED', 'Session idle timeout — log in again');
    }

    const issued = await this.tokens.issueStaffTokens(session.staff_user_id, session.id);
    const now = new Date();
    await this.prisma.staff_sessions.update({
      where: { id: session.id },
      data: {
        refresh_token_hash: issued.refreshTokenHash,
        last_seen_at: now,
        idle_expires_at: new Date(now.getTime() + STAFF_SESSION_IDLE_MIN * 60 * 1000),
      },
    });

    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.staff_sessions.update({
      where: { id: sessionId },
      data: { revoked_at: new Date() },
    });
  }

  async me(staffId: string) {
    const staff = await this.prisma.staff_users.findUniqueOrThrow({ where: { id: staffId } });
    return {
      id: staff.id,
      email: staff.email,
      fullName: staff.full_name,
      locale: staff.locale,
      // TODO(RBAC): populate from staff_user_roles → staff_role_permissions.
      permissions: [] as string[],
    };
  }

  private async verifyMfaToken(token: string): Promise<{ sub: string }> {
    try {
      const payload = await this.tokens.verifyMfaChallengeToken(token);
      return payload;
    } catch {
      throw new AppError('TOKEN_EXPIRED', 'MFA challenge expired — log in again');
    }
  }
}
