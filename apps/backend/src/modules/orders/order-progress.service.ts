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

/** Every other service type walks a fixed list of milestones, in order. */
export const MILESTONE_STEPS: Record<string, string[]> = {
  SHIPPING: ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'],
  CUSTOMS: ['DOCS_REVIEWED', 'CLEARANCE_STARTED', 'DECLARATION_SUBMITTED', 'RELEASED'],
  WAREHOUSING: ['RECEIVED', 'STORED', 'READY_FOR_RELEASE', 'RELEASED'],
};

const RECORDABLE_STATUSES = ['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'ACTIVE'];

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
      const at = new Map<string, Date>();
      for (const e of events) if (!at.has(e.event_type)) at.set(e.event_type, e.occurred_at);
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
        },
        update: { status: 'DONE', occurred_at: now, source: 'PROVIDER', recorded_by_user_id: userId, note: note ?? null },
      }),
      this.prisma.order_events.create({
        data: {
          id: randomUUID(),
          order_id: orderId,
          event_type: 'MILESTONE',
          from_status: order.status,
          to_status: order.status === 'IN_PROGRESS' || order.status === 'ACTIVE' ? order.status : 'IN_PROGRESS',
          milestone_code: code,
          payload: note ? { note } : {},
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
