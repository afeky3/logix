import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { TermsService } from './terms.service';
import { KybService } from './kyb.service';

const currentTermsQuery = z.object({
  audience: z.enum(['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'PURCHASE', 'INSURANCE', 'PRIVACY']),
});

const consentKeys = [
  'TERMS_ACCEPTANCE',
  'PRIVACY_ACCEPTANCE',
  'REQUEST_ACCURACY',
  'QUOTED_SCOPE',
  'CANCELLATION_POLICY_ACK',
  'RECEIPT_CONFIRMATION',
  'LISTING_ACCURACY',
  'INSURANCE_TERMS',
  'PURCHASE_TERMS',
  'BROKER_AUTHORIZATION',
  'REPORT_ACCURACY',
] as const;

const recordConsentSchema = z.object({
  organizationId: z.string().uuid(),
  workspace: z.enum(['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'DRIVER']),
  consentKey: z.enum(consentKeys),
  termsDocumentId: z.string().uuid().optional(),
  context: z
    .object({
      type: z.string().optional(),
      id: z.string().uuid().optional(),
      reference: z.string().optional(),
    })
    .optional(),
});

/** backend/md/modules/02-organizations-kyb-terms.md §"Terms and consent" */
const documentRequirementsQuery = z.object({
  workspace: z.enum(['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'DRIVER']).optional(),
  activity: z
    .enum([
      'FREIGHT_SEA',
      'FREIGHT_AIR',
      'FREIGHT_LAND',
      'EXPRESS',
      'TRANSPORT_CARRIER',
      'TRANSPORT_BROKER',
      'WAREHOUSE',
      'CUSTOMS_BROKER',
    ])
    .optional(),
});

@Controller()
export class TermsController {
  constructor(
    private readonly terms: TermsService,
    private readonly kyb: KybService,
  ) {}

  @Get('document-requirements')
  documentRequirements(@Query() query: Record<string, unknown>) {
    const { workspace, activity } = parseBody(documentRequirementsQuery, query);
    return this.kyb.documentRequirements(workspace, activity);
  }

  @Get('terms/current')
  current(@Query() query: Record<string, unknown>, @Req() req: FastifyRequest) {
    const { audience } = parseBody(currentTermsQuery, query);
    const locale = req.headers['x-localization'] === 'en' ? 'en' : 'ar';
    return this.terms.current(audience, locale);
  }

  @Post('consents')
  @UseGuards(JwtAuthGuard)
  async recordConsent(
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
    @Req() req: FastifyRequest,
  ) {
    const { organizationId, workspace, consentKey, termsDocumentId, context } = parseBody(
      recordConsentSchema,
      body,
    );
    return this.terms.recordConsent({
      userId: user.sub,
      organizationId,
      workspace,
      consentKey,
      termsDocumentId,
      contextType: context?.type,
      contextId: context?.id,
      contextReference: context?.reference,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
