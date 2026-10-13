import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Transport progress is driven by the trip events the driver records. */
const TRANSPORT_STEPS = [
  { code: 'LOADED', event: 'CARGO_COLLECTED' },
  { code: 'ON_THE_WAY', event: 'DEPARTED' },
  { code: 'DELIVERED', event: 'ARRIVED_AT_DROPOFF' },
] as const;

/** Events split into trips at each drop-off; the last trip, or the one before it if a new one has not started. */
function currentTrip<T extends { event_type: string }>(events: T[]): T[] {
  const trips: T[][] = [[]];
  for (const e of events) {
    trips[trips.length - 1].push(e);
    if (e.event_type === 'ARRIVED_AT_DROPOFF') trips.push([]);
  }
  const last = trips[trips.length - 1];
  return last.length > 0 ? last : (trips[trips.length - 2] ?? []);
}

/** Every other service type walks a fixed list of milestones, in order. */
export const MILESTONE_STEPS: Record<string, string[]> = {
  SHIPPING: ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'],
  CUSTOMS: ['DOCS_REVIEWED', 'CLEARANCE_STARTED', 'DECLARATION_SUBMITTED', 'RELEASED'],
  WAREHOUSING: ['RECEIVED', 'STORED', 'READY_FOR_RELEASE', 'RELEASED'],
};

