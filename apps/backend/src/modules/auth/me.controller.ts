import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { AppAuthService } from './app-auth.service';

const notifyPrefsSchema = z
  .object({
    orders: z.boolean().optional(),
    offers: z.boolean().optional(),
    messages: z.boolean().optional(),
    promotions: z.boolean().optional(),
  })
  .strict();

const patchMeSchema = z.object({
  // 2 to 80 characters, as the database requires (ck_users_name): otherwise a wrong length is a 500.
  fullName: z.string().trim().min(2).max(80).optional(),
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

  @Get('notification-preferences')
  notificationPreferences(@CurrentUser() user: AppTokenPayload) {
    return this.auth.getNotificationPreferences(user.sub);
  }

  @Put('notification-preferences')
  updateNotificationPreferences(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.auth.updateNotificationPreferences(user.sub, parseBody(notifyPrefsSchema, body));
  }
}
