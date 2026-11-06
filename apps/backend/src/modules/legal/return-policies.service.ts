import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface ReturnPolicyInput {
  text: string;
  returnWindowDays?: number | null;
  allowsReturn: boolean;
  allowsExchange: boolean;
}

type VersionRow = {
  id: string;
  version: number;
  text: string;
  return_window_days: number | null;
  allows_return: boolean;
  allows_exchange: boolean;
  created_at: Date;
};

/** The app sends the version back as a string (returnPolicyVersion), so it is a string here too. */
export function serializePolicy(v: VersionRow) {
  return {
    text: v.text,
    returnWindowDays: v.return_window_days,
    allowsReturn: v.allows_return,
    allowsExchange: v.allows_exchange,
    version: String(v.version),
    updatedAt: v.created_at,
  };
}

/** Suppliers' return/exchange policy. Every PUT appends a version; old ones are kept so an
 * acceptance can point at the exact text the buyer saw. */
@Injectable()
export class ReturnPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The version in force, or null when the supplier has none. */
  async currentVersion(orgId: string): Promise<VersionRow | null> {
    const pointer = await this.prisma.return_policies.findUnique({ where: { organization_id: orgId } });
    if (!pointer) return null;
    return this.prisma.return_policy_versions.findUnique({ where: { id: pointer.current_version_id } });
  }

  async get(orgId: string) {
    const org = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');
    const v = await this.currentVersion(orgId);
    return v ? serializePolicy(v) : null;
  }

  async put(orgId: string, userId: string, input: ReturnPolicyInput) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
      throw new AppError('FORBIDDEN', 'Only an owner or manager can change the return policy');
    }
    const supplier = await this.prisma.org_workspaces.findUnique({
      where: { organization_id_workspace: { organization_id: orgId, workspace: 'SUPPLIER' } },
    });
    if (!supplier) {
      throw new AppError('FORBIDDEN', 'Only a supplier account has a return policy');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Serialises concurrent PUTs for one supplier so versions stay 1, 2, 3...
        await tx.$queryRaw`SELECT id FROM org.organizations WHERE id = ${orgId}::uuid FOR UPDATE`;
        const last = await tx.return_policy_versions.findFirst({
          where: { organization_id: orgId },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const v = await tx.return_policy_versions.create({
          data: {
            id: randomUUID(),
            organization_id: orgId,
            version: (last?.version ?? 0) + 1,
            text: input.text.trim(),
            return_window_days: input.returnWindowDays ?? null,
            allows_return: input.allowsReturn,
            allows_exchange: input.allowsExchange,
            created_by_user_id: userId,
          },
        });
        await tx.return_policies.upsert({
          where: { organization_id: orgId },
          create: { organization_id: orgId, current_version_id: v.id },
          update: { current_version_id: v.id, updated_at: new Date() },
        });
        return v;
      });
      return serializePolicy(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError('VERSION_CONFLICT', 'The return policy changed at the same time, try again');
      }
      throw e;
    }
  }

  /** Every version, newest first (dashboard). */
  async history(orgId: string) {
    const [pointer, versions] = await Promise.all([
      this.prisma.return_policies.findUnique({ where: { organization_id: orgId } }),
      this.prisma.return_policy_versions.findMany({
        where: { organization_id: orgId },
        orderBy: { version: 'desc' },
      }),
    ]);
    const authors = await this.prisma.users.findMany({
      where: { id: { in: [...new Set(versions.map((v) => v.created_by_user_id))] } },
      select: { id: true, full_name: true },
    });
    const name = new Map(authors.map((a) => [a.id, a.full_name]));
    return {
      currentVersion: versions.find((v) => v.id === pointer?.current_version_id)?.version.toString() ?? null,
      items: versions.map((v) => ({
        ...serializePolicy(v),
        isCurrent: v.id === pointer?.current_version_id,
        createdByUserId: v.created_by_user_id,
        createdByName: name.get(v.created_by_user_id) ?? null,
      })),
    };
  }
}
