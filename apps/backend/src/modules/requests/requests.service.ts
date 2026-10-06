import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { CustomsService } from '../customs/customs.service';
import { StorageService } from '../storage/storage.service';
import { ReferenceGenerator } from '../../common/references/reference-generator';
import { OsmMapsAdapter } from '../../infrastructure/maps/osm-maps.adapter';

export interface TransportStepInput {
  scope?: string;
  vehicleTypeCode?: string;
  vehicleDescription?: string;
  pickupLabel?: string;
  dropoffLabel?: string;
  destinationCountryCode?: string;
  transportDate?: string;
  commodityOther?: string;
  weightValue?: number;
  weightUnit?: string;
  quantity?: number;
  loadingAssistance?: string;
  temperatureC?: number;
  specialHandling?: string;
  longTermContract?: boolean;
  contractTerm?: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'OTHER';
  contractTermOther?: string;
  borderInstructions?: string;
  vehiclesCount?: number;
  originSummary?: string;
  destinationSummary?: string;
  serviceDate?: string;
  notes?: string;
}

const REQUEST_TTL_HOURS = 48;

type RequestWithDetails = Prisma.service_requestsGetPayload<{
  include: { transport_request_details: true };
}>;

/**
 * S3 — Transport-only for now (backend/md/12-execution-plan.md S3 scope).
 * Other service types (shipping/warehousing/customs) reuse the same
 * service_requests shell later but aren't wired here.
 *
 * Simplifications vs. the full spec (backend/md/modules/05-requests-quotes-matching.md),
 * done deliberately to ship a working vertical slice:
 * - No per-step required-field matrix; `submit` checks a minimal set.
 * - No PostGIS pickup/dropoff points — pickupLabel/dropoffLabel free text,
 *   same call as addresses.addressLine elsewhere in this codebase.
 * - Matching checks workspace+activity approval, licence expiry and
 *   region-level service area (via OsmMapsAdapter's best-effort region
 *   resolution — see runMatching's doc), but not vehicle ownership
 *   (D-18's full eligibility list; there's no fleet module yet).
 * - Route estimate and pickup/dropoff region come from OsmMapsAdapter
 *   (OpenStreetMap's public Nominatim/OSRM — free, no key, no production
 *   SLA; falls back to a synthetic estimate if they're unreachable). A
 *   real/paid provider is still an open decision in the execution plan.
 */
