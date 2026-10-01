import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { AppAuthService } from './app-auth.service';

const patchMeSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  locale: z.enum(['ar', 'en']).optional(),
});

/** GET /me, PATCH /me, GET /me/workspaces — backend/md/modules/01-auth-identity.md. */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly auth: AppAuthService) {}

  @Get()
  me(@CurrentUser() user: AppTokenPayload) {
    return this.auth.me(user.sub);
  }

  @Patch()
  updateMe(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.auth.updateMe(user.sub, parseBody(patchMeSchema, body));
  }

  @Get('workspaces')
  workspaces(@CurrentUser() user: AppTokenPayload) {
    return this.auth.getWorkspaces(user.sub);
  }
}
