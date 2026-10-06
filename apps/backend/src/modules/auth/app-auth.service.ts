import { randomInt, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { toBytes, bytesToUtf8 } from '../../common/util/bytes';
import { TokenService } from './token.service';
import { WhatsAppOtpSender } from '../../infrastructure/notifications/whatsapp-otp.sender';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
const OTP_MAX_PER_HOUR = 5;
const SESSION_TTL_DAYS = 30;

export interface OtpRequestResult {
  challengeId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export interface VerifyDevice {
  id: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string | null;
  pushToken?: string | null;
}

@Injectable()
export class AppAuthService {
  private readonly logger = new Logger(AppAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
    private readonly whatsappOtp: WhatsAppOtpSender,
  ) {}

  /** Best-effort E.164 normalization. Phone format is intentionally
   * relaxed on the client (see logic-app form_validators.dart) until D-26
   * (launch geography) is confirmed, so we don't reject here either —
   * we just normalize what we can and store the rest as given. */
  private normalizePhone(raw: string): string {
    try {
      return parsePhoneNumberWithError(raw, 'SA').number;
    } catch {
      return raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`;
    }
  }

  async requestOtp(rawPhone: string, ip?: string, deviceId?: string): Promise<OtpRequestResult> {
    const phone = this.normalizePhone(rawPhone);
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const [recentCount, lastChallenge] = await Promise.all([
      this.prisma.otp_challenges.count({
        where: { phone_e164: phone, created_at: { gte: since } },
      }),
      this.prisma.otp_challenges.findFirst({
        where: { phone_e164: phone },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    if (recentCount >= OTP_MAX_PER_HOUR) {
      throw new AppError('RATE_LIMITED', 'Too many codes requested. Try again later.');
    }
    if (lastChallenge && lastChallenge.resend_available_at > new Date()) {
      throw new AppError('RATE_LIMITED', 'Please wait before requesting another code.', {
        retryable: true,
      });
    }

    const isProd = this.config.get<string>('NODE_ENV') === 'prod';
    const deliveryChannel = this.config.get<string>('OTP_DELIVERY_CHANNEL', 'fake');
    const viaWhatsapp = deliveryChannel === 'whatsapp';
    // Real delivery (or prod) gets a random code; plain fake mode keeps the
    // fixed convenience code so local/dev testing doesn't need a real phone.
    const code =
      isProd || viaWhatsapp
        ? String(randomInt(0, 1_000_000)).padStart(6, '0')
        : this.config.get<string>('OTP_TEST_CODE', '123456');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);

    const challenge = await this.prisma.otp_challenges.create({
      data: {
        id: randomUUID(),
        phone_e164: phone,
        purpose: 'SIGN_IN',
        code_hash: toBytes(await argon2.hash(code)),
        expires_at: expiresAt,
        resend_available_at: resendAvailableAt,
        ip,
        device_id: deviceId,
        sms_provider: viaWhatsapp ? 'whatsapp-evolution' : isProd ? null : 'fake',
      },
    });

    if (viaWhatsapp) {
      // Stand-in for T-04 (no real SMS provider yet) — see
      // whatsapp-otp.sender.ts. Delivery failure must not block the
      // request: the challenge still exists and the user can retry/resend.
      try {
        await this.whatsappOtp.send(phone, code);
      } catch (err) {
        this.logger.error(
          `[whatsapp] Failed to deliver OTP to ${phone} (challenge ${challenge.id}): ${err instanceof Error ? err.message : err}`,
        );
      }
      if (!isProd) {
        this.logger.debug(`[whatsapp-debug] OTP for ${phone}: ${code} (challenge ${challenge.id})`);
      }
    } else if (!isProd) {
      // Fake SMS sink — see planning/backend/md/12-execution-plan.md §2 (T-04 open).
      this.logger.log(`[fake-sms] OTP for ${phone}: ${code} (challenge ${challenge.id})`);
    } else {
      // TODO(T-04): no SMS provider wired yet — this code is generated but never delivered.
      this.logger.warn(`OTP generated for ${phone} but no SMS provider is configured (T-04)`);
    }

    return { challengeId: challenge.id, expiresAt, resendAvailableAt };
  }

  async verifyOtp(challengeId: string, code: string, device: VerifyDevice, ip?: string) {
    const challenge = await this.prisma.otp_challenges.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError('VALIDATION_FAILED', 'Unknown verification challenge');
    if (challenge.verified_at) {
      throw new AppError('OTP_INVALID', 'This code has already been used');
    }
    if (challenge.locked_at || challenge.attempts >= challenge.max_attempts) {
      throw new AppError('OTP_INVALID', 'Too many attempts. Request a new code.');
    }
    if (challenge.expires_at < new Date()) {
      throw new AppError('OTP_EXPIRED', 'This code has expired');
    }

    const ok = await argon2.verify(bytesToUtf8(challenge.code_hash), code);
    if (!ok) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otp_challenges.update({
        where: { id: challengeId },
        data: {
          attempts,
          locked_at: attempts >= challenge.max_attempts ? new Date() : undefined,
        },
      });
      throw new AppError('OTP_INVALID', 'Incorrect code');
    }

    await this.prisma.otp_challenges.update({
      where: { id: challengeId },
      data: { verified_at: new Date() },
    });

    let user = await this.prisma.users.findUnique({ where: { phone_e164: challenge.phone_e164 } });
    const isNewUser = !user;
    if (!user) {
      user = await this.prisma.users.create({
        data: { id: randomUUID(), phone_e164: challenge.phone_e164 },
      });
    } else {
      await this.prisma.users.update({
        where: { id: user.id },
        data: { last_login_at: new Date() },
      });
    }

    return this.issueSession(user, device, ip, isNewUser);
  }

  /** Password login: phone or email + password. Same session/tokens as OTP. */
  async loginWithPassword(identifier: string, password: string, device: VerifyDevice, ip?: string) {
    const user = identifier.includes('@')
      ? await this.prisma.users.findFirst({ where: { email: identifier.toLowerCase() } })
      : await this.prisma.users.findUnique({ where: { phone_e164: this.normalizePhone(identifier) } });
    // Same error for "no such user" and "wrong password" — don't leak which.
    const ok =
      user?.password_hash != null && (await argon2.verify(user.password_hash, password));
    if (!user || !ok) {
      throw new AppError('UNAUTHENTICATED', 'Invalid phone/email or password');
    }
    await this.prisma.users.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    return this.issueSession(user, device, ip, false);
  }

  /** Set or reset the password. Proves control of the phone with a fresh
   * OTP challenge (the same one requestOtp issues), optionally setting the
   * email login identifier too. */
  async setPassword(
    challengeId: string,
    code: string,
    password: string,
    email?: string,
  ) {
    const challenge = await this.prisma.otp_challenges.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError('VALIDATION_FAILED', 'Unknown verification challenge');
    if (challenge.verified_at) throw new AppError('OTP_INVALID', 'This code has already been used');
    if (challenge.locked_at || challenge.attempts >= challenge.max_attempts) {
      throw new AppError('OTP_INVALID', 'Too many attempts. Request a new code.');
    }
    if (challenge.expires_at < new Date()) throw new AppError('OTP_EXPIRED', 'This code has expired');

    const ok = await argon2.verify(bytesToUtf8(challenge.code_hash), code);
    if (!ok) {
      const attempts = challenge.attempts + 1;
      await this.prisma.otp_challenges.update({
        where: { id: challengeId },
        data: { attempts, locked_at: attempts >= challenge.max_attempts ? new Date() : undefined },
      });
      throw new AppError('OTP_INVALID', 'Incorrect code');
    }
    await this.prisma.otp_challenges.update({
      where: { id: challengeId },
      data: { verified_at: new Date() },
    });

    // Same as OTP verify: a first-time phone gets its account created here.
    const user =
      (await this.prisma.users.findUnique({ where: { phone_e164: challenge.phone_e164 } })) ??
      (await this.prisma.users.create({
        data: { id: randomUUID(), phone_e164: challenge.phone_e164 },
      }));
    if (email) {
      const taken = await this.prisma.users.findFirst({
        where: { email: email.toLowerCase(), NOT: { id: user.id } },
      });
      if (taken) throw new AppError('BUSINESS_RULE_VIOLATION', 'This email is already used by another account');
    }
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: await argon2.hash(password),
        ...(email ? { email: email.toLowerCase() } : {}),
      },
    });
    return { success: true };
  }

  private async issueSession(
    user: { id: string; phone_e164: string; full_name: string | null; locale: string },
    device: VerifyDevice,
    ip: string | undefined,
    isNewUser: boolean,
  ) {
    const session = await this.prisma.sessions.create({
      data: {
        id: randomUUID(),
        user_id: user.id,
        device_id: device.id,
        platform: device.platform,
        app_version: device.appVersion,
        push_token: device.pushToken,
        push_token_updated_at: device.pushToken ? new Date() : undefined,
        ip,
        expires_at: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const { accessToken, refreshToken, refreshTokenHash } = await this.tokens.issueAppTokens(
      user.id,
      session.id,
    );
    await this.prisma.refresh_tokens.create({
      data: { id: randomUUID(), session_id: session.id, token_hash: refreshTokenHash },
    });

    return {
      accessToken,
      refreshToken,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone_e164,
        fullName: user.full_name,
        locale: user.locale,
      },
      workspaces: await this.getWorkspaces(user.id),
    };
  }

  async getWorkspaces(userId: string) {
    const memberships = await this.prisma.memberships.findMany({
      where: { user_id: userId, status: 'ACTIVE' },
      include: { organizations: { include: { org_workspaces: true } } },
    });
    return memberships.flatMap((m) =>
      m.organizations.org_workspaces.map((w) => ({
        organizationId: m.organization_id,
        organizationName: m.organizations.display_name,
        workspace: w.workspace,
        status: w.status,
        role: m.role,
      })),
    );
  }

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = await this.tokens.verifyAppRefreshToken(refreshToken);
    } catch {
      throw new AppError('TOKEN_EXPIRED', 'Invalid or expired refresh token');
    }

    const session = await this.prisma.sessions.findUnique({ where: { id: payload.sid } });
    if (!session || session.revoked_at) {
      throw new AppError('UNAUTHENTICATED', 'Session no longer valid');
    }

    const stored = await this.prisma.refresh_tokens.findFirst({
      where: { session_id: session.id, revoked_at: null },
      orderBy: { issued_at: 'desc' },
    });
    const matches =
      stored && (await this.tokens.verifyRefreshTokenHash(refreshToken, stored.token_hash));

    if (!stored || !matches) {
      // Reuse of an old/rotated token: revoke the whole session (D-19 reuse detection).
      await this.prisma.sessions.update({
        where: { id: session.id },
        data: { revoked_at: new Date(), revoke_reason: 'refresh_token_reuse' },
      });
      await this.prisma.refresh_tokens.updateMany({
        where: { session_id: session.id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      throw new AppError('UNAUTHENTICATED', 'Refresh token reuse detected — session revoked');
    }

    await this.prisma.refresh_tokens.update({
      where: { id: stored.id },
      data: { revoked_at: new Date(), rotated_at: new Date() },
    });
    await this.prisma.sessions.update({
      where: { id: session.id },
      data: { last_seen_at: new Date() },
    });

    const issued = await this.tokens.issueAppTokens(session.user_id, session.id);
    await this.prisma.refresh_tokens.create({
      data: { id: randomUUID(), session_id: session.id, token_hash: issued.refreshTokenHash },
    });

    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.sessions.update({
      where: { id: sessionId },
      data: { revoked_at: new Date(), revoke_reason: 'logout' },
    });
    await this.prisma.refresh_tokens.updateMany({
      where: { session_id: sessionId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      phone: user.phone_e164,
      email: user.email,
      fullName: user.full_name,
      locale: user.locale,
      status: user.status,
    };
  }

  async updateMe(
    userId: string,
    patch: { fullName?: string; email?: string; locale?: 'ar' | 'en' },
  ) {
    const user = await this.prisma.users.update({
      where: { id: userId },
      data: {
        full_name: patch.fullName,
        email: patch.email,
        locale: patch.locale,
      },
    });
    return {
      id: user.id,
      phone: user.phone_e164,
      email: user.email,
      fullName: user.full_name,
      locale: user.locale,
      status: user.status,
    };
  }

  async updatePushToken(sessionId: string, pushToken: string): Promise<void> {
    await this.prisma.sessions.update({
      where: { id: sessionId },
      data: { push_token: pushToken, push_token_updated_at: new Date() },
    });
  }
}
