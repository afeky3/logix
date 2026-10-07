import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface ShippingDetailsInput {
  freightMode?: 'SEA' | 'AIR' | 'LAND';
  tradeDirection?: 'IMPORT' | 'EXPORT';
  originCountry?: 'CN' | 'AE' | 'TR' | 'SA' | 'OTHER';
  originCountryOther?: string;
  originLabel?: string;
  destinationCountry?: 'CN' | 'AE' | 'TR' | 'SA' | 'OTHER';
  destinationCountryOther?: string;
  destinationLabel?: string;
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

/**
 * International shipping request (client round 1, item 2): route, cargo and
 * extras are four separate screens, each saving only what it collected onto
 * the one real svc.shipping_request_details row (from 001_init.sql) — a
 * plain Prisma update only touches the keys given, so this needs no
 * COALESCE trick. `extras` is the one JSON field, merged by hand so an
 * earlier call's flags survive a later one that doesn't repeat them.
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

    const existing = await this.prisma.shipping_request_details.findUnique({ where: { request_id: requestId } });
    const extras = { ...(existing?.extras as Record<string, boolean> | undefined) };
    if (input.dangerousGoods !== undefined) extras.dangerousGoods = input.dangerousGoods;
    if (input.temporaryStorage !== undefined) extras.temporaryStorage = input.temporaryStorage;

    const packages = { ...(existing?.packages as Record<string, unknown> | null | undefined) };
    if (input.dimensionsCm !== undefined) packages.dimensionsCm = input.dimensionsCm;

    const data = {
      mode: input.freightMode,
      trade_direction: input.tradeDirection,
      origin_country_code: input.originCountry === 'OTHER' ? null : input.originCountry,
      origin_country_other: input.originCountry === 'OTHER' ? input.originCountryOther : undefined,
      origin_label: input.originLabel,
      destination_country_code: input.destinationCountry === 'OTHER' ? null : input.destinationCountry,
      destination_country_other: input.destinationCountry === 'OTHER' ? input.destinationCountryOther : undefined,
      destination_label: input.destinationLabel,
      commodity_other: input.goodsTypeOther,
      container_type_code: input.containerKind,
      container_type_other: input.containerKind === 'OTHER' ? input.containerKindOther : undefined,
      border_crossing: input.borderCrossing,
      border_crossing_other: input.borderCrossing === 'OTHER' ? input.borderCrossingOther : undefined,
      package_count: input.piecesCount,
      weight_kg: input.weightKg,
      hs_code: input.hsCode,
      goods_description: input.goodsDescription,
      volume_cbm: input.volumeCbm,
      is_door_to_door: input.doorToDoor,
      is_express: input.urgentPriority,
      wants_customs_clearance: input.customsOnArrival,
      cargo_ready_date: input.readinessDate ? new Date(input.readinessDate) : undefined,
      handling_requirements: input.specialRequirements,
      extras: extras as Prisma.InputJsonValue,
      packages: (Object.keys(packages).length ? packages : undefined) as Prisma.InputJsonValue | undefined,
    };
    // Prisma's update only sets keys with a defined value — undefined keys
    // keep the row's existing value, which is what makes the partial saves work.
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      if (data[key] === undefined) delete data[key];
    }

    // createDraft seeds this row for every SHIPPING request, so it always exists.
    await this.prisma.shipping_request_details.update({
      where: { request_id: requestId },
      data,
    });
    return this.get(requestId, userId);
  }

  async get(requestId: string, userId: string) {
    await this.getShippingRequest(requestId, userId);
    return this.prisma.shipping_request_details.findUnique({ where: { request_id: requestId } });
  }

  /** Submit needs the route and a readiness date — everything else is detail. */
  async assertReadyToSubmit(requestId: string) {
    const d = await this.prisma.shipping_request_details.findUnique({ where: { request_id: requestId } });
    const missing: string[] = [];
    if (!d?.mode) missing.push('freightMode');
    if (!d?.trade_direction) missing.push('tradeDirection');
    if (!d?.origin_country_code && !d?.origin_country_other) missing.push('originCountry');
    if (!d?.destination_country_code && !d?.destination_country_other) missing.push('destinationCountry');
    if (!d?.origin_label) missing.push('originLabel');
    if (!d?.destination_label) missing.push('destinationLabel');
    if (!d?.weight_kg) missing.push('weightKg');
    if (!d?.cargo_ready_date) missing.push('readinessDate');
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', `Missing required fields: ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }
  }
}
