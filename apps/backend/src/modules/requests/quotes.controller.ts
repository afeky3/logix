import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { QuotesService } from './quotes.service';

const quoteInputSchema = z.object({
  requestId: z.string().uuid().optional(), // preview only: picks the commission rate by service type
  serviceFeeHalalas: z.number().positive(),
  chargesTotalHalalas: z.number().nonnegative().optional(),
  etaDate: z.string().optional(),
  durationDays: z.number().optional(),
  validHours: z.number().int().optional(),
  scopeIncluded: z.string().optional(),
  exclusions: z.string().optional(),
  notes: z.string().optional(),
  internalCostHalalas: z.number().optional(),
  targetMarginHalalas: z.number().optional(),
});

const submitSchema = quoteInputSchema.extend({
  organizationId: z.string().uuid(),
  requestId: z.string().uuid(),
});

const orgQuery = z.object({ organizationId: z.string().uuid(), status: z.string().optional() });
const orgBody = z.object({ organizationId: z.string().uuid() });

/** Provider side — submit/revise/withdraw/preview, and the customer-facing
 * list/compare under /service-requests. backend/md/modules/05-requests-quotes-matching.md §3. */
@Controller()
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post('provider/quotes/preview')
  preview(@Body() body: unknown) {
    return this.quotes.preview(parseBody(quoteInputSchema, body));
  }

  @Post('provider/quotes')
  submit(@Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, requestId, ...input } = parseBody(submitSchema, body);
    return this.quotes.submit(user.sub, organizationId, requestId, input);
  }

  @Patch('provider/quotes/:id')
  revise(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, ...input } = parseBody(submitSchema.omit({ requestId: true }), body);
    return this.quotes.revise(user.sub, organizationId, id, input);
  }

  @Post('provider/quotes/:id/withdraw')
  withdraw(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { organizationId } = parseBody(orgBody, body);
    return this.quotes.withdraw(user.sub, organizationId, id);
  }

  @Get('provider/quotes')
  listMine(@Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { organizationId, status } = parseBody(orgQuery, query);
    return this.quotes.listForProvider(user.sub, organizationId, status);
  }

  @Get('service-requests/:id/quotes')
  listForCustomer(
    @Param('id') id: string,
    @Query('sort') sort: string | undefined,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.quotes.listForCustomer(user.sub, id, sort);
  }

  @Get('service-requests/:id/quotes/compare')
  compare(
    @Param('id') id: string,
    @Query('ids') ids: string,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.quotes.compareForCustomer(user.sub, id, (ids ?? '').split(',').filter(Boolean));
  }

  @Get('quotes/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.quotes.getForCustomer(user.sub, id);
  }
}
