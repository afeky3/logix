import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AppTokenPayload } from './jwt-payload';

/** Reads the app user set by JwtAuthGuard: `@CurrentUser() user: AppTokenPayload`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AppTokenPayload => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    return (req as FastifyRequest & { user: AppTokenPayload }).user;
  },
);
