import { AdminPaymentsController } from './admin-payments.controller';

const staff = { sub: 'staff-1', sid: 'sess-1', aud: 'staff' as const };
const req = { ip: '10.0.0.1', headers: {} } as never;

function setup() {
  const service = { reject: jest.fn(async () => ({})), list: jest.fn(async () => ({})) };
  return { controller: new AdminPaymentsController(service as never), service };
}

describe('AdminPaymentsController', () => {
  it.each([undefined, null, '', '   ', 'no'])('rejects a missing or blank reason (%p)', (reason) => {
    const { controller, service } = setup();

    expect(() => controller.reject('22222222-2222-2222-2222-222222222222', { reason }, staff, req)).toThrow(
      'Invalid request body',
    );
    expect(service.reject).not.toHaveBeenCalled();
  });

  it('trims the reason before it reaches the service', () => {
    const { controller, service } = setup();
    controller.reject('22222222-2222-2222-2222-222222222222', { reason: '  Wrong amount  ' }, staff, req);

    expect(service.reject).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      'staff-1',
      'Wrong amount',
      expect.objectContaining({ ip: '10.0.0.1' }),
    );
  });

  it('lists with defaults and rejects an unknown status', () => {
    const { controller, service } = setup();
    controller.list({});
    expect(service.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });

    expect(() => controller.list({ status: 'DONE' })).toThrow('Invalid request body');
  });
});