@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: ReferenceGenerator,
    private readonly maps: OsmMapsAdapter,
    private readonly customs: CustomsService,
    private readonly storage: StorageService,
  ) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  async createDraft(
    userId: string,
    organizationId: string,
    serviceType: 'TRANSPORT' | 'CUSTOMS' | 'WAREHOUSING' = 'TRANSPORT',
  ) {
    await this.requireMembership(organizationId, userId);
    const reference = await this.refs.next('LX');
    const request = await this.prisma.service_requests.create({
      data: {
        id: randomUUID(),
        reference,
        service_type: serviceType,
        customer_org_id: organizationId,
        created_by_user_id: userId,
        status: 'DRAFT',
        transport_request_details: { create: {} },
      },
    });
    return this.serialize(await this.getOrThrow(request.id, userId));
  }

  private async getOrThrow(id: string, userId: string): Promise<RequestWithDetails> {
    const request = await this.prisma.service_requests.findUnique({
      where: { id },
      include: { transport_request_details: true },
    });
    if (!request) throw new AppError('NOT_FOUND', 'Service request not found');
    await this.requireMembership(request.customer_org_id, userId);
    return request;
  }

  async get(id: string, userId: string) {
    return this.serialize(await this.getOrThrow(id, userId));
  }

  async list(userId: string, organizationId: string, status?: string) {
    await this.requireMembership(organizationId, userId);
    const rows = await this.prisma.service_requests.findMany({
      where: {
        customer_org_id: organizationId,
        service_type: 'TRANSPORT',
        status: status ? (status as never) : undefined,
      },
      orderBy: { created_at: 'desc' },
      include: { transport_request_details: true },
    });
    return rows.map((r) => this.serialize(r));
  }

  async patchStep(id: string, userId: string, step: string, input: TransportStepInput) {
    const request = await this.getOrThrow(id, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }

    await this.prisma.service_requests.update({
      where: { id },
      data: {
        current_step: step,
        origin_summary: input.originSummary,
        destination_summary: input.destinationSummary,
        destination_country_code: input.destinationCountryCode,
        service_date: input.serviceDate ? new Date(input.serviceDate) : undefined,
        notes: input.notes,
      },
    });

    // Real-world route estimate + region resolution the moment both ends
    // are known (OsmMapsAdapter — OpenStreetMap, falls back to a synthetic
    // estimate if unreachable; see its class doc). The resolved regions
    // feed runMatching's service-area check below.
    let routeEstimate: { distanceKm: number; durationMin: number } | undefined;
    let pickupRegionCode: string | null | undefined;
    let dropoffRegionCode: string | null | undefined;
    const pickup = input.pickupLabel ?? request.transport_request_details?.pickup_label;
    const dropoff = input.dropoffLabel ?? request.transport_request_details?.dropoff_label;
    if (pickup && dropoff) {
      const resolved = await this.maps.resolveRoute(pickup, dropoff);
      routeEstimate = resolved.estimate;
      const regions = await this.prisma.regions.findMany({
        where: { country_code: 'SA' },
        select: { code: true },
      });
      pickupRegionCode = this.maps.resolveRegionCode(resolved.pickup, regions);
      dropoffRegionCode = this.maps.resolveRegionCode(resolved.dropoff, regions);
    }

    await this.prisma.transport_request_details.update({
      where: { request_id: id },
      data: {
        scope: input.scope as never,
        vehicle_type_code: input.vehicleTypeCode,
        vehicle_description: input.vehicleDescription,
        pickup_label: input.pickupLabel,
        dropoff_label: input.dropoffLabel,
        destination_country_code: input.destinationCountryCode,
        transport_date: input.transportDate ? new Date(input.transportDate) : undefined,
        commodity_other: input.commodityOther,
        weight_value: input.weightValue,
        weight_unit: input.weightUnit as never,
        quantity: input.quantity,
        loading_assistance: input.loadingAssistance as never,
        temperature_c: input.temperatureC,
        special_handling: input.specialHandling,
        long_term_contract: input.longTermContract,
        contract_term: input.longTermContract ? input.contractTerm : null,
        contract_term_other: input.contractTerm === 'OTHER' ? input.contractTermOther : null,
        border_instructions: input.borderInstructions,
        vehicles_count: input.vehiclesCount,
        route_distance_km: routeEstimate?.distanceKm,
        route_duration_min: routeEstimate?.durationMin,
        pickup_region_code: pickupRegionCode,
        dropoff_region_code: dropoffRegionCode,
      },
    });

    return this.get(id, userId);
  }

  async submit(id: string, userId: string) {
    const request = await this.getOrThrow(id, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Request already submitted');
    }
    const d = request.transport_request_details;
    const missing: string[] = [];
    if (request.service_type === 'CUSTOMS') {
      await this.customs.assertReadyToSubmit(id);
    } else if (request.service_type === 'WAREHOUSING') {
      await this.storage.assertReadyToSubmit(id);
    } else {
      if (!d?.vehicle_type_code) missing.push('vehicleTypeCode');
      if (!d?.pickup_label) missing.push('pickupLabel');
      if (!d?.dropoff_label) missing.push('dropoffLabel');
      if (!request.service_date && !d?.transport_date) missing.push('serviceDate');
    }
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', `Missing required fields: ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }

    // "submit validates everything and requires the accuracy consent"
    // (05-requests-quotes-matching.md §1) — ck_requests_consent enforces it
    // at the DB level too (SUBMITTED requires accuracy_consent_id).
    const consent = await this.prisma.consents.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        organization_id: request.customer_org_id,
        workspace: 'CUSTOMER',
        consent_key: 'REQUEST_ACCURACY',
        context_type: 'service_request',
        context_id: id,
        context_reference: request.reference,
      },
    });

    const now = new Date();
    await this.prisma.service_requests.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submitted_at: now,
        expires_at: new Date(now.getTime() + REQUEST_TTL_HOURS * 60 * 60 * 1000),
        accuracy_consent_id: consent.id,
      },
    });

    const matchedCount = await this.runMatching(id);
    return { ...this.serialize(await this.getOrThrow(id, userId)), matchedProviderCount: matchedCount };
  }

  /** Broadcasts to every org with an approved TRANSPORT_CARRIER/BROKER
   * activity on an ACTIVE PROVIDER workspace, excluding an org whose
   * licence for that activity has since expired, and — when the pickup
   * region could be resolved (OsmMapsAdapter) and the org has configured
   * ANY service area for this activity — excluding one whose configured
   * areas don't cover it. An org with zero service areas configured is
   * NOT excluded (most orgs today, since there's no KYB step yet to set
   * them — treated as "covers everywhere" rather than "covers nowhere").
   * Still skipped vs. D-18's full eligibility list: vehicle ownership
   * (no fleet module). */
  private async runMatching(requestId: string): Promise<number> {
    const candidates = await this.prisma.provider_activities.findMany({
      where: {
        activity: { in: ['TRANSPORT_CARRIER', 'TRANSPORT_BROKER'] },
        status: 'APPROVED',
        organizations: { org_workspaces: { some: { workspace: 'PROVIDER', status: 'ACTIVE' } } },
      },
      select: { organization_id: true, activity: true },
    });

    // A licence valid at approval time can expire later without being
    // renewed — exclude those orgs. An org with no licence row at all for
    // this activity is NOT excluded (KYB may have approved it without one
    // on file yet); this only catches a licence that's now overdue.
    const expired = candidates.length
      ? await this.prisma.licenses.findMany({
          where: {
            organization_id: { in: candidates.map((c) => c.organization_id) },
            related_activity: { in: ['TRANSPORT_CARRIER', 'TRANSPORT_BROKER'] },
            expires_at: { lt: new Date() },
          },
          select: { organization_id: true },
        })
      : [];
    const expiredOrgIds = new Set(expired.map((e) => e.organization_id));
    let activities = candidates.filter((c) => !expiredOrgIds.has(c.organization_id));

    if (activities.length > 0) {
      activities = await this.filterByServiceArea(requestId, activities);
    }

    if (activities.length === 0) {
      await this.prisma.service_requests.update({
        where: { id: requestId },
        data: { flags: { push: 'ZERO_MATCH' } },
      });
      return 0;
    }

    await this.prisma.request_matches.createMany({
      data: activities.map((a) => ({
        id: randomUUID(),
        request_id: requestId,
        provider_org_id: a.organization_id,
        activity: a.activity,
        notified_at: new Date(),
      })),
      skipDuplicates: true,
    });
    await this.prisma.service_requests.update({
      where: { id: requestId },
      data: { matched_provider_count: activities.length },
    });
    return activities.length;
  }

  private async filterByServiceArea<T extends { organization_id: string; activity: string }>(
    requestId: string,
    candidates: T[],
  ): Promise<T[]> {
    const details = await this.prisma.transport_request_details.findUnique({
      where: { request_id: requestId },
      select: { pickup_region_code: true },
    });
    const pickupRegion = details?.pickup_region_code;
    if (!pickupRegion) return candidates; // couldn't resolve — don't filter on it

    const areas = await this.prisma.service_areas.findMany({
      where: {
        provider_activities: {
          organization_id: { in: candidates.map((c) => c.organization_id) },
          activity: { in: ['TRANSPORT_CARRIER', 'TRANSPORT_BROKER'] },
        },
      },
      select: {
        area_type: true,
        country_code: true,
        region_code: true,
        provider_activities: { select: { organization_id: true } },
      },
    });
    if (areas.length === 0) return candidates; // nobody has configured any — don't restrict

    const coveredOrgIds = new Set(
      areas
        .filter((a) => (a.area_type === 'COUNTRY' && a.country_code === 'SA') || (a.area_type === 'REGION' && a.region_code === pickupRegion))
        .map((a) => a.provider_activities.organization_id),
    );
    const orgsWithAnyArea = new Set(areas.map((a) => a.provider_activities.organization_id));

    // Only exclude an org that configured areas AND none of them cover
    // this pickup region. An org that configured none stays unrestricted.
    return candidates.filter((c) => !orgsWithAnyArea.has(c.organization_id) || coveredOrgIds.has(c.organization_id));
  }

  async cancel(id: string, userId: string, reasonCode?: string) {
    const request = await this.getOrThrow(id, userId);
    if (!['DRAFT', 'SUBMITTED', 'QUOTED'].includes(request.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', `Cannot cancel a request in status ${request.status}`);
    }
    await this.prisma.service_requests.update({
      where: { id },
      data: { status: 'CANCELLED', cancelled_at: new Date(), cancel_reason_code: reasonCode },
    });
    return this.get(id, userId);
  }

  async listQuestions(requestId: string, userId: string) {
    const request = await this.getOrThrow(requestId, userId);
    const rows = await this.prisma.request_questions.findMany({
      where: { request_id: request.id },
      orderBy: { created_at: 'asc' },
    });
    // Anonymized to the customer too — they see "a provider asked", not
    // which one, keeping it fair across everyone matched.
    return rows.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      answeredAt: q.answered_at,
      createdAt: q.created_at,
    }));
  }

  async answerQuestion(requestId: string, questionId: string, userId: string, answer: string) {
    const request = await this.getOrThrow(requestId, userId);
    const question = await this.prisma.request_questions.findFirst({
      where: { id: questionId, request_id: request.id },
    });
    if (!question) throw new AppError('NOT_FOUND', 'Question not found');
    const updated = await this.prisma.request_questions.update({
      where: { id: questionId },
      data: { answer, answered_by_user_id: userId, answered_at: new Date() },
    });
    return { id: updated.id, question: updated.question, answer: updated.answer, answeredAt: updated.answered_at };
  }

  private serialize(r: RequestWithDetails) {
    const d = r.transport_request_details;
    return {
      id: r.id,
      reference: r.reference,
      serviceType: r.service_type,
      status: r.status,
      currentStep: r.current_step,
      originSummary: r.origin_summary,
      destinationSummary: r.destination_summary,
      serviceDate: r.service_date,
      notes: r.notes,
      submittedAt: r.submitted_at,
      expiresAt: r.expires_at,
      matchedProviderCount: r.matched_provider_count,
      quoteCount: r.quote_count,
      flags: r.flags,
      transport: d
        ? {
            scope: d.scope,
            vehicleTypeCode: d.vehicle_type_code,
            vehicleDescription: d.vehicle_description,
            pickupLabel: d.pickup_label,
            dropoffLabel: d.dropoff_label,
            destinationCountryCode: d.destination_country_code,
            transportDate: d.transport_date,
            commodityOther: d.commodity_other,
            weightValue: d.weight_value,
            weightUnit: d.weight_unit,
            quantity: d.quantity,
            loadingAssistance: d.loading_assistance,
            temperatureC: d.temperature_c,
            specialHandling: d.special_handling,
            borderInstructions: d.border_instructions,
            vehiclesCount: d.vehicles_count,
            routeDistanceKm: d.route_distance_km ? Number(d.route_distance_km) : null,
            routeDurationMin: d.route_duration_min,
            pickupRegionCode: d.pickup_region_code,
            dropoffRegionCode: d.dropoff_region_code,
          }
        : null,
    };
  }
}
