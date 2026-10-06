import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Dashboard "request monitor" + zero-quote alerts — the admin-facing half
 * of S3 (backend/md/modules/05-requests-quotes-matching.md "Screens
 * served": "Dashboard: request monitor, zero-quote alerts, quote anomaly
 * view"). Staff-only, read-only — no decision-making here, S3 requests
 * don't need staff approval the way KYB does. */
@Injectable()
export class AdminRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status?: string, zeroMatchOnly?: boolean) {
    const rows = await this.prisma.service_requests.findMany({
      where: {
        status: status ? (status as never) : undefined,
        flags: zeroMatchOnly ? { has: 'ZERO_MATCH' } : undefined,
      },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        organizations: { select: { display_name: true } },
        transport_request_details: { select: { vehicle_type_code: true } },
      },
    });

    // Zero-quote alert: submitted >24h ago, never got a single quote.
    const zeroQuoteCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      serviceType: r.service_type,
      status: r.status,
      customerName: r.organizations.display_name,
      originSummary: r.origin_summary,
      destinationSummary: r.destination_summary,
      vehicleTypeCode: r.transport_request_details?.vehicle_type_code ?? null,
      matchedProviderCount: r.matched_provider_count,
      quoteCount: r.quote_count,
      flags: r.flags,
      submittedAt: r.submitted_at,
      expiresAt: r.expires_at,
      isZeroQuoteAlert:
        r.quote_count === 0 &&
        r.submitted_at != null &&
        r.submitted_at < zeroQuoteCutoff &&
        ['SUBMITTED', 'QUOTED'].includes(r.status),
    }));
  }

  async get(id: string) {
    const r = await this.prisma.service_requests.findUnique({
      where: { id },
      include: {
        organizations: { select: { display_name: true } },
        transport_request_details: true,
        request_matches: {
          include: { organizations: { select: { display_name: true } } },
        },
        quotes: {
          include: { organizations: { select: { display_name: true } } },
          orderBy: { submitted_at: 'desc' },
        },
      },
    });
    if (!r) throw new AppError('NOT_FOUND', 'Request not found');

    // Storage and customs details live in their own tables (items 3 and 7).
    const storageRows = r.service_type === 'WAREHOUSING'
      ? await this.prisma.$queryRaw<Record<string, unknown>[]>`
          SELECT kind, city, city_other, storage_kind, pallets, entry_date, parcel_reference, requested_date, requirements
          FROM svc.storage_request_details WHERE request_id = ${id}::uuid
        `
      : [];
    const customsDetails = r.service_type === 'CUSTOMS'
      ? await this.prisma.customs_request_details.findUnique({ where: { request_id: id } })
      : null;
    const customsDocs = r.service_type === 'CUSTOMS'
      ? await this.prisma.$queryRaw<{ doc_type: string; original_name: string | null }[]>`
          SELECT cd.doc_type, f.original_name FROM svc.customs_documents cd
          JOIN files.files f ON f.id = cd.file_id WHERE cd.request_id = ${id}::uuid
        `
      : [];

    return {
      id: r.id,
      reference: r.reference,
      serviceType: r.service_type,
      status: r.status,
      customerName: r.organizations.display_name,
      originSummary: r.origin_summary,
      destinationSummary: r.destination_summary,
      notes: r.notes,
      submittedAt: r.submitted_at,
      expiresAt: r.expires_at,
      flags: r.flags,
      transport: r.transport_request_details,
      storage: storageRows[0] ?? null,
      customs: customsDetails
        ? { movement: customsDetails.movement, billOfLadingNo: customsDetails.bill_of_lading_no, documents: customsDocs }
        : null,
      matches: r.request_matches.map((m) => ({
        providerName: m.organizations.display_name,
        notifiedAt: m.notified_at,
        viewedAt: m.viewed_at,
        quotedAt: m.quoted_at,
        declinedAt: m.declined_at,
      })),
      quotes: this.withAnomalyFlags(r.quotes),
    };
  }

  /** Quote anomaly view: flags a quote whose total is >40% away from the
   * mean of the other live quotes on the same request — a simple
   * deviation check, not a statistical model (good enough to surface
   * obvious pricing mistakes to ops). */
  private withAnomalyFlags(
    quotes: {
      id: string;
      status: string;
      total_amount: bigint;
      valid_until: Date;
      submitted_at: Date;
      organizations: { display_name: string };
    }[],
  ) {
    const live = quotes.filter((q) => q.status === 'SUBMITTED');
    const mean =
      live.length > 1
        ? live.reduce((sum, q) => sum + Number(q.total_amount), 0) / live.length
        : null;

    return quotes.map((q) => {
      const total = Number(q.total_amount);
      const isAnomaly =
        mean != null && live.includes(q) && Math.abs(total - mean) / mean > 0.4;
      return {
        id: q.id,
        providerName: q.organizations.display_name,
        status: q.status,
        totalAmountHalalas: total,
        validUntil: q.valid_until,
        submittedAt: q.submitted_at,
        isAnomaly,
      };
    });
  }
}
