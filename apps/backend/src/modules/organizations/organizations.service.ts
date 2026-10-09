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

  /** Public-facing profile a buyer sees for a provider they got a quote
   * from (Q03 → "view provider"). No membership required — this is
   * intentionally visible to any authenticated user, same as a quote's
   * providerName already is. Never exposes contacts/documents (D-16). */
  async getProviderProfile(organizationId: string) {
    const org = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      include: {
        org_workspaces: { where: { workspace: 'PROVIDER' } },
        provider_activities: { where: { status: 'APPROVED' } },
      },
    });
    if (!org || org.org_workspaces.length === 0) {
      throw new AppError('NOT_FOUND', 'Provider not found');
    }
    const workspace = org.org_workspaces[0];

    const [completedOrders, totalOrders, ratings] = await Promise.all([
      this.prisma.orders.count({ where: { provider_org_id: organizationId, status: 'SCHEDULED' } }),
      this.prisma.orders.count({ where: { provider_org_id: organizationId } }),
      this.prisma.ratings.findMany({
        where: { ratee_org_id: organizationId, status: 'PUBLISHED' },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { stars: true, comment: true, created_at: true },
      }),
    ]);

    return {
      id: org.id,
      displayName: org.display_name,
      logoFileId: org.logo_file_id ?? null,
      verified: workspace.status === 'ACTIVE',
      memberSince: workspace.activated_at,
      ratingAvg: org.rating_avg ? Number(org.rating_avg) : null,
      ratingCount: org.rating_count,
      // "Completed" has no real meaning yet — there's no post-SCHEDULED
      // completion flow built (module 06's broader scope). This counts
      // orders that reached SCHEDULED (the furthest state reachable today)
      // instead of fabricating a completion number.
      scheduledOrdersCount: completedOrders,
      totalOrdersCount: totalOrders,
      activities: org.provider_activities.map((a) => a.activity),
      reviews: ratings.map((r) => ({ stars: r.stars, comment: r.comment, createdAt: r.created_at })),
    };
  }

  /** Provider coverage used by matching's service-area filter
   * (requests.service.ts `filterByServiceArea`). `areaType: 'COUNTRY'`
   * with `countryCode: 'SA'` means "covers all of Saudi"; `'REGION'`
   * with a `ref.regions` code covers one region only (migrations/007
   * seeded Saudi's 13 regions — city-level isn't supported yet, see that
   * migration's doc on why: free-text geocoding can't reliably resolve
   * one of hundreds of city names, only the ~13 regions). */
  async addServiceArea(
    orgId: string,
    userId: string,
    activity: string,
    areaType: 'COUNTRY' | 'REGION',
    code: string,
  ) {
    await this.requireMembership(orgId, userId);
    const providerActivity = await this.prisma.provider_activities.findUnique({
      where: { organization_id_activity: { organization_id: orgId, activity: activity as never } },
    });
    if (!providerActivity) {
      throw new AppError('NOT_FOUND', 'This organization has no such provider activity');
    }
    const area = await this.prisma.service_areas.create({
      data: {
        id: randomUUID(),
        provider_activity_id: providerActivity.id,
        area_type: areaType,
        country_code: areaType === 'COUNTRY' ? code : undefined,
        region_code: areaType === 'REGION' ? code : undefined,
      },
    });
    return { id: area.id, activity, areaType: area.area_type, code };
  }

  async listServiceAreas(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const rows = await this.prisma.service_areas.findMany({
      where: { provider_activities: { organization_id: orgId } },
      include: { provider_activities: { select: { activity: true } } },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      activity: r.provider_activities.activity,
      areaType: r.area_type,
      code: r.area_type === 'COUNTRY' ? r.country_code : r.region_code,
    }));
  }

  async removeServiceArea(orgId: string, userId: string, areaId: string) {
    await this.requireMembership(orgId, userId);
    const area = await this.prisma.service_areas.findUnique({
      where: { id: areaId },
      include: { provider_activities: { select: { organization_id: true } } },
    });
    if (!area || area.provider_activities.organization_id !== orgId) {
      throw new AppError('NOT_FOUND', 'Service area not found');
    }
    await this.prisma.service_areas.delete({ where: { id: areaId } });
    return { success: true };
  }

  /** Org summary for the account screen — member's own org card. */
  async getOrgSummary(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const [org, memberCount] = await Promise.all([
      this.prisma.organizations.findUnique({
        where: { id: orgId },
        select: { id: true, display_name: true, kind: true, logo_file_id: true },
      }),
      this.prisma.memberships.count({ where: { organization_id: orgId, status: 'ACTIVE' } }),
    ]);
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');
    return {
      id: org.id,
      name: org.display_name,
      kind: org.kind,
      logoFileId: org.logo_file_id ?? null,
      memberCount,
    };
  }
}
