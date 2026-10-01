import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** CUSTOMER activates immediately; everything else needs KYB (S2) first —
 * backend/md/modules/02-organizations-kyb-terms.md "Onboarding flows". */
const IMMEDIATE_WORKSPACES = new Set(['CUSTOMER']);

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, kind: 'INDIVIDUAL' | 'BUSINESS', displayName: string) {
    const org = await this.prisma.organizations.create({
      data: {
        id: randomUUID(),
        kind,
        display_name: displayName,
        created_by_user_id: userId,
        memberships: {
          create: { id: randomUUID(), user_id: userId, role: 'OWNER', joined_at: new Date() },
        },
      },
    });
    return { id: org.id, kind: org.kind, displayName: org.display_name, status: org.status };
  }

  /** Throws FORBIDDEN unless `userId` is an active member of `orgId`. */
  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
    return membership;
  }

  async addWorkspace(
    orgId: string,
    userId: string,
    workspace: 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER',
    activities?: string[],
  ) {
    await this.requireMembership(orgId, userId);

    const existing = await this.prisma.org_workspaces.findUnique({
      where: { organization_id_workspace: { organization_id: orgId, workspace } },
    });
    if (existing) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Workspace already exists for this organization');
    }

    const ws = await this.prisma.org_workspaces.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        workspace,
        status: IMMEDIATE_WORKSPACES.has(workspace) ? 'ACTIVE' : 'PENDING_VERIFICATION',
        activated_at: IMMEDIATE_WORKSPACES.has(workspace) ? new Date() : undefined,
      },
    });

    if (activities?.length) {
      await this.prisma.provider_activities.createMany({
        data: activities.map((activity) => ({
          id: randomUUID(),
          organization_id: orgId,
          activity: activity as never,
        })),
        skipDuplicates: true,
      });
    }

    return { id: ws.id, workspace: ws.workspace, status: ws.status };
  }
}
