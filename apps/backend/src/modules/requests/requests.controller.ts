import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { RequestsService } from './requests.service';

const createSchema = z.object({
  serviceType: z.enum(['TRANSPORT', 'CUSTOMS']),
  organizationId: z.string().uuid(),
});

const stepSchema = z.object({
  scope: z.enum(['DOMESTIC', 'CROSS_BORDER']).optional(),
  vehicleTypeCode: z.string().optional(),
  vehicleDescription: z.string().optional(),
  pickupLabel: z.string().optional(),
  dropoffLabel: z.string().optional(),
  destinationCountryCode: z.string().length(2).optional(),
  transportDate: z.string().optional(),
  commodityOther: z.string().optional(),
  weightValue: z.number().optional(),
  weightUnit: z.enum(['KG', 'TON']).optional(),
  quantity: z.number().optional(),
  loadingAssistance: z.enum(['ASSISTANCE', 'FORKLIFT', 'NONE']).optional(),
  temperatureC: z.number().optional(),
  specialHandling: z.string().optional(),
  borderInstructions: z.string().optional(),
  vehiclesCount: z.number().int().optional(),
  longTermContract: z.boolean().optional(),
  contractTerm: z.enum(['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'OTHER']).optional(),
  contractTermOther: z.string().max(120).optional(),
  originSummary: z.string().optional(),
  destinationSummary: z.string().optional(),
  serviceDate: z.string().optional(),
  notes: z.string().optional(),
});

const listQuery = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'QUOTED', 'AWAITING_PAYMENT', 'CONVERTED', 'EXPIRED', 'CANCELLED']).optional(),
});

const cancelSchema = z.object({ reasonCode: z.string().optional() });

/** Customer side of S3 (transport-only) — backend/md/modules/05-requests-quotes-matching.md. */
@Controller('service-requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, serviceType } = parseBody(createSchema, body);
    return this.requests.createDraft(user.sub, organizationId, serviceType);
  }

  @Get()
  list(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, status } = parseBody(listQuery, query);
    return this.requests.list(user.sub, organizationId, status);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.requests.get(id, user.sub);
  }

  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Query('step') step: string | undefined,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.requests.patchStep(id, user.sub, step ?? 'details', parseBody(stepSchema, body));
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.requests.submit(id, user.sub);
  }

  @Get(':id/questions')
  listQuestions(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.requests.listQuestions(id, user.sub);
  }

  @Post(':id/questions/:questionId/answer')
  answerQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { answer } = parseBody(z.object({ answer: z.string().min(1).max(2000) }), body);
    return this.requests.answerQuestion(id, questionId, user.sub, answer);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { reasonCode } = parseBody(cancelSchema, body ?? {});
    return this.requests.cancel(id, user.sub, reasonCode);
  }
}
