import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface ShippingDetailsInput {
  freightMode?: 'SEA' | 'AIR' | 'LAND';
  tradeDirection?: 'IMPORT' | 'EXPORT';
  originCountry?: string;
  originCountryOther?: string;
  destinationCountry?: string;
  destinationCountryOther?: string;
  polLabel?: string;
  podLabel?: string;
  goodsType?: 'INDUSTRIAL' | 'CONSUMER' | 'RAW' | 'OTHER';
  goodsTypeOther?: string;
  containerKind?: 'STANDARD' | 'HIGH_CUBE' | 'REEFER' | 'OTHER';
  containerKindOther?: string;
  borderCrossing?: 'BATHA' | 'HADITHA' | 'RAQI' | 'OTHER';
  borderCrossingOther?: string;
  piecesCount?: number;
  weightKg?: number;
  hsCode?: string;
  goodsDescription?: string;
  dimensionsCm?: string;
  volumeCbm?: number;
  dangerousGoods?: boolean;
  doorToDoor?: boolean;
  urgentPriority?: boolean;
  customsOnArrival?: boolean;
  temporaryStorage?: boolean;
  readinessDate?: string;
  specialRequirements?: string;
}

interface ShippingRow {
  freight_mode: string | null;
  trade_direction: string | null;
  origin_country: string | null;
  origin_country_other: string | null;
  destination_country: string | null;
  destination_country_other: string | null;
  pol_label: string | null;
  pod_label: string | null;
  weight_kg: string | null;
  readiness_date: Date | null;
}

/**
 * International shipping request (client round 1, item 2): route, cargo and
 * extras are four separate screens, each saving only what it has — every
 * call COALESCEs its fields onto the existing row instead of overwriting it.
 */
@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  private async getShippingRequest(requestId: string, userId: string) {
    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request || request.service_type !== 'SHIPPING') {
      throw new AppError('NOT_FOUND', 'Shipping request not found');
    }
    await this.requireMembership(request.customer_org_id, userId);
    return request;
  }

  async saveDetails(requestId: string, userId: string, input: ShippingDetailsInput) {
    const request = await this.getShippingRequest(requestId, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }
    await this.prisma.$executeRaw`
      INSERT INTO svc.shipping_request_details (request_id) VALUES (${requestId}::uuid)
      ON CONFLICT (request_id) DO NOTHING
    `;
    await this.prisma.$executeRaw`
      UPDATE svc.shipping_request_details SET
        freight_mode = COALESCE(${input.freightMode ?? null}, freight_mode),
        trade_direction = COALESCE(${input.tradeDirection ?? null}, trade_direction),
        origin_country = COALESCE(${input.originCountry ?? null}, origin_country),
        origin_country_other = COALESCE(${input.originCountryOther ?? null}, origin_country_other),
        destination_country = COALESCE(${input.destinationCountry ?? null}, destination_country),
        destination_country_other = COALESCE(${input.destinationCountryOther ?? null}, destination_country_other),
        pol_label = COALESCE(${input.polLabel ?? null}, pol_label),
        pod_label = COALESCE(${input.podLabel ?? null}, pod_label),
        goods_type = COALESCE(${input.goodsType ?? null}, goods_type),
        goods_type_other = COALESCE(${input.goodsTypeOther ?? null}, goods_type_other),
        container_kind = COALESCE(${input.containerKind ?? null}, container_kind),
        container_kind_other = COALESCE(${input.containerKindOther ?? null}, container_kind_other),
        border_crossing = COALESCE(${input.borderCrossing ?? null}, border_crossing),
        border_crossing_other = COALESCE(${input.borderCrossingOther ?? null}, border_crossing_other),
        pieces_count = COALESCE(${input.piecesCount ?? null}, pieces_count),
        weight_kg = COALESCE(${input.weightKg ?? null}, weight_kg),
        hs_code = COALESCE(${input.hsCode ?? null}, hs_code),
        goods_description = COALESCE(${input.goodsDescription ?? null}, goods_description),
        dimensions_cm = COALESCE(${input.dimensionsCm ?? null}, dimensions_cm),
        volume_cbm = COALESCE(${input.volumeCbm ?? null}, volume_cbm),
        dangerous_goods = COALESCE(${input.dangerousGoods ?? null}, dangerous_goods),
        door_to_door = COALESCE(${input.doorToDoor ?? null}, door_to_door),
        urgent_priority = COALESCE(${input.urgentPriority ?? null}, urgent_priority),
        customs_on_arrival = COALESCE(${input.customsOnArrival ?? null}, customs_on_arrival),
        temporary_storage = COALESCE(${input.temporaryStorage ?? null}, temporary_storage),
        readiness_date = COALESCE(${input.readinessDate ?? null}::date, readiness_date),
        special_requirements = COALESCE(${input.specialRequirements ?? null}, special_requirements),
        updated_at = now()
      WHERE request_id = ${requestId}::uuid
    `;
    return this.get(requestId, userId);
  }

  async get(requestId: string, userId: string) {
    await this.getShippingRequest(requestId, userId);
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM svc.shipping_request_details WHERE request_id = ${requestId}::uuid
    `;
    return rows[0] ?? null;
  }

  /** Submit needs the route and a readiness date — everything else is detail. */
  async assertReadyToSubmit(requestId: string) {
    const rows = await this.prisma.$queryRaw<ShippingRow[]>`
      SELECT freight_mode, trade_direction, origin_country, origin_country_other,
             destination_country, destination_country_other, pol_label, pod_label,
             weight_kg, readiness_date
      FROM svc.shipping_request_details WHERE request_id = ${requestId}::uuid
    `;
    const d = rows[0];
    const missing: string[] = [];
    if (!d) {
      missing.push('freightMode', 'tradeDirection');
    } else {
      if (!d.freight_mode) missing.push('freightMode');
      if (!d.trade_direction) missing.push('tradeDirection');
      if (!d.origin_country) missing.push('originCountry');
      if (d.origin_country === 'OTHER' && !d.origin_country_other) missing.push('originCountryOther');
      if (!d.destination_country) missing.push('destinationCountry');
      if (d.destination_country === 'OTHER' && !d.destination_country_other) missing.push('destinationCountryOther');
      if (!d.pol_label) missing.push('polLabel');
      if (!d.pod_label) missing.push('podLabel');
      if (!d.weight_kg) missing.push('weightKg');
      if (!d.readiness_date) missing.push('readinessDate');
    }
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', `Missing required fields: ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }
  }
}
