import { randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AppError } from '../../common/errors/app-error';
import { AppAuthService } from './app-auth.service';

type Db = Prisma.TransactionClient | PrismaService;
export type Locale = 'ar' | 'en';

export type Blocker =
  | 'OWNER_HAS_MEMBERS'
  | 'ACTIVE_ORDERS'
  | 'OPEN_REQUESTS'
  | 'PENDING_PAYMENTS'
  | 'PENDING_SETTLEMENTS'
  | 'ACTIVE_CONTRACTS'
  | 'ACTIVE_TRIPS';

const MESSAGES: Record<Blocker, Record<Locale, string>> = {
  OWNER_HAS_MEMBERS: {
    ar: 'أنت مالك منشأة فيها أعضاء آخرون. أزل الأعضاء أولاً.',
    en: 'You own an organization that has other members. Remove them first.',
  },
  ACTIVE_ORDERS: {
    ar: 'لديك طلبات أو شحنات جارية. انتظر اكتمالها أو إلغاءها.',
    en: 'You have orders or shipments in progress. Wait until they finish or are cancelled.',
  },
  OPEN_REQUESTS: {
    ar: 'لديك طلبات مفتوحة. ألغها أولاً.',
    en: 'You have open requests. Cancel them first.',
  },
  PENDING_PAYMENTS: {
    ar: 'لديك مدفوعات قيد المراجعة أو الدفع.',
    en: 'You have payments that are pending.',
  },
  PENDING_SETTLEMENTS: {
    ar: 'لديك مستحقات لم تُصرف بعد.',
    en: 'You have payouts that have not been paid yet.',
  },
  ACTIVE_CONTRACTS: {
    ar: 'لديك عقود شهرية سارية.',
    en: 'You have active monthly contracts.',
  },
  ACTIVE_TRIPS: {
    ar: 'لديك رحلة نقل جارية.',
    en: 'You have a trip in progress.',
  },
};

const MESSAGE_PREFIX: Record<Locale, string> = {
  ar: 'لا يمكن حذف الحساب الآن: ',
  en: 'The account cannot be deleted right now: ',
};

const LIVE_ORDERS = [
  'PENDING_PAYMENT', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'ACTIVE', 'CLOSING',
  'AWAITING_ACCEPTANCE', 'DISPUTED', 'CANCELLATION_REQUESTED',
] as const;

/** A phone number nobody can own: +999 and ten random digits. */
const releasedPhone = () => `+999${String(randomInt(0, 10_000_000_000)).padStart(10, '0')}`;

