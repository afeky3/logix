import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { MessagesService } from './messages.service';

const listConvsQuery = z.object({
  organizationId: z.string().uuid(),
});

const getOrCreateSchema = z.object({
  organizationId: z.string().uuid(),
  contextType: z.enum(['ORDER', 'REQUEST_CLARIFICATION', 'SUPPORT', 'PURCHASE_ORDER', 'TRIP']),
  contextId: z.string().uuid().optional(),
});

const listMsgsQuery = z.object({
  organizationId: z.string().uuid(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const sendSchema = z.object({
  organizationId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

const markReadSchema = z.object({
  organizationId: z.string().uuid(),
});

const unreadQuery = z.object({
  organizationId: z.string().uuid(),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** List all conversations for an organization. */
  @Get('conversations')
  list(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { organizationId } = parseBody(listConvsQuery, query);
    return this.messages.listConversations(user.sub, organizationId);
  }

  /** How many conversations have unread messages. */
  @Get('conversations/unread')
  unread(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { organizationId } = parseBody(unreadQuery, query);
    return this.messages.unreadCount(user.sub, organizationId);
  }

  /** Get-or-create a conversation for a given context (order, support, etc.). */
  @Post('conversations')
  getOrCreate(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, contextType, contextId } = parseBody(getOrCreateSchema, body);
    return this.messages.getOrCreate(user.sub, organizationId, contextType, contextId);
  }

  /** Paginated messages for a conversation (newest first). */
  @Get('conversations/:id/messages')
  listMessages(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId, cursor, limit } = parseBody(listMsgsQuery, query);
    return this.messages.listMessages(user.sub, organizationId, id, cursor, limit);
  }

  /** Send a text message. */
  @Post('conversations/:id/messages')
  send(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId, body: text } = parseBody(sendSchema, body);
    return this.messages.sendMessage(user.sub, organizationId, id, text);
  }

  /** Mark all messages in a conversation as read. */
  @Post('conversations/:id/read')
  markRead(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId } = parseBody(markReadSchema, body);
    return this.messages.markRead(user.sub, organizationId, id);
  }
}
