import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import type { AppTokenPayload } from './jwt-payload';

/** Requires a valid app-user access token (`aud: "app"`). Sets `req.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('UNAUTHENTICATED', 'Missing access token');

    try {
      const payload = await this.jwt.verifyAsync<AppTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.aud !== 'app') {
        throw new AppError('UNAUTHENTICATED', 'Wrong token audience');
      }
      (req as FastifyRequest & { user: AppTokenPayload }).user = payload;
      return true;
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('TOKEN_EXPIRED', 'Invalid or expired access token');
    }
  }
}
