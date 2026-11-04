import { Reflector } from '@nestjs/core';
import { StaffPermissionGuard, RequireStaffPermission } from './staff-permission.guard';

class Routes {
  @RequireStaffPermission('finance.payments.verify')
  guarded() {}

  open() {}
}

function ctx(handler: () => void, staff?: { sub: string }) {
  return {
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => ({ staff }) }),
  } as never;
}

function setup(roles: { code: string; permissions: string[] }[], enforced = true) {
  const prisma = {
    staff_user_roles: {
      findMany: jest.fn(async ({ where }: never) => {
        void where;
        return roles.map((r) => ({
          staff_roles: {
            code: r.code,
            staff_role_permissions: r.permissions.filter((p) => p === 'finance.payments.verify').map((permission) => ({ permission })),
          },
        }));
      }),
    },
  };
  const config = { get: jest.fn(() => enforced) };
  return new StaffPermissionGuard(new Reflector(), prisma as never, config as never);
}

describe('StaffPermissionGuard', () => {
  const routes = new Routes();

  it('lets a route without a permission through', async () => {
    await expect(setup([]).canActivate(ctx(routes.open, { sub: 's1' }))).resolves.toBe(true);
  });

  it('lets SUPER_ADMIN through', async () => {
    const guard = setup([{ code: 'SUPER_ADMIN', permissions: [] }]);
    await expect(guard.canActivate(ctx(routes.guarded, { sub: 's1' }))).resolves.toBe(true);
  });

  it('lets a role that grants the permission through', async () => {
    const guard = setup([{ code: 'FINANCE', permissions: ['finance.payments.verify'] }]);
    await expect(guard.canActivate(ctx(routes.guarded, { sub: 's1' }))).resolves.toBe(true);
  });

  it('blocks staff without a matching role', async () => {
    const guard = setup([{ code: 'SUPPORT_AGENT', permissions: [] }]);
    await expect(guard.canActivate(ctx(routes.guarded, { sub: 's1' }))).rejects.toMatchObject({
      code: 'FORBIDDEN',
      httpStatus: 403,
    });
  });

  it('blocks staff with no roles at all', async () => {
    await expect(setup([]).canActivate(ctx(routes.guarded, { sub: 's1' }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets everyone through while enforcement is off', async () => {
    await expect(setup([], false).canActivate(ctx(routes.guarded, { sub: 's1' }))).resolves.toBe(true);
  });

  it('needs a staff session on guarded routes', async () => {
    await expect(setup([]).canActivate(ctx(routes.guarded))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
