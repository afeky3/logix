import { NotificationEvents } from './notification-events.service';
import { NotificationsService } from './notifications.service';

const ORG = 'org-1';

/** Members of org-1: who gets what depends on role. */
const MEMBERS = [
  { user_id: 'owner', role: 'OWNER' },
  { user_id: 'manager', role: 'MANAGER' },
  { user_id: 'member', role: 'MEMBER' },
  { user_id: 'driver', role: 'DRIVER' },
];

function setup(over: Record<string, unknown> = {}) {
  const created: Record<string, unknown>[] = [];
  const prisma = {
    memberships: {
      findMany: jest.fn(async ({ where }: { where: { organization_id: string; role: { in: string[] } } }) =>
        MEMBERS.filter((m) => where.role.in.includes(m.role)).map((m) => ({ user_id: m.user_id, org: where.organization_id })),
      ),
    },
    quotes: {
      findUnique: jest.fn(async () => ({
        request_id: 'req-1',
        total_amount: 115000n,
        organizations: { display_name: 'Fast Haulers' },
        service_requests: { reference: 'LX-260001', customer_org_id: ORG },
      })),
    },
    orders: {
      findUnique: jest.fn(async () => ({ reference: 'LX-260002', total_amount: 230000n, provider_org_id: ORG, customer_org_id: ORG })),
    },
    service_requests: { findUnique: jest.fn(async () => ({ reference: 'LX-260003', service_type: 'TRANSPORT' })) },
    transport_request_details: { findUnique: jest.fn(async () => ({ pickup_label: 'Riyadh', dropoff_label: 'Abha' })) },
    cases: {
      findUnique: jest.fn(async () => ({ reference: 'CASE-260001', status: 'RESOLVED', opened_by_user_id: 'opener', opened_by_org_id: ORG, opened_by_workspace: 'CUSTOMER' })),
    },
    users: { findFirst: jest.fn(async () => ({ id: 'opener' })) },
    settlements: {
      findUnique: jest.fn(async () => ({ reference: 'STL-260001', net_amount: 90000n, beneficiary_org_id: ORG, beneficiary_role: 'SUPPLIER' })),
    },
    conversations: { findUnique: jest.fn(async () => ({ context_type: 'PRODUCT_INQUIRY' })) },
    messages: { count: jest.fn(async () => 1) },
    conversation_participants: {
      findMany: jest.fn(async () => [
        { organization_id: 'buyer-org', role: 'CUSTOMER', organizations: { display_name: 'Acme Buyer' } },
        { organization_id: ORG, role: 'SUPPLIER', organizations: { display_name: 'Pack Co' } },
      ]),
    },
    ...over,
  };
  const notifications = { create: jest.fn(async (n: Record<string, unknown>[]) => void created.push(...n)) };
  const events = new NotificationEvents(prisma as never, notifications as never);
  return { events, prisma, notifications, created };
}

const ids = (c: Record<string, unknown>[]) => c.map((n) => n.userId);

describe('quote.received: to the customer, QUOTES', () => {
  it('goes to the people who run the customer account, not drivers', async () => {
    const t = setup();
    await t.events.quoteReceived('q1');
    expect(ids(t.created)).toEqual(['owner', 'manager', 'member']);
    expect(t.created[0]).toMatchObject({
      organizationId: ORG,
      workspace: 'CUSTOMER',
      type: 'quote.received',
      category: 'QUOTES',
      titleKey: 'notifications.quote.received.title',
      bodyKey: 'notifications.quote.received.body',
      params: { requestReference: 'LX-260001', providerName: 'Fast Haulers', amountHalalas: 115000 },
      deepLink: 'logix://requests/req-1/offers',
    });
  });
});

describe('quote.accepted: to the provider, ORDERS', () => {
  it('names the order and the amount', async () => {
    const t = setup();
    await t.events.quoteAccepted('order-1');
    expect(t.created[0]).toMatchObject({
      workspace: 'PROVIDER',
      category: 'ORDERS',
      params: { orderReference: 'LX-260002', amountHalalas: 230000 },
      deepLink: 'logix://orders/order-1',
    });
  });
});

describe('opportunity.new: to each matched provider, QUOTES', () => {
  it('one set of notifications per provider, once, with the route', async () => {
    const t = setup();
    await t.events.opportunityNew('req-3', [ORG, ORG, 'org-2']);
    // two distinct providers x three people each
    expect(t.created).toHaveLength(6);
    expect(t.created[0]).toMatchObject({
      workspace: 'PROVIDER',
      category: 'QUOTES',
      params: { requestReference: 'LX-260003', serviceType: 'TRANSPORT', originSummary: 'Riyadh', destinationSummary: 'Abha' },
      deepLink: 'logix://opportunities/req-3',
    });
  });

  it('sends nothing when nobody matched', async () => {
    const t = setup();
    await t.events.opportunityNew('req-3', []);
    expect(t.created).toHaveLength(0);
  });

  it('a request without a route (customs, storage) has null summaries, not made-up text', async () => {
    const t = setup({ transport_request_details: { findUnique: jest.fn(async () => null) } });
    await t.events.opportunityNew('req-3', [ORG]);
    expect(t.created[0]).toMatchObject({ params: { originSummary: null, destinationSummary: null } });
  });
});

describe('order.progress: to the customer, ORDERS', () => {
  it('carries the step code', async () => {
    const t = setup();
    await t.events.orderProgress('order-1', 'PICKED_UP');
    expect(t.created[0]).toMatchObject({
      workspace: 'CUSTOMER',
      category: 'ORDERS',
      params: { orderReference: 'LX-260002', stepCode: 'PICKED_UP' },
      deepLink: 'logix://orders/order-1',
    });
  });
});

