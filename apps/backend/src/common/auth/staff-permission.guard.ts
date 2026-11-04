import { CanActivate, ExecutionContext, Injectable, Logger, SetMetadata } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../errors/app-error';
import type { StaffTokenPayload } from './jwt-payload';

const PERMISSION_KEY = 'staff:permission';
const SUPER_ADMIN = 'SUPER_ADMIN';

/** Marks a staff route with the permission it needs, e.g. `@RequireStaffPermission('finance.payments.verify')`.
 * Use together with StaffAuthGuard, listed before this guard. */
export const RequireStaffPermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);

/**
 * Allows SUPER_ADMIN, or any staff user whose roles grant the route's permission.
 * Reads the roles on every call (a handful of rows) so a revoked role takes effect at once.
 * While STAFF_PERMISSIONS_ENFORCED is off it lets every authenticated staff user through
 * and logs what it would have decided — see env.schema.ts.
 */
@Injectable()
export class StaffPermissionGuard implements CanActivate {
  private readonly logger = new Logger(StaffPermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!permission) return true;

    const staff = ctx.switchToHttp().getRequest<FastifyRequest & { staff?: StaffTokenPayload }>().staff;
    if (!staff) throw new AppError('UNAUTHENTICATED', 'Missing staff session');

    const allowed = await this.hasPermission(staff.sub, permission);
    if (allowed) return true;

    const enforced = this.config.get<boolean | string>('STAFF_PERMISSIONS_ENFORCED');
    if (enforced !== true && enforced !== 'true') {
      this.logger.warn(`Staff ${staff.sub} lacks ${permission}; allowed because STAFF_PERMISSIONS_ENFORCED is off`);
      return true;
    }
    throw new AppError('FORBIDDEN', `Missing permission ${permission}`);
  }

  async hasPermission(staffUserId: string, permission: string): Promise<boolean> {
    const grants = await this.prisma.staff_user_roles.findMany({
      where: { staff_user_id: staffUserId },
      select: {
        staff_roles: {
          select: { code: true, staff_role_permissions: { where: { permission }, select: { permission: true } } },
        },
      },
    });
    return grants.some(
      (g) => g.staff_roles.code === SUPER_ADMIN || g.staff_roles.staff_role_permissions.length > 0,
    );
  }
}
