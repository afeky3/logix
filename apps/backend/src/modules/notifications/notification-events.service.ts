import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationsService, type NewNotification } from './notifications.service';

type Workspace = 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER';
type Role = 'OWNER' | 'MANAGER' | 'MEMBER' | 'DRIVER';

/** People who run an account day to day (not drivers). */
const STAFFED: Role[] = ['OWNER', 'MANAGER', 'MEMBER'];
/** People who deal with money. */
const MONEY: Role[] = ['OWNER', 'MANAGER'];

/** The "المنتج: <name>" line of the message the app sends when a supply order is placed. */
const PRODUCT_LINE = /^(?:المنتج|Product)\s*[:：]\s*(.+)$/m;

/**
 * The notifications the platform raises as things happen (quote received, order moved, payout paid...).
 *
 * Every method is fire-and-forget: it never throws. A notification is a courtesy on top of something
 * that already happened (a quote was saved, an order was accepted); failing to write it must not undo
 * or fail that. Failures are logged.
 *
 * Keys follow the existing pattern: `notifications.<event>.title` / `.body`; the app renders the text
 * from them and fills the placeholders from `params`.
 */
@Injectable()
export class NotificationEvents {
  private readonly logger = new Logger(NotificationEvents.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** A provider quoted a customer's request. */
  quoteReceived(quoteId: string): Promise<void> {
    return this.run('quote.received', async () => {
      const quote = await this.prisma.quotes.findUnique({
        where: { id: quoteId },
        select: {
          request_id: true,
          total_amount: true,
          organizations: { select: { display_name: true } },
          service_requests: { select: { reference: true, customer_org_id: true } },
        },
      });
      if (!quote) return;
      await this.send(quote.service_requests.customer_org_id, STAFFED, 'CUSTOMER', {
        type: 'quote.received',
        category: 'QUOTES',
        params: {
          requestReference: quote.service_requests.reference,
          providerName: quote.organizations.display_name,
          amountHalalas: Number(quote.total_amount),
        },
        deepLink: `logix://requests/${quote.request_id}/offers`,
      });
    });
  }

  /** A customer accepted a provider's quote (an order now exists). */
  quoteAccepted(orderId: string): Promise<void> {
    return this.run('quote.accepted', async () => {
      const order = await this.prisma.orders.findUnique({
        where: { id: orderId },
        select: { reference: true, total_amount: true, provider_org_id: true },
      });
      if (!order) return;
      await this.send(order.provider_org_id, STAFFED, 'PROVIDER', {
        type: 'quote.accepted',
        category: 'ORDERS',
        params: { orderReference: order.reference, amountHalalas: Number(order.total_amount) },
        deepLink: `logix://orders/${orderId}`,
      });
    });
  }

  /** A request was matched to these providers. */
  opportunityNew(requestId: string, providerOrgIds: string[]): Promise<void> {
    return this.run('opportunity.new', async () => {
      if (providerOrgIds.length === 0) return;
      const request = await this.prisma.service_requests.findUnique({
        where: { id: requestId },
        select: { reference: true, service_type: true },
      });
      if (!request) return;
      const route = await this.prisma.transport_request_details.findUnique({
        where: { request_id: requestId },
        select: { pickup_label: true, dropoff_label: true },
      });
      const params = {
        requestReference: request.reference,
        serviceType: request.service_type,
        originSummary: route?.pickup_label ?? null,
        destinationSummary: route?.dropoff_label ?? null,
      };
      const spec = { type: 'opportunity.new', category: 'QUOTES' as const, params, deepLink: `logix://opportunities/${requestId}` };
      for (const orgId of new Set(providerOrgIds)) await this.send(orgId, STAFFED, 'PROVIDER', spec);
    });
  }

  /** An order moved to its next step (a milestone, or a trip event for transport). */
  orderProgress(orderId: string, stepCode: string): Promise<void> {
    return this.run('order.progress', async () => {
      const order = await this.prisma.orders.findUnique({
        where: { id: orderId },
        select: { reference: true, customer_org_id: true },
      });
      if (!order) return;
      await this.send(order.customer_org_id, STAFFED, 'CUSTOMER', {
        type: 'order.progress',
        category: 'ORDERS',
        params: { orderReference: order.reference, stepCode },
        deepLink: `logix://orders/${orderId}`,
      });
    });
  }

  /** Staff changed the status of a case someone opened. */
  caseUpdated(caseId: string): Promise<void> {
    return this.run('case.updated', async () => {
      const c = await this.prisma.cases.findUnique({
        where: { id: caseId },
        select: { reference: true, status: true, opened_by_user_id: true, opened_by_org_id: true, opened_by_workspace: true },
      });
      if (!c) return;
      const workspace = (c.opened_by_workspace ?? 'CUSTOMER') as Workspace;
      const spec = {
        type: 'case.updated',
        category: 'ACCOUNT' as const,
        params: { caseReference: c.reference, status: c.status },
        deepLink: `logix://cases/${c.reference}`,
      };
      // The person who opened it; if they are gone, the people who run that account.
      if (c.opened_by_user_id) {
        const person = await this.prisma.users.findFirst({
          where: { id: c.opened_by_user_id, status: 'ACTIVE' },
          select: { id: true },
        });
        if (person) {
          await this.notifications.create([this.entry(person.id, c.opened_by_org_id, workspace, spec)]);
          return;
        }
      }
      if (c.opened_by_org_id) await this.send(c.opened_by_org_id, MONEY, workspace, spec);
    });
  }

  /** A payout was paid to its beneficiary. */
  settlementPaid(settlementId: string): Promise<void> {
    return this.run('settlement.paid', async () => {
      const s = await this.prisma.settlements.findUnique({
        where: { id: settlementId },
        select: { reference: true, net_amount: true, beneficiary_org_id: true, beneficiary_role: true },
      });
      if (!s) return;
      await this.send(s.beneficiary_org_id, MONEY, s.beneficiary_role as Workspace, {
        type: 'settlement.paid',
        category: 'FINANCE',
        params: { settlementReference: s.reference, netHalalas: Number(s.net_amount) },
        deepLink: 'logix://settlements',
      });
    });
  }

  /** A buyer placed a supply order: the first message of a PRODUCT_INQUIRY conversation, from the buyer. */
  supplyOrderNew(conversationId: string, senderOrgId: string, messageBody: string | null | undefined): Promise<void> {
    return this.run('supply_order.new', async () => {
      const conv = await this.prisma.conversations.findUnique({
        where: { id: conversationId },
        select: { context_type: true },
      });
      if (conv?.context_type !== 'PRODUCT_INQUIRY') return;
      // Only the opening message is an order; the rest of the chat is not.
      const earlier = await this.prisma.messages.count({ where: { conversation_id: conversationId } });
      if (earlier !== 1) return;

      const parts = await this.prisma.conversation_participants.findMany({
        where: { conversation_id: conversationId, left_at: null },
        select: { organization_id: true, role: true, organizations: { select: { display_name: true } } },
      });
      const supplier = parts.find((p) => p.role === 'SUPPLIER');
      const buyer = parts.find((p) => p.organization_id === senderOrgId);
      // A message from the supplier's own side is not an order.
      if (!supplier?.organization_id || !buyer || supplier.organization_id === senderOrgId) return;

      await this.send(supplier.organization_id, STAFFED, 'SUPPLIER', {
        type: 'supply_order.new',
        category: 'ORDERS',
        params: {
          productName: PRODUCT_LINE.exec(messageBody ?? '')?.[1]?.trim() ?? null,
          buyerName: buyer.organizations?.display_name ?? null,
        },
        deepLink: `logix://supply-orders/${conversationId}`,
      });
    });
  }

  // ---------------------------------------------------------------------------------------------

  private entry(
    userId: string,
    organizationId: string | null,
    workspace: Workspace,
    spec: { type: string; category: NewNotification['category']; params: Prisma.InputJsonObject; deepLink: string; priority?: NewNotification['priority'] },
  ): NewNotification {
    return {
      userId,
      organizationId,
      workspace,
      type: spec.type,
      category: spec.category,
      titleKey: `notifications.${spec.type}.title`,
      bodyKey: `notifications.${spec.type}.body`,
      params: spec.params,
      deepLink: spec.deepLink,
      priority: spec.priority,
    };
  }

  /** One notification for each active member of [orgId] with one of [roles]. */
  private async send(
    orgId: string,
    roles: Role[],
    workspace: Workspace,
    spec: { type: string; category: NewNotification['category']; params: Prisma.InputJsonObject; deepLink: string; priority?: NewNotification['priority'] },
  ): Promise<void> {
    const members = await this.prisma.memberships.findMany({
      where: { organization_id: orgId, status: 'ACTIVE', role: { in: roles } },
      select: { user_id: true },
    });
    await this.notifications.create(members.map((m) => this.entry(m.user_id, orgId, workspace, spec)));
  }

  private async run(event: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (e) {
      this.logger.error(`Notification ${event} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
