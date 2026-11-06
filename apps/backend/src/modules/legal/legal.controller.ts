import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { RequireStaffPermission, StaffPermissionGuard } from '../../common/auth/staff-permission.guard';
import { LEGAL_CONTEXTS } from './legal.rules';
import { LegalAcceptancesService } from './legal-acceptances.service';
import { acceptanceMeta, itemsSchema, termsVersionSchema } from './legal.http';
import { ReturnPoliciesService } from './return-policies.service';
import { AdminLegalService } from './admin-legal.service';

/** The app sends the version as a string; a bare number is accepted too. */
const versionString = z.union([z.string().trim().min(1).max(20), z.number().int().nonnegative()]).transform(String);

const acceptanceBody = z.object({
  termsVersion: termsVersionSchema,
  context: z.enum(LEGAL_CONTEXTS),
  items: itemsSchema,
  locale: z.enum(['ar', 'en']),
  organizationId: z.string().uuid().nullish(),
  quoteId: z.string().uuid().nullish(),
  productId: z.string().uuid().nullish(),
  supplierOrgId: z.string().uuid().nullish(),
  returnPolicyVersion: versionString.nullish(),
});

const returnPolicyBody = z.object({
  text: z.string().trim().min(10).max(10000),
  returnWindowDays: z.number().int().min(0).max(3650).nullish(),
  allowsReturn: z.boolean(),
  allowsExchange: z.boolean(),
});

const u = <T>(v: T | null | undefined) => v ?? undefined;

@Controller()
@UseGuards(JwtAuthGuard)
export class LegalController {
  constructor(
    private readonly acceptances: LegalAcceptancesService,
    private readonly policies: ReturnPoliciesService,
  ) {}

  @Post('me/consents')
  @HttpCode(201)
  record(@Body() body: unknown, @CurrentUser() user: AppTokenPayload, @Req() req: FastifyRequest) {
    const b = parseBody(acceptanceBody, body);
    return this.acceptances.record(
      user.sub,
      {
        ...b,
        organizationId: u(b.organizationId),
        quoteId: u(b.quoteId),
        productId: u(b.productId),
        supplierOrgId: u(b.supplierOrgId),
        returnPolicyVersion: b.returnPolicyVersion ?? null,
      },
      acceptanceMeta(req, user.sid),
    );
  }

  @Get('me/consents/platform-terms')
  platformTerms(@CurrentUser() user: AppTokenPayload) {
    return this.acceptances.platformTerms(user.sub);
  }

  @Get('organizations/:id/return-policy')
  getPolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.policies.get(id);
  }

  @Put('organizations/:id/return-policy')
  putPolicy(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.policies.put(id, user.sub, parseBody(returnPolicyBody, body));
  }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filterQuery = z.object({
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  context: z.enum(LEGAL_CONTEXTS).optional(),
  quoteId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  from: day.optional(),
  to: day.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
const listQuery = filterQuery.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Dashboard: consent log and suppliers' return-policy history. */
@Controller('admin')
@UseGuards(StaffAuthGuard, StaffPermissionGuard)
export class AdminLegalController {
  constructor(
    private readonly legal: AdminLegalService,
    private readonly policies: ReturnPoliciesService,
  ) {}

  @Get('legal-acceptances')
  @RequireStaffPermission('legal.acceptances.read')
  list(@Query() query: Record<string, unknown>) {
    return this.legal.list(parseBody(listQuery, query));
  }

  @Get('legal-acceptances/export.csv')
  @RequireStaffPermission('legal.acceptances.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="legal-acceptances.csv"')
  export(@Query() query: Record<string, unknown>) {
    return this.legal.exportCsv(parseBody(filterQuery, query));
  }

  @Get('legal-acceptances/:id')
  @RequireStaffPermission('legal.acceptances.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.legal.get(id);
  }

  @Get('organizations/:id/return-policy')
  policyHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.policies.history(id);
  }
}
