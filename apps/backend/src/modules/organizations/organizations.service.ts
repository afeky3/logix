import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { CountriesService } from '../../common/countries/countries.service';

/** CUSTOMER activates immediately; everything else needs KYB (S2) first —
 * backend/md/modules/02-organizations-kyb-terms.md "Onboarding flows". */
const IMMEDIATE_WORKSPACES = new Set(['CUSTOMER']);

export type WorkspaceKind = 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER';

/** An account (role) to open together with the organization. */
export interface InitialWorkspace {
  workspace: WorkspaceKind;
  activities?: string[];
}

/** New workspaces start ACTIVE (customer) or wait for verification (everything else). */
function workspaceFields(workspace: WorkspaceKind) {
  const immediate = IMMEDIATE_WORKSPACES.has(workspace);
  return {
    id: randomUUID(),
    workspace,
    status: immediate ? ('ACTIVE' as const) : ('PENDING_VERIFICATION' as const),
    activated_at: immediate ? new Date() : undefined,
  };
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly countries: CountriesService,
  ) {}

  /** Creates the organization with its owner. With [initial] the first account (and, for a
   * provider, its activities) is created in the same write: either everything exists afterwards or
   * nothing does, so nobody ends up with an organization that has no account. */
  async create(
    userId: string,
    kind: 'INDIVIDUAL' | 'BUSINESS',
    displayName: string,
    countryCode?: string,
    initial?: InitialWorkspace,
    /** Pass the caller's transaction to make this part of a larger atomic write (registration). */
    tx?: Prisma.TransactionClient,
  ) {
    const country = countryCode ? await this.countries.assertValid(countryCode) : undefined;
    const orgId = randomUUID();
    const activities = initial?.activities ?? [];
    const org = await (tx ?? this.prisma).organizations.create({
      data: {
        id: orgId,
        kind,
        display_name: displayName,
        ...(country && { country_code: country }),
        created_by_user_id: userId,
        memberships: {
          create: { id: randomUUID(), user_id: userId, role: 'OWNER', joined_at: new Date() },
        },
        ...(initial && { org_workspaces: { create: workspaceFields(initial.workspace) } }),
        ...(activities.length > 0 && {
          provider_activities: {
            createMany: {
              data: activities.map((activity) => ({ id: randomUUID(), activity: activity as never })),
              skipDuplicates: true,
            },
          },
        }),
      },
      include: { org_workspaces: true },
    });
    const ws = org.org_workspaces?.[0];
    return {
      id: org.id,
      kind: org.kind,
      displayName: org.display_name,
      status: org.status,
      ...(await this.countries.label(org.country_code)),
      ...(ws && { workspace: { id: ws.id, workspace: ws.workspace, status: ws.status } }),
    };
  }

  /** The account's country. Existing products and requests keep the country they were made with. */
  async setCountry(orgId: string, userId: string, countryCode: string) {
    const membership = await this.requireMembership(orgId, userId);
    if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
      throw new AppError('FORBIDDEN', 'Only an owner or manager can change the account country');
    }
    const country = await this.countries.assertValid(countryCode);
    await this.prisma.organizations.update({ where: { id: orgId }, data: { country_code: country } });
    return { id: orgId, ...(await this.countries.label(country)) };
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
    workspace: WorkspaceKind,
    activities?: string[],
  ) {
    const membership = await this.requireMembership(orgId, userId);
    // Opening another account changes what the whole organization can do: owner only.
    if (membership.role !== 'OWNER') {
      throw new AppError('FORBIDDEN', 'Only the owner can add an account to the organization');
    }

    const existing = await this.prisma.org_workspaces.findUnique({
      where: { organization_id_workspace: { organization_id: orgId, workspace } },
    });
    if (existing) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Workspace already exists for this organization');
    }

    const ws = await this.prisma.org_workspaces.create({
      data: { ...workspaceFields(workspace), organization_id: orgId },
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

  /**
   * What a buyer sees of a supplier before ordering. Any signed-in user; no contacts or documents. Only
   * what is recorded: there is no company description and no supply orders (a supply order is a chat),
   * so `about` and `completedOrdersCount` are null, and a rating is present only when ratings exist.
   * `city` is the district of the registered address.
   */
  async getSupplierProfile(organizationId: string) {
    const org = await this.prisma.organizations.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        display_name: true,
        logo_file_id: true,
        country_code: true,
        created_at: true,
        org_workspaces: { where: { workspace: 'SUPPLIER' }, select: { status: true } },
      },
    });
    if (!org || org.org_workspaces.length === 0) throw new AppError('NOT_FOUND', 'Supplier not found');

    const [productsCount, address, ratings] = await Promise.all([
      this.prisma.products.count({ where: { supplier_org_id: organizationId, status: 'PUBLISHED', deleted_at: null } }),
      this.prisma.addresses.findFirst({
        where: { organization_id: organizationId, is_registered: true, deleted_at: null },
        select: { district: true },
      }),
      this.prisma.ratings.aggregate({
        where: { ratee_org_id: organizationId, status: 'PUBLISHED' },
        _avg: { stars: true },
        _count: { _all: true },
      }),
    ]);
    const country = await this.countries.label(org.country_code);
    const rated = ratings._count._all > 0;

    return {
      organizationId: org.id,
      displayName: org.display_name,
      logoFileId: org.logo_file_id ?? null,
      ...country,
      city: address?.district ?? null,
      memberSince: org.created_at,
      isVerified: org.org_workspaces[0].status === 'ACTIVE',
      productsCount,
      completedOrdersCount: null,
      about: null,
      ...(rated && {
        ratingAvg: Math.round((ratings._avg.stars ?? 0) * 100) / 100,
        ratingCount: ratings._count._all,
      }),
    };
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