export function blockedError(blockers: Blocker[], locale: Locale): AppError {
  const lines = blockers.map((b) => MESSAGES[b][locale]);
  return new AppError('ACCOUNT_DELETION_BLOCKED', `${MESSAGE_PREFIX[locale]}${lines.join(' ')}`, {
    details: blockers.map((b) => ({ field: 'account', code: b })),
  });
}

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AppAuthService,
    private readonly audit: AuditService,
  ) {}

  /** What stops this user deleting the account (empty = nothing). Read from [db] so it can run in the transaction. */
  async blockers(userId: string, db: Db = this.prisma): Promise<Blocker[]> {
    const found = new Set<Blocker>();
    const memberships = await db.memberships.findMany({
      where: { user_id: userId, status: 'ACTIVE' },
      select: { organization_id: true, role: true },
    });

    for (const m of memberships) {
      if (m.role === 'DRIVER') {
        const trip = await db.trip_assignments.findFirst({
          where: { driver_user_id: userId, status: 'ACTIVE', ended_at: null },
          select: { id: true },
        });
        if (trip) found.add('ACTIVE_TRIPS');
        continue;
      }
      // Managers and members only leave; the organization carries on without them.
      if (m.role !== 'OWNER') continue;

      const org = m.organization_id;
      const others = await db.memberships.count({
        where: { organization_id: org, status: 'ACTIVE', user_id: { not: userId } },
      });
      if (others > 0) {
        found.add('OWNER_HAS_MEMBERS');
        continue;
      }
      // Alone: the organization closes with the account, so nothing may still be in flight for it.
      const [orders, requests, payments, settlements, contracts] = await Promise.all([
        db.orders.count({
          where: { OR: [{ customer_org_id: org }, { provider_org_id: org }], status: { in: [...LIVE_ORDERS] } },
        }),
        db.service_requests.count({
          where: { customer_org_id: org, status: { in: ['SUBMITTED', 'QUOTED', 'AWAITING_PAYMENT'] } },
        }),
        db.payment_intents.count({ where: { payer_org_id: org, status: { in: ['INITIATED', 'PENDING'] } } }),
        db.settlements.count({
          where: { beneficiary_org_id: org, status: { in: ['SCHEDULED', 'ON_HOLD', 'IN_BATCH'] } },
        }),
        db.recurring_contracts.count({
          where: { OR: [{ customer_org_id: org }, { provider_org_id: org }], status: 'ACTIVE' },
        }),
      ]);
      if (orders) found.add('ACTIVE_ORDERS');
      if (requests) found.add('OPEN_REQUESTS');
      if (payments) found.add('PENDING_PAYMENTS');
      if (settlements) found.add('PENDING_SETTLEMENTS');
      if (contracts) found.add('ACTIVE_CONTRACTS');
    }
    return [...found];
  }

  /** POST /me/account-deletion/otp: a code to the user's own phone. Fails at once when deletion is blocked. */
  async requestOtp(userId: string, locale: Locale, ip?: string) {
    const user = await this.activeUser(userId);
    const blockers = await this.blockers(userId);
    if (blockers.length) throw blockedError(blockers, locale);
    const challenge = await this.auth.requestOtp(user.phone_e164, ip, undefined, {
      purpose: 'ACCOUNT_DELETION',
      userId,
    });
    return { challengeId: challenge.challengeId, expiresAt: challenge.expiresAt };
  }

  /** POST /me/account-deletion/confirm. */
  async confirm(userId: string, challengeId: string, code: string, locale: Locale, meta: { ip?: string; userAgent?: string } = {}) {
    await this.activeUser(userId);
    // Blocked before the code is spent: the person can fix it and use the same code.
    const blockers = await this.blockers(userId);
    if (blockers.length) throw blockedError(blockers, locale);
    await this.auth.spendChallenge(challengeId, code, 'ACCOUNT_DELETION', userId);
    return this.delete(userId, locale, meta);
  }

  /** The web form (no app): a code goes to the phone only if an active account has it, but the answer is
   * the same either way, so the form cannot be used to find out who is registered. */
  async requestPublicOtp(rawPhone: string, ip?: string) {
    const phone = this.auth.normalizePhoneNumber(rawPhone);
    const user = await this.prisma.users.findUnique({ where: { phone_e164: phone } });
    if (!user || user.status !== 'ACTIVE') {
      return { challengeId: randomUUID(), expiresAt: new Date(Date.now() + 5 * 60_000) };
    }
    const challenge = await this.auth.requestOtp(phone, ip, undefined, { purpose: 'ACCOUNT_DELETION', userId: user.id });
    return { challengeId: challenge.challengeId, expiresAt: challenge.expiresAt };
  }

  async confirmPublic(challengeId: string, code: string, locale: Locale, meta: { ip?: string; userAgent?: string } = {}) {
    const challenge = await this.auth.spendChallenge(challengeId, code, 'ACCOUNT_DELETION');
    if (!challenge.user_id) throw new AppError('OTP_INVALID', 'Incorrect code');
    // The phone is proven now, so it is safe to say why a deletion is refused.
    const blockers = await this.blockers(challenge.user_id);
    if (blockers.length) throw blockedError(blockers, locale);
    return this.delete(challenge.user_id, locale, meta);
  }

  private async activeUser(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user || user.status === 'DELETED') throw new AppError('NOT_FOUND', 'Account not found');
    return user;
  }

  /** Soft delete, all or nothing. */
  private async delete(userId: string, locale: Locale, meta: { ip?: string; userAgent?: string }) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Looked at again inside the transaction: something may have started since the first check.
      const blockers = await this.blockers(userId, tx);
      if (blockers.length) throw blockedError(blockers, locale);

      const user = await tx.users.findUniqueOrThrow({ where: { id: userId } });
      const memberships = await tx.memberships.findMany({
        where: { user_id: userId, status: 'ACTIVE' },
        select: { id: true, organization_id: true, role: true },
      });

      for (const m of memberships) {
        await tx.memberships.update({ where: { id: m.id }, data: { status: 'REMOVED', removed_at: now } });
        if (m.role === 'DRIVER') {
          await tx.drivers.updateMany({ where: { membership_id: m.id }, data: { status: 'SUSPENDED' } });
          continue;
        }
        if (m.role !== 'OWNER') continue;

        // The organization was the owner's alone: it closes with the account.
        const org = m.organization_id;
        await tx.organizations.update({ where: { id: org }, data: { status: 'CLOSED' } });
        await tx.org_workspaces.updateMany({
          where: { organization_id: org },
          data: { status: 'SUSPENDED', suspended_at: now, suspension_reason: 'ACCOUNT_DELETED' },
        });
        await tx.products.updateMany({ where: { supplier_org_id: org, status: 'PUBLISHED' }, data: { status: 'PAUSED' } });
        await tx.quotes.updateMany({ where: { provider_org_id: org, status: 'SUBMITTED' }, data: { status: 'WITHDRAWN' } });
        await tx.org_invitations.updateMany({ where: { organization_id: org, used_at: null }, data: { expires_at: now } });
      }

      // Every session and token, and the push tokens with them.
      const sessions = await tx.sessions.findMany({ where: { user_id: userId }, select: { id: true } });
      const sessionIds = sessions.map((s) => s.id);
      await tx.refresh_tokens.updateMany({ where: { session_id: { in: sessionIds }, revoked_at: null }, data: { revoked_at: now } });
      await tx.sessions.updateMany({
        where: { user_id: userId },
        data: { push_token: null, push_token_updated_at: null },
      });
      await tx.sessions.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: now, revoke_reason: 'ACCOUNT_DELETED' },
      });

      // The phone and e-mail are released now; the originals wait, apart, for the anonymization job.
      await tx.users.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deleted_at: now,
          deletion_requested_at: now,
          erasable_phone_e164: user.phone_e164,
          erasable_email: user.email,
          phone_e164: releasedPhone(),
          email: null,
          password_hash: null,
        },
      });

      await this.audit.logUser(
        { userId, action: 'account.deleted', entityType: 'USER', entityId: userId, ip: meta.ip, userAgent: meta.userAgent },
        tx,
      );
    });
    return { deletedAt: now };
  }
}
