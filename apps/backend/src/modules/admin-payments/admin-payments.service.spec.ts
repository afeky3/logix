import { AppError } from '../../common/errors/app-error';
import { AdminPaymentsService } from './admin-payments.service';

const STAFF = '11111111-1111-1111-1111-111111111111';
const INTENT = '22222222-2222-2222-2222-222222222222';
const meta = { ip: '10.0.0.1', userAgent: 'jest', requestId: 'req-1' };

function makeRow(over: Record<string, unknown> = {}) {
  return {
    id: INTENT,
    payable_type: 'ORDER',
    status: 'INITIATED',
    amount: 115000n,
    currency: 'SAR',
    method: 'BANK_TRANSFER',
    failure_code: null,
    failure_message: null,
    created_at: new Date('2026-11-01T10:00:00Z'),
    paid_at: null,
    expires_at: new Date('2026-11-04T10:00:00Z'),
    payer_org_id: 'org-customer',
    payer_user_id: 'user-customer',
    order_id: 'order-1',
    order_reference: 'LX-000123',
    order_status: 'PENDING_PAYMENT',
    service_type: 'TRANSPORT',
    provider_org_id: 'org-provider',
    customer_name: 'Acme',
    payer_user_name: 'Sara',
    payer_phone: '+966500000000',
    cycle_id: null,
    cycle_no: null,
    cycle_status: null,
    ...over,
  };
}

/** An in-memory stand-in for the parts of Prisma the service touches. `row` is the one intent under test. */
function setup(initial: Record<string, unknown> = {}) {
  const state = { row: makeRow(initial), otherIntents: 0 };
  const audit: Record<string, unknown>[] = [];
  const notes: Record<string, unknown>[] = [];

  // Typed loosely on purpose: `$transaction` hands the fake itself to the callback, which TypeScript
  // can't infer for an object that refers to itself.
  const db: Record<string, unknown> & {
    payment_intents: { count: jest.Mock; update: jest.Mock };
  } = {
    // A copy per query, like the database: later updates must not rewrite what was already read.
    $queryRaw: jest.fn(async () => [{ ...state.row }]),
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(db)),
    payment_intents: {
      count: jest.fn(async () => state.otherIntents),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(state.row, data);
      }),
    },
    memberships: { findMany: jest.fn(async () => [{ user_id: 'user-provider' }]) },
    audit_logs: { findMany: jest.fn(async () => []) },
    staff_users: { findMany: jest.fn(async () => []) },
  };

  const orders = {
    settleOrderIntentTx: jest.fn(async () => {
      state.row.status = 'PAID';
      state.row.order_status = 'CONFIRMED';
    }),
    finishOrderSettlement: jest.fn(async () => undefined),
  };
  const contracts = {
    settleCycleIntentTx: jest.fn(async () => {
      state.row.status = 'PAID';
    }),
    finishCycleSettlement: jest.fn(async () => undefined),
  };
  const auditService = { logStaff: jest.fn(async (e: Record<string, unknown>) => void audit.push(e)) };
  const notifications = { create: jest.fn(async (n: Record<string, unknown>[]) => void notes.push(...n)) };

  const service = new AdminPaymentsService(
    db as never,
    orders as never,
    contracts as never,
    auditService as never,
    notifications as never,
  );
  return { service, state, db, orders, contracts, audit, notes, notifications };
}

async function failure(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected the call to fail');
}

