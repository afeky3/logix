import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { OpportunitiesService } from './opportunities.service';

const orgQuery = z.object({ organizationId: z.string().uuid() });
const declineSchema = z.object({ organizationId: z.string().uuid(), reasonCode: z.string().optional() });
const askSchema = z.object({ organizationId: z.string().uuid(), question: z.string().min(1).max(1000) });

/** Provider side of S3 — backend/md/modules/05-requests-quotes-matching.md §2. */
@Controller('provider/opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Get()
  list(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { organizationId } = parseBody(orgQuery, query);
    return this.opportunities.list(user.sub, organizationId);
  }

  @Get(':requestId')
  get(
    @Param('requestId') requestId: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId } = parseBody(orgQuery, query);
    return this.opportunities.get(user.sub, organizationId, requestId);
  }

  @Post(':requestId/decline')
  decline(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId, reasonCode } = parseBody(declineSchema, body);
    return this.opportunities.decline(user.sub, organizationId, requestId, reasonCode);
  }

  @Post(':requestId/questions')
  ask(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId, question } = parseBody(askSchema, body);
    return this.opportunities.ask(user.sub, organizationId, requestId, question);
  }

  @Get(':requestId/questions')
  listQuestions(
    @Param('requestId') requestId: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { organizationId } = parseBody(orgQuery, query);
    return this.opportunities.listQuestions(user.sub, organizationId, requestId);
  }
}
