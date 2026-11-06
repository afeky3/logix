import { OrdersService } from './orders.service';

function setup(flag: unknown) {
  const prisma = { payment_intents: { findUnique: jest.fn() } };
  const config = { get: jest.fn((key: string) => (key === 'PAYMENT_SIMULATION_ENABLED' ? flag : undefined)) };
  const service = new OrdersService(prisma as never, {} as never, {} as never, {} as never, {} as never, config as never, {} as never);
  return { service, prisma };
}

describe('OrdersService.simulatePayment', () => {
  it.each([undefined, false, 'false', 'yes'])('is closed when PAYMENT_SIMULATION_ENABLED is %p', async (flag) => {
    const t = setup(flag);

    await expect(t.service.simulatePayment('user-1', 'intent-1', 'succeed')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      httpStatus: 403,
    });
    // It must refuse before reading anything, let alone settling an order.
    expect(t.prisma.payment_intents.findUnique).not.toHaveBeenCalled();
  });

  it.each([true, 'true'])('is open when PAYMENT_SIMULATION_ENABLED is %p', async (flag) => {
    const t = setup(flag);
    t.prisma.payment_intents.findUnique.mockResolvedValue(null);

    await expect(t.service.simulatePayment('user-1', 'intent-1', 'succeed')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(t.prisma.payment_intents.findUnique).toHaveBeenCalled();
  });
});