describe('AdminPaymentsService.approve', () => {
  it('settles the order, audits it and notifies the customer and the provider', async () => {
    const t = setup();
    const result = await t.service.approve(INTENT, STAFF, meta);

    expect(t.orders.settleOrderIntentTx).toHaveBeenCalledWith(
      t.db,
      INTENT,
      'order-1',
      `bank_transfer_${INTENT}`,
      expect.any(Date),
    );
    expect(t.orders.finishOrderSettlement).toHaveBeenCalledWith('order-1');
    expect(t.audit).toHaveLength(1);
    expect(t.audit[0]).toMatchObject({
      staffId: STAFF,
      action: 'payment.approved',
      entityId: INTENT,
      entityReference: 'LX-000123',
      ip: '10.0.0.1',
      reason: null,
    });
    expect(t.notes.map((n) => [n.userId, n.type])).toEqual([
      ['user-customer', 'payment.approved'],
      ['user-provider', 'order.confirmed'],
    ]);
    expect(result.status).toBe('PAID');
  });

  it('settles a monthly cycle through the contracts service', async () => {
    const t = setup({ payable_type: 'CONTRACT_CYCLE', cycle_id: 'cycle-2', cycle_no: 2, cycle_status: 'DUE' });
    await t.service.approve(INTENT, STAFF, meta);

    expect(t.contracts.settleCycleIntentTx).toHaveBeenCalledWith(
      t.db,
      INTENT,
      'cycle-2',
      `bank_transfer_${INTENT}`,
      expect.any(Date),
    );
    expect(t.contracts.finishCycleSettlement).toHaveBeenCalledWith('cycle-2');
    expect(t.orders.settleOrderIntentTx).not.toHaveBeenCalled();
    expect(t.notes.map((n) => n.type)).toEqual(['payment.approved', 'contract.cycle_paid']);
  });

  it('approves after the hold expired while the order is still pending, and audits it as late', async () => {
    const t = setup({ status: 'EXPIRED' });
    await t.service.approve(INTENT, STAFF, meta);

    expect(t.orders.settleOrderIntentTx).toHaveBeenCalled();
    expect(t.audit[0]).toMatchObject({
      action: 'payment.approved_late',
      after: { status: 'PAID', late: true },
      reason: 'Approved after the payment hold expired',
    });
  });

  it('refuses a late approval once the order is void', async () => {
    const t = setup({ status: 'EXPIRED', order_status: 'VOID' });
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe('INVALID_STATE_TRANSITION');
    expect(t.orders.settleOrderIntentTx).not.toHaveBeenCalled();
    expect(t.audit).toHaveLength(0);
  });

  it('refuses a second approval of the same transfer', async () => {
    const t = setup();
    await t.service.approve(INTENT, STAFF, meta);
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.httpStatus).toBe(409);
    expect(t.orders.settleOrderIntentTx).toHaveBeenCalledTimes(1);
    expect(t.audit).toHaveLength(1);
  });

  it.each(['PAID', 'FAILED', 'CANCELLED'])('refuses to approve a %s payment', async (status) => {
    const t = setup({ status });
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.httpStatus).toBe(409);
    expect(t.orders.settleOrderIntentTx).not.toHaveBeenCalled();
  });

  it('refuses when another payment already covers the order', async () => {
    const t = setup({ status: 'EXPIRED' });
    t.state.otherIntents = 1;
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.httpStatus).toBe(409);
  });

  it('refuses a cycle that is no longer payable', async () => {
    const t = setup({ payable_type: 'CONTRACT_CYCLE', cycle_id: 'cycle-2', cycle_no: 2, cycle_status: 'VOID' });
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.httpStatus).toBe(409);
    expect(t.contracts.settleCycleIntentTx).not.toHaveBeenCalled();
  });

  it('refuses anything that is not a bank transfer', async () => {
    const t = setup({ method: 'CARD' });
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.code).toBe('INVALID_STATE_TRANSITION');
    expect(t.orders.settleOrderIntentTx).not.toHaveBeenCalled();
  });

  it('still answers success when only the invoice step fails after the commit', async () => {
    const t = setup();
    t.orders.finishOrderSettlement.mockRejectedValueOnce(new Error('invoice service down'));
    const result = await t.service.approve(INTENT, STAFF, meta);

    expect(result.status).toBe('PAID');
  });

  it('does not notify or audit when the settlement itself throws', async () => {
    const t = setup();
    t.orders.settleOrderIntentTx.mockRejectedValueOnce(new Error('db down'));

    await expect(t.service.approve(INTENT, STAFF, meta)).rejects.toThrow('db down');
    expect(t.audit).toHaveLength(0);
    expect(t.notes).toHaveLength(0);
  });
});

describe('AdminPaymentsService.reject', () => {
  it('fails the intent with the reason, renews the hold, audits it and tells the customer', async () => {
    const t = setup();
    const before = Date.now();
    await t.service.reject(INTENT, STAFF, 'Amount does not match the invoice', meta);

    expect(t.state.row).toMatchObject({
      status: 'FAILED',
      failure_code: 'bank_transfer_rejected',
      failure_message: 'Amount does not match the invoice',
    });
    // 72h by default: the customer gets a full hold to send a corrected transfer.
    expect((t.state.row.expires_at as Date).getTime()).toBeGreaterThanOrEqual(before + 72 * 3_600_000 - 1000);
    expect(t.audit[0]).toMatchObject({
      action: 'payment.rejected',
      reason: 'Amount does not match the invoice',
      before: { status: 'INITIATED' },
    });
    expect(t.notes).toHaveLength(1);
    expect(t.notes[0]).toMatchObject({
      userId: 'user-customer',
      type: 'payment.rejected',
      params: expect.objectContaining({ reason: 'Amount does not match the invoice', orderReference: 'LX-000123' }),
    });
    expect(t.orders.settleOrderIntentTx).not.toHaveBeenCalled();
  });

  it.each(['PAID', 'FAILED', 'EXPIRED'])('refuses to reject a %s payment', async (status) => {
    const t = setup({ status });
    const err = await failure(t.service.reject(INTENT, STAFF, 'no money received', meta));

    expect(err.httpStatus).toBe(409);
    expect(t.db.payment_intents.update).not.toHaveBeenCalled();
    expect(t.audit).toHaveLength(0);
  });

  it('refuses a second rejection', async () => {
    const t = setup();
    await t.service.reject(INTENT, STAFF, 'no money received', meta);
    const err = await failure(t.service.reject(INTENT, STAFF, 'no money received', meta));

    expect(err.httpStatus).toBe(409);
    expect(t.audit).toHaveLength(1);
  });

  it('cannot be approved afterwards', async () => {
    const t = setup();
    await t.service.reject(INTENT, STAFF, 'no money received', meta);
    const err = await failure(t.service.approve(INTENT, STAFF, meta));

    expect(err.httpStatus).toBe(409);
  });
});
