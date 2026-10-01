import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Provider-facing pre-award view — never exposes customer identity,
 * contacts or files (D-16). backend/md/modules/05-requests-quotes-matching.md §2. */
@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  async list(userId: string, organizationId: string) {
    await this.requireMembership(organizationId, userId);
    const matches = await this.prisma.request_matches.findMany({
      where: { provider_org_id: organizationId, declined_at: null },
      orderBy: { created_at: 'desc' },
      include: { service_requests: { include: { transport_request_details: true } } },
    });
    return matches
      .filter((m) => ['SUBMITTED', 'QUOTED'].includes(m.service_requests.status))
      .map((m) => this.serializeSummary(m));
  }

  async get(userId: string, organizationId: string, requestId: string) {
    await this.requireMembership(organizationId, userId);
    const match = await this.prisma.request_matches.findUnique({
      where: { request_id_provider_org_id: { request_id: requestId, provider_org_id: organizationId } },
      include: { service_requests: { include: { transport_request_details: true } } },
    });
    if (!match) throw new AppError('NOT_FOUND', 'Opportunity not found');

    if (!match.viewed_at) {
      await this.prisma.request_matches.update({ where: { id: match.id }, data: { viewed_at: new Date() } });
    }

    const d = match.service_requests.transport_request_details;
    return {
      ...this.serializeSummary(match),
      pickupLabel: d?.pickup_label,
      dropoffLabel: d?.dropoff_label,
      weightValue: d?.weight_value,
      weightUnit: d?.weight_unit,
      quantity: d?.quantity,
      loadingAssistance: d?.loading_assistance,
      specialHandling: d?.special_handling,
      borderInstructions: d?.border_instructions,
      vehiclesCount: d?.vehicles_count,
      notes: match.service_requests.notes,
      // Masked — never the real customer org. D-16.
      customerIndicator: 'Verified customer',
    };
  }

  async decline(userId: string, organizationId: string, requestId: string, reasonCode?: string) {
    await this.requireMembership(organizationId, userId);
    const match = await this.prisma.request_matches.findUnique({
      where: { request_id_provider_org_id: { request_id: requestId, provider_org_id: organizationId } },
    });
    if (!match) throw new AppError('NOT_FOUND', 'Opportunity not found');
    await this.prisma.request_matches.update({
      where: { id: match.id },
      data: { declined_at: new Date(), decline_reason_code: reasonCode },
    });
    return { success: true };
  }

  async ask(userId: string, organizationId: string, requestId: string, question: string) {
    await this.requireMembership(organizationId, userId);
    const match = await this.prisma.request_matches.findUnique({
      where: { request_id_provider_org_id: { request_id: requestId, provider_org_id: organizationId } },
    });
    if (!match) throw new AppError('FORBIDDEN', 'This request was not matched to your organization');

    const row = await this.prisma.request_questions.create({
      data: {
        id: randomUUID(),
        request_id: requestId,
        provider_org_id: organizationId,
        asked_by_user_id: userId,
        question,
      },
    });
    return { id: row.id, question: row.question, createdAt: row.created_at };
  }

  private serializeSummary(m: {
    id: string;
    activity: string;
    notified_at: Date | null;
    viewed_at: Date | null;
    quoted_at: Date | null;
    service_requests: {
      id: string;
      reference: string;
      status: string;
      service_date: Date | null;
      expires_at: Date | null;
      origin_summary: string | null;
      destination_summary: string | null;
      transport_request_details: {
        scope: string | null;
        vehicle_type_code: string | null;
        transport_date: Date | null;
      } | null;
    };
  }) {
    const r = m.service_requests;
    return {
      requestId: r.id,
      reference: r.reference,
      status: r.status,
      activity: m.activity,
      viewed: m.viewed_at != null,
      quoted: m.quoted_at != null,
      serviceDate: r.service_date ?? r.transport_request_details?.transport_date ?? null,
      expiresAt: r.expires_at,
      originSummary: r.origin_summary,
      destinationSummary: r.destination_summary,
      scope: r.transport_request_details?.scope,
      vehicleTypeCode: r.transport_request_details?.vehicle_type_code,
      customerIndicator: 'Verified customer',
    };
  }
}
