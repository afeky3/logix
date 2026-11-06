import { AppError } from '../../common/errors/app-error';
import { OrdersService } from './orders.service';

/** POST /quotes/:id/accept refuses a new order without the user's ORDER acceptance. */
function setup(existingOrder: unknown = null) {
  const prisma = {
    quotes: {
      findUnique: jest.fn(async () => ({
        id: 'q1',
        status: 'SUBMITTED',
        valid_until: new Date(Date.now() + 3_600_000),
        service_requests: { customer_org_id: 'org-c', status: 'QUOTED' },
      })),
    },
    memberships: { findUnique: jest.fn(async () => ({ status: 'ACTIVE', role: 'OWNER' })) },
    orders: { findFirst: jest.fn(async () => existingOrder) },
    payment_intents: { findFirst: jest.fn(async () => ({ id: 'pi1', status: 'INITIATED' })) },
    commission_rules: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const legal = {
    assertQuoteConsent: jest.fn(async () => {
      throw new AppError('CONSENT_REQUIRED', 'Accept the order terms before accepting this quote');
    }),
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, legal as never);
  return { service, prisma, legal };
}

describe('OrdersService.acceptQuote consent gate', () => {
  it('answers 422 CONSENT_REQUIRED and creates nothing', async () => {
    const t = setup();
    await expect(t.service.acceptQuote('u1', 'q1')).rejects.toMatchObject({ code: 'CONSENT_REQUIRED', httpStatus: 422 });
    expect(t.legal.assertQuoteConsent).toHaveBeenCalledWith('u1', 'q1');
    expect(t.prisma.commission_rules.findFirst).not.toHaveBeenCalled();
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a retry on an order that already exists is not gated again', async () => {
    const t = setup({ id: 'o1', status: 'PENDING_PAYMENT', customer_org_id: 'org-c' });
    jest.spyOn(t.service as never, 'serializeOrder' as never).mockResolvedValue({ id: 'o1' } as never);
    jest.spyOn(t.service as never, 'serializePaymentIntent' as never).mockResolvedValue({ id: 'pi1' } as never);
    await expect(t.service.acceptQuote('u1', 'q1')).resolves.toMatchObject({ order: { id: 'o1' } });
    expect(t.legal.assertQuoteConsent).not.toHaveBeenCalled();
  });
});
