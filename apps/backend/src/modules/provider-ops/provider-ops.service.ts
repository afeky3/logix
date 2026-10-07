import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

const ACTIVE_ORDER_STATUSES = ['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'ACTIVE'];

type TripEventType =
  | 'START_TO_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'CARGO_COLLECTED'
  | 'DEPARTED'
  | 'BORDER_CROSSED'
  | 'ARRIVED_AT_DROPOFF';

/** Provider-side reads and writes for the workspace pages that have no
 * other home: settlements (fin.settlements), fleet (transport.vehicles)
 * and trip execution (transport.trip_assignments / trip_events). */
@Injectable()
export class ProviderOpsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  async listSettlements(userId: string, orgId: string) {
    await this.requireMembership(orgId, userId);
    const rows = await this.prisma.settlements.findMany({
      where: { beneficiary_org_id: orgId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    const orderIds = rows.map((r) => r.order_id).filter((x): x is string => !!x);
    const orders = orderIds.length
      ? await this.prisma.orders.findMany({ where: { id: { in: orderIds } }, select: { id: true, reference: true } })
      : [];
    const refById = new Map(orders.map((o) => [o.id, o.reference]));
    return rows.map((s) => ({
      id: s.id,
      reference: s.reference,
      orderReference: s.order_id ? (refById.get(s.order_id) ?? null) : null,
      grossHalalas: Number(s.gross_amount),
      commissionRateBps: s.commission_rate_bps,
      commissionHalalas: Number(s.commission_amount),
      commissionVatHalalas: Number(s.commission_vat_amount),
      netHalalas: Number(s.net_amount),
      status: s.status,
      payableOn: s.payable_on,
      paidAt: s.paid_at,
    }));
  }

  async listVehicles(userId: string, orgId: string) {
    await this.requireMembership(orgId, userId);
    const vehicles = await this.prisma.vehicles.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    const busy = await this.prisma.trip_assignments.findMany({
      where: { vehicle_id: { in: vehicles.map((v) => v.id) }, status: 'ACTIVE' },
      select: { vehicle_id: true },
    });
    const busyIds = new Set(busy.map((b) => b.vehicle_id));
    return vehicles.map((v) => ({
      id: v.id,
      plateNumber: v.plate_number,
      vehicleTypeCode: v.vehicle_type_code,
      capacityTon: v.capacity_ton ? Number(v.capacity_ton) : null,
      isReefer: v.is_reefer,
      status: v.status === 'ACTIVE' ? (busyIds.has(v.id) ? 'ON_TRIP' : 'AVAILABLE') : 'MAINTENANCE',
    }));
  }

  async addVehicle(
    userId: string,
    orgId: string,
    input: { plateNumber: string; vehicleTypeCode: string; capacityTon?: number; isReefer?: boolean },
  ) {
    await this.requireMembership(orgId, userId);
    const type = await this.prisma.vehicle_types.findUnique({ where: { code: input.vehicleTypeCode } });
    if (!type) throw new AppError('VALIDATION_FAILED', 'Unknown vehicle type');
    const duplicate = await this.prisma.vehicles.findFirst({
      where: { organization_id: orgId, plate_number: input.plateNumber, deleted_at: null },
    });
    if (duplicate) throw new AppError('BUSINESS_RULE_VIOLATION', 'A vehicle with this plate already exists');
    const v = await this.prisma.vehicles.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        plate_number: input.plateNumber,
        vehicle_type_code: input.vehicleTypeCode,
        capacity_ton: input.capacityTon,
        is_reefer: input.isReefer ?? false,
      },
    });
    return { id: v.id, plateNumber: v.plate_number, vehicleTypeCode: v.vehicle_type_code, status: 'AVAILABLE' };
  }

  private async requireProviderOrder(userId: string, orderId: string, orgId?: string) {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    const providerOrg = orgId ?? order.provider_org_id;
    await this.requireMembership(providerOrg, userId);
    if (order.provider_org_id !== providerOrg) throw new AppError('FORBIDDEN', 'Not the provider on this order');
    return order;
  }

  async getTrip(userId: string, orderId: string) {
    await this.requireProviderOrder(userId, orderId);
    const assignment = await this.prisma.trip_assignments.findFirst({
      where: { order_id: orderId, status: 'ACTIVE' },
    });
    const events = await this.prisma.trip_events.findMany({
      where: { order_id: orderId },
      orderBy: { occurred_at: 'asc' },
      select: { id: true, event_type: true, occurred_at: true, note: true, unit_count: true },
    });
    return {
      assignment: assignment
        ? {
            id: assignment.id,
            vehicleId: assignment.vehicle_id,
            plateNumber: assignment.external_plate_number,
            driverName: assignment.external_driver_name,
            driverPhone: assignment.external_driver_phone,
          }
        : null,
      events: events.map((e) => ({
        id: e.id,
        type: e.event_type,
        occurredAt: e.occurred_at,
        note: e.note,
        unitCount: e.unit_count ? Number(e.unit_count) : null,
      })),
    };
  }

  async assignTrip(
    userId: string,
    orderId: string,
    input: { organizationId: string; vehicleId: string; driverName: string; driverPhone?: string },
  ) {
    const order = await this.requireProviderOrder(userId, orderId, input.organizationId);
    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Order is not ready for execution');
    }
    const vehicle = await this.prisma.vehicles.findFirst({
      where: { id: input.vehicleId, organization_id: input.organizationId, deleted_at: null, status: 'ACTIVE' },
    });
    if (!vehicle) throw new AppError('NOT_FOUND', 'Vehicle not found');

    // One ACTIVE assignment per order (ux_assignments_active): replace it.
    await this.prisma.trip_assignments.updateMany({
      where: { order_id: orderId, status: 'ACTIVE' },
      data: { status: 'REPLACED', ended_at: new Date(), end_reason: 'REASSIGNED' },
    });
    const a = await this.prisma.trip_assignments.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        is_external: true, // driver is a typed name, not a drivers row (ck_assignment_shape)
        vehicle_id: vehicle.id,
        external_driver_name: input.driverName,
        external_driver_phone: input.driverPhone,
        external_plate_number: vehicle.plate_number,
        external_vehicle_type_code: vehicle.vehicle_type_code,
        assigned_by_user_id: userId,
      },
    });
    return { id: a.id, vehicleId: vehicle.id, plateNumber: vehicle.plate_number, driverName: input.driverName };
  }

  async recordEvent(
    userId: string,
    orderId: string,
    input: {
      organizationId: string;
      eventType: TripEventType;
      clientEventId?: string;
      unitCount?: number;
      note?: string;
    },
  ) {
    await this.requireProviderOrder(userId, orderId, input.organizationId);
    const assignment = await this.prisma.trip_assignments.findFirst({ where: { order_id: orderId, status: 'ACTIVE' } });
    if (!assignment) throw new AppError('BUSINESS_RULE_VIOLATION', 'Assign a vehicle and driver first');
    if (input.eventType === 'CARGO_COLLECTED' && input.unitCount == null) {
      throw new AppError('VALIDATION_FAILED', 'unitCount is required when cargo is collected', {
        details: [{ field: 'unitCount', code: 'required' }],
      });
    }
    const clientEventId = input.clientEventId ?? randomUUID();
    const existing = await this.prisma.trip_events.findUnique({ where: { client_event_id: clientEventId } });
    if (existing) return { id: existing.id, type: existing.event_type, occurredAt: existing.occurred_at };
    const e = await this.prisma.trip_events.create({
      data: {
        id: randomUUID(),
        order_id: orderId,
        assignment_id: assignment.id,
        client_event_id: clientEventId,
        event_type: input.eventType,
        occurred_at: new Date(),
        source: 'PROVIDER',
        recorded_by_user_id: userId,
        unit_count: input.unitCount,
        note: input.note,
      },
    });
    return { id: e.id, type: e.event_type, occurredAt: e.occurred_at };
  }
}
