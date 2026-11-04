import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { NotificationsService } from './notifications.service';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

/** The signed-in user's notification center. */
@Controller('me/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    return this.notifications.list(user.sub, parseBody(listQuery, query));
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AppTokenPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @Post(':id/read')
  read(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AppTokenPayload) {
    return this.notifications.markRead(user.sub, id);
  }
}
