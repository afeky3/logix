import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { AppAuthService } from './app-auth.service';

/** GET /me, GET /me/workspaces — backend/md/modules/01-auth-identity.md. */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly auth: AppAuthService) {}

  @Get()
  me(@CurrentUser() user: AppTokenPayload) {
    return this.auth.me(user.sub);
  }

  @Get('workspaces')
  workspaces(@CurrentUser() user: AppTokenPayload) {
    return this.auth.getWorkspaces(user.sub);
  }
}
