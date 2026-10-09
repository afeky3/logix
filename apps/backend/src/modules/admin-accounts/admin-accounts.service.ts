import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/**
 * Staff view of app accounts: find a user, see what they belong to, and
 * suspend or reactivate them. Read-mostly; the only write is `status`.
 */
@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { q?: string; status?: 'ACTIVE' | 'SUSPENDED'; limit: number; offset: number }) {
    const q = opts.q?.trim();
    const where = {
      anonymized_at: null,
      ...(opts.status ? { status: opts.status } : { status: { not: 'DELETED' as const } }),
      ...(q
        ? {
            OR: [
              { phone_e164: { contains: q } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { full_name: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.users.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        select: {
          id: true,
          phone_e164: true,
          email: true,
          full_name: true,
          status: true,
          last_login_at: true,
          created_at: true,
          memberships_memberships_user_idTousers: {
            select: {
              role: true,
              organizations: { select: { id: true, display_name: true, kind: true } },
            },
          },
        },
      }),
      this.prisma.users.count({ where }),
    ]);
    return {
      total,
      items: rows.map((u) => ({
        id: u.id,
        phone: u.phone_e164,
        email: u.email,
        fullName: u.full_name,
        status: u.status,
        lastLoginAt: u.last_login_at,
        createdAt: u.created_at,
        organizations: u.memberships_memberships_user_idTousers.map((m) => ({
          id: m.organizations.id,
          name: m.organizations.display_name,
          kind: m.organizations.kind,
          role: m.role,
        })),
      })),
    };
  }

  async get(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone_e164: true,
        email: true,
        full_name: true,
        locale: true,
        status: true,
        password_hash: true,
        last_login_at: true,
        created_at: true,
      },
    });
    if (!user) throw new AppError('NOT_FOUND', 'Account not found');

    const memberships = await this.prisma.memberships.findMany({
      where: { user_id: userId },
      include: { organizations: { select: { id: true, display_name: true, kind: true, status: true } } },
    });
    const orgIds = memberships.map((m) => m.organization_id);

    const [workspaces, cases, sessions] = await Promise.all([
      this.prisma.org_workspaces.findMany({ where: { organization_id: { in: orgIds } } }),
      this.prisma.verification_cases.findMany({
        where: { organization_id: { in: orgIds } },
        orderBy: { created_at: 'desc' },
        select: { id: true, organization_id: true, workspace: true, status: true, submitted_at: true },
      }),
      this.prisma.sessions.count({ where: { user_id: userId, revoked_at: null } }),
    ]);

    return {
      id: user.id,
      phone: user.phone_e164,
      email: user.email,
      fullName: user.full_name,
      locale: user.locale,
      status: user.status,
      hasPassword: user.password_hash != null,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      activeSessions: sessions,
      organizations: memberships.map((m) => ({
        id: m.organizations.id,
        name: m.organizations.display_name,
        kind: m.organizations.kind,
        orgStatus: m.organizations.status,
        membershipRole: m.role,
        membershipStatus: m.status,
        workspaces: workspaces
          .filter((w) => w.organization_id === m.organization_id)
          .map((w) => ({ workspace: w.workspace, status: w.status })),
        verificationCases: cases
          .filter((c) => c.organization_id === m.organization_id)
          .map((c) => ({ id: c.id, workspace: c.workspace, status: c.status, submittedAt: c.submitted_at })),
      })),
    };
  }

  /** Suspending also revokes every live app session, so the user is signed
   * out on their next refresh. Reactivating just flips the status back. */
  async setStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user) throw new AppError('NOT_FOUND', 'Account not found');
    if (user.status === 'DELETED') throw new AppError('BUSINESS_RULE_VIOLATION', 'Deleted accounts cannot change status');

    await this.prisma.users.update({ where: { id: userId }, data: { status } });
    if (status === 'SUSPENDED') {
      await this.prisma.sessions.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    return { id: userId, status };
  }
}