describe('case.updated: to whoever opened the case, ACCOUNT', () => {
  it('goes to the person who opened it, by reference', async () => {
    const t = setup();
    await t.events.caseUpdated('case-1');
    expect(ids(t.created)).toEqual(['opener']);
    expect(t.created[0]).toMatchObject({
      category: 'ACCOUNT',
      params: { caseReference: 'CASE-260001', status: 'RESOLVED' },
      deepLink: 'logix://cases/CASE-260001',
    });
  });

  it('if that person is gone it goes to the owner and managers of the account', async () => {
    const t = setup({ users: { findFirst: jest.fn(async () => null) } });
    await t.events.caseUpdated('case-1');
    expect(ids(t.created)).toEqual(['owner', 'manager']);
  });
});

describe('settlement.paid: to the beneficiary, FINANCE', () => {
  it('goes to the people who handle money, in the beneficiary workspace', async () => {
    const t = setup();
    await t.events.settlementPaid('s1');
    expect(ids(t.created)).toEqual(['owner', 'manager']);
    expect(t.created[0]).toMatchObject({
      workspace: 'SUPPLIER',
      category: 'FINANCE',
      params: { settlementReference: 'STL-260001', netHalalas: 90000 },
      deepLink: 'logix://settlements',
    });
  });
});

describe('supply_order.new: to the supplier, ORDERS', () => {
  const order = 'طلب توريد\n───────────\nالمنتج: كراتين مقوّاة\nالكمية: 50 قطعة\n───────────';

  it('the buyer\'s opening message becomes a supply order, with the product and the buyer', async () => {
    const t = setup();
    await t.events.supplyOrderNew('conv-1', 'buyer-org', order);
    expect(ids(t.created)).toEqual(['owner', 'manager', 'member']);
    expect(t.created[0]).toMatchObject({
      workspace: 'SUPPLIER',
      category: 'ORDERS',
      params: { productName: 'كراتين مقوّاة', buyerName: 'Acme Buyer' },
      deepLink: 'logix://supply-orders/conv-1',
    });
  });

  it('the product is null when the message does not say (never invented)', async () => {
    const t = setup();
    await t.events.supplyOrderNew('conv-1', 'buyer-org', 'hello');
    expect(t.created[0]).toMatchObject({ params: { productName: null } });
  });

  it('later messages in the chat are not orders', async () => {
    const t = setup({ messages: { count: jest.fn(async () => 2) } });
    await t.events.supplyOrderNew('conv-1', 'buyer-org', order);
    expect(t.created).toHaveLength(0);
  });

  it('a message from the supplier itself is not an order', async () => {
    const t = setup();
    await t.events.supplyOrderNew('conv-1', ORG, order);
    expect(t.created).toHaveLength(0);
  });

  it('other kinds of conversation are ignored', async () => {
    const t = setup({ conversations: { findUnique: jest.fn(async () => ({ context_type: 'ORDER' })) } });
    await t.events.supplyOrderNew('conv-1', 'buyer-org', order);
    expect(t.created).toHaveLength(0);
  });
});

describe('a notification never breaks what it announces', () => {
  it('a failure is swallowed and logged, not thrown', async () => {
    const t = setup({ quotes: { findUnique: jest.fn(async () => { throw new Error('db down'); }) } });
    await expect(t.events.quoteReceived('q1')).resolves.toBeUndefined();
    expect(t.created).toHaveLength(0);
  });

  it('an event for something that no longer exists is a quiet no-op', async () => {
    const t = setup({ orders: { findUnique: jest.fn(async () => null) } });
    await expect(t.events.orderProgress('gone', 'X')).resolves.toBeUndefined();
    expect(t.created).toHaveLength(0);
  });
});

describe('GET /me/notifications: workspace and organization on each item, workspace filter', () => {
  function listSetup() {
    const row = (workspace: string | null, org: string | null) => ({
      id: 'n1', notification_type: 'quote.received', category: 'QUOTES', title_key: 't', body_key: 'b', params: {},
      deep_link: null, priority: 'NORMAL', workspace, organization_id: org, read_at: null, created_at: new Date(),
    });
    const prisma = {
      notifications: {
        findMany: jest.fn(async () => [row('CUSTOMER', ORG), row(null, null)]),
        count: jest.fn(async (_a: unknown) => 3),
      },
    };
    return { prisma, service: new NotificationsService(prisma as never) };
  }

  it('items carry workspace and organizationId (null when the notice is not tied to one)', async () => {
    const t = listSetup();
    const res = await t.service.list('u1', { page: 1, pageSize: 20, unreadOnly: false });
    expect(res.items[0]).toMatchObject({ workspace: 'CUSTOMER', organizationId: ORG });
    expect(res.items[1]).toMatchObject({ workspace: null, organizationId: null });
  });

  it('without a filter everything of the user counts, unread included', async () => {
    const t = listSetup();
    await t.service.list('u1', { page: 1, pageSize: 20, unreadOnly: false });
    const wheres = t.prisma.notifications.count.mock.calls.map((c) => (c[0] as { where: Record<string, unknown> }).where);
    expect(wheres).toEqual([{ user_id: 'u1' }, { user_id: 'u1', read_at: null }]);
  });

  it('with a workspace both the list and the unread count are limited to it', async () => {
    const t = listSetup();
    await t.service.list('u1', { page: 1, pageSize: 20, unreadOnly: true, workspace: 'SUPPLIER' });
    expect(t.prisma.notifications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user_id: 'u1', workspace: 'SUPPLIER', read_at: null } }),
    );
    const wheres = t.prisma.notifications.count.mock.calls.map((c) => (c[0] as { where: Record<string, unknown> }).where);
    expect(wheres[1]).toEqual({ user_id: 'u1', workspace: 'SUPPLIER', read_at: null });
  });
});