const RECORDABLE_STATUSES = ['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'ACTIVE'];

/** Steps that cannot be recorded without the paperwork behind them (bill of lading, etc.). */
const DOCUMENT_REQUIRED_STEPS: Record<string, string[]> = { SHIPPING: ['SHIPPED'] };

export interface ProgressStep {
  code: string;
  done: boolean;
  occurredAt: Date | null;
}

export interface OrderProgress {
  serviceType: string;
  steps: ProgressStep[];
  /** Raw trip-event types (transport) or milestone codes (others) already recorded. */
  doneCodes: Set<string>;
  currentCode: string | null;
  finalReached: boolean;
  lastUpdateAt: Date | null;
}

/** One place that knows how far an order has got, whatever its service type. */
@Injectable()
export class OrderProgressService {
  constructor(private readonly prisma: PrismaService) {}

  stepCodes(serviceType: string): string[] {
    if (serviceType === 'TRANSPORT') return TRANSPORT_STEPS.map((s) => s.code);
    return MILESTONE_STEPS[serviceType] ?? [];
  }

  async get(orderId: string, serviceType: string): Promise<OrderProgress> {
    if (serviceType === 'TRANSPORT') {
      const events = await this.prisma.trip_events.findMany({
        where: { order_id: orderId },
        orderBy: { occurred_at: 'asc' },
        select: { event_type: true, occurred_at: true },
      });
      // A recurring contract makes many trips: show the one in progress (or the last one finished).
      const trip = currentTrip(events);
      const at = new Map<string, Date>();
      for (const e of trip) if (!at.has(e.event_type)) at.set(e.event_type, e.occurred_at);
      const steps = TRANSPORT_STEPS.map((s) => ({
        code: s.code as string,
        done: at.has(s.event),
        occurredAt: at.get(s.event) ?? null,
      }));
      return this.build(serviceType, steps, new Set(at.keys()), events.at(-1)?.occurred_at ?? null);
    }

    const codes = MILESTONE_STEPS[serviceType] ?? [];
    const rows = await this.prisma.order_milestones.findMany({
      where: { order_id: orderId, status: 'DONE' },
      select: { code: true, occurred_at: true },
    });
    const at = new Map(rows.map((r) => [r.code, r.occurred_at]));
    const steps = codes.map((code) => ({ code, done: at.has(code), occurredAt: at.get(code) ?? null }));
    const last = rows.map((r) => r.occurred_at).filter((d): d is Date => d != null).sort((a, b) => +b - +a)[0];
    return this.build(serviceType, steps, new Set(at.keys()), last ?? null);
  }

  private build(serviceType: string, steps: ProgressStep[], doneCodes: Set<string>, lastUpdateAt: Date | null): OrderProgress {
    const done = steps.filter((s) => s.done);
    return {
      serviceType,
      steps,
      doneCodes,
      currentCode: done.at(-1)?.code ?? null,
      finalReached: steps.length > 0 && steps[steps.length - 1].done,
      lastUpdateAt,
    };
  }

  /** Order ids whose final step has been recorded — one query per kind, for list screens. */
  async finalReachedIds(orders: { id: string; service_type: string }[]): Promise<Set<string>> {
    const transportIds = orders.filter((o) => o.service_type === 'TRANSPORT').map((o) => o.id);
    const otherOrders = orders.filter((o) => o.service_type !== 'TRANSPORT');
    const out = new Set<string>();

    if (transportIds.length) {
      const rows = await this.prisma.trip_events.findMany({
        where: { order_id: { in: transportIds }, event_type: 'ARRIVED_AT_DROPOFF' },
        select: { order_id: true },
      });
      rows.forEach((r) => out.add(r.order_id));
    }
    if (otherOrders.length) {
      const rows = await this.prisma.order_milestones.findMany({
        where: { order_id: { in: otherOrders.map((o) => o.id) }, status: 'DONE' },
        select: { order_id: true, code: true },
      });
      const byOrder = new Map<string, Set<string>>();
      for (const r of rows) byOrder.set(r.order_id, (byOrder.get(r.order_id) ?? new Set()).add(r.code));
      for (const o of otherOrders) {
        const last = MILESTONE_STEPS[o.service_type]?.at(-1);
        if (last && byOrder.get(o.id)?.has(last)) out.add(o.id);
      }
    }
    return out;
  }

  /** Provider moves a non-transport order to its next milestone. */
  async recordMilestone(
    userId: string,
    orderId: string,
    organizationId: string,
    code: string,
    note?: string,
    fileIds: string[] = [],
  ): Promise<OrderProgress> {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    if (order.provider_org_id !== organizationId) throw new AppError('FORBIDDEN', 'Not the provider on this order');
    if (order.service_type === 'TRANSPORT') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Transport orders are updated with trip events');
    }
    if (!RECORDABLE_STATUSES.includes(order.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Order is not open for progress updates');
    }

    const codes = MILESTONE_STEPS[order.service_type] ?? [];
    const index = codes.indexOf(code);
    if (index < 0) throw new AppError('VALIDATION_FAILED', `Unknown step ${code} for ${order.service_type}`);

    const progress = await this.get(orderId, order.service_type);
    if (progress.doneCodes.has(code)) return progress;
    if ((DOCUMENT_REQUIRED_STEPS[order.service_type] ?? []).includes(code) && fileIds.length === 0) {
      throw new AppError('VALIDATION_FAILED', 'Attach the shipping documents before recording this step', {
        details: [{ field: 'fileIds', code: 'required' }],
      });
    }
    await this.assertShipmentDocuments(fileIds, organizationId);
    const next = codes.find((c) => !progress.doneCodes.has(c));
    if (next !== code) {
      throw new AppError('BUSINESS_RULE_VIOLATION', `Record ${next} before ${code}`);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.order_milestones.upsert({
        where: { order_id_code: { order_id: orderId, code } },
        create: {
          id: randomUUID(),
          order_id: orderId,
          code,
          sequence: index + 1,
          status: 'DONE',
          occurred_at: now,
          source: 'PROVIDER',
          recorded_by_user_id: userId,
          note: note ?? null,
          evidence_file_ids: fileIds,
        },
        update: {
          status: 'DONE',
          occurred_at: now,
          source: 'PROVIDER',
          recorded_by_user_id: userId,
          note: note ?? null,
          evidence_file_ids: fileIds,
        },
      }),
      this.prisma.order_events.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          event_type: 'MILESTONE',
          from_status: order.status,
          to_status: order.status === 'IN_PROGRESS' || order.status === 'ACTIVE' ? order.status : 'IN_PROGRESS',
          milestone_code: code,
          payload: { ...(note ? { note } : {}), ...(fileIds.length ? { documents: fileIds.length } : {}) },
          source: 'PROVIDER',
          actor_user_id: userId,
          occurred_at: now,
        },
      }),
      this.prisma.orders.update({
        where: { id: orderId },
        data: {
          status: order.status === 'ACTIVE' ? 'ACTIVE' : 'IN_PROGRESS',
          current_milestone_code: code,
          last_update_at: now,
          started_at: order.started_at ?? now,
          scheduled_at: order.scheduled_at ?? now,
        },
      }),
    ]);
    return this.get(orderId, order.service_type);
  }

  /** Every file must be a shipment document that belongs to the provider organization. */
  private async assertShipmentDocuments(fileIds: string[], providerOrgId: string): Promise<void> {
    if (fileIds.length === 0) return;
    const unique = [...new Set(fileIds)];
    const files = await this.prisma.files.findMany({
      where: { id: { in: unique }, deleted_at: null },
      select: { id: true, purpose: true, organization_id: true },
    });
    const ok =
      files.length === unique.length &&
      files.every((f) => f.purpose === 'SHIPMENT_DOCUMENT' && f.organization_id === providerOrgId);
    if (!ok) {
      throw new AppError('VALIDATION_FAILED', 'Documents must be uploaded as shipment documents by the provider', {
        details: [{ field: 'fileIds', code: 'invalid' }],
      });
    }
  }

  /** Adds paperwork to the step the order is currently on (transport: the latest trip event). */
  async attachDocuments(userId: string, orderId: string, organizationId: string, fileIds: string[]): Promise<void> {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');
    if (order.provider_org_id !== organizationId) throw new AppError('FORBIDDEN', 'Not the provider on this order');
    if (!RECORDABLE_STATUSES.includes(order.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Order is not open for documents');
    }
    await this.assertShipmentDocuments(fileIds, organizationId);
    const unique = [...new Set(fileIds)];

    if (order.service_type === 'TRANSPORT') {
      const last = await this.prisma.trip_events.findFirst({
        where: { order_id: orderId },
        orderBy: { occurred_at: 'desc' },
      });
      if (!last) throw new AppError('BUSINESS_RULE_VIOLATION', 'Record a trip step before attaching documents');
      await this.prisma.trip_events.update({
        where: { id: last.id },
        data: { document_file_ids: [...new Set([...last.document_file_ids, ...unique])] },
      });
      return;
    }
    const last = await this.prisma.order_milestones.findFirst({
      where: { order_id: orderId, status: 'DONE' },
      orderBy: { sequence: 'desc' },
    });
    if (!last) throw new AppError('BUSINESS_RULE_VIOLATION', 'Record a step before attaching documents');
    await this.prisma.order_milestones.update({
      where: { id: last.id },
      data: { evidence_file_ids: [...new Set([...last.evidence_file_ids, ...unique])] },
    });
  }

  /** Shipment documents attached to any step of the order, newest first. */
  async listDocuments(orderId: string) {
    const [milestones, events] = await Promise.all([
      this.prisma.order_milestones.findMany({
        where: { order_id: orderId, status: 'DONE' },
        select: { code: true, evidence_file_ids: true },
      }),
      this.prisma.trip_events.findMany({
        where: { order_id: orderId },
        select: { event_type: true, document_file_ids: true },
      }),
    ]);
    const stepOf = new Map<string, string>();
    for (const m of milestones) m.evidence_file_ids.forEach((f) => stepOf.set(f, m.code));
    for (const e of events) e.document_file_ids.forEach((f) => stepOf.set(f, e.event_type));
    if (stepOf.size === 0) return [];
    const files = await this.prisma.files.findMany({
      where: { id: { in: [...stepOf.keys()] }, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return files.map((f) => ({
      fileId: f.id,
      name: f.original_name ?? f.id,
      mimeType: f.mime_type,
      sizeBytes: Number(f.size_bytes),
      uploadedAt: f.created_at,
      stepCode: stepOf.get(f.id) ?? null,
    }));
  }

  /** Called when the driver records a trip event so the order itself reflects it. */
  async noteTripEvent(userId: string, orderId: string, eventType: string, occurredAt: Date): Promise<void> {
    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) return;
    const step = TRANSPORT_STEPS.find((s) => s.event === eventType);
    const toStatus = order.status === 'IN_PROGRESS' || order.status === 'ACTIVE' ? order.status : 'IN_PROGRESS';
    await this.prisma.$transaction([
      this.prisma.order_events.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          event_type: 'TRIP_EVENT',
          from_status: order.status,
          to_status: toStatus,
          milestone_code: step?.code ?? eventType,
          payload: { eventType },
          source: 'PROVIDER',
          actor_user_id: userId,
          occurred_at: occurredAt,
        },
      }),
      this.prisma.orders.update({
        where: { id: orderId },
        data: {
          status: toStatus,
          current_milestone_code: step?.code ?? eventType,
          last_update_at: occurredAt,
          started_at: order.started_at ?? occurredAt,
          scheduled_at: order.scheduled_at ?? occurredAt,
        },
      }),
    ]);
  }
}
