import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { StaffTokenPayload } from './jwt-payload';

/** Reads the staff user set by StaffAuthGuard: `@CurrentStaff() staff: StaffTokenPayload`. */
export const CurrentStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): StaffTokenPayload => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    return (req as FastifyRequest & { staff: StaffTokenPayload }).staff;
  },
);
