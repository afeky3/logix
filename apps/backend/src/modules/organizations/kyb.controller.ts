import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { KybService } from './kyb.service';

const businessProfileSchema = z.object({
  legalName: z.string().min(1).max(300),
  tradeName: z.string().max(300).optional(),
  crNumber: z.string().min(1).max(50),
  crExpiry: z.string().optional(),
  vatNumber: z.string().max(50).optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  registeredAddressId: z.string().uuid().optional(),
});

const addressSchema = z.object({
  label: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  countryCode: z.string().length(2).optional(),
  cityId: z.string().uuid().optional(),
  district: z.string().optional(),
  street: z.string().optional(),
  buildingNumber: z.string().optional(),
  postalCode: z.string().optional(),
  additionalNumber: z.string().optional(),
  shortAddress: z.string().optional(),
  addressLine: z.string().optional(),
  isDefault: z.boolean().optional(),
  isRegistered: z.boolean().optional(),
});

const bankAccountSchema = z.object({
  iban: z.string().min(15).max(34),
  bankName: z.string().min(1).max(200),
  accountHolderName: z.string().min(1).max(200),
  proofDocumentId: z.string().uuid().optional(),
});

const licenseSchema = z.object({
  licenseType: z.enum([
    'COMMERCIAL_REGISTRATION',
    'TGA_TRANSPORT_LICENSE',
    'CUSTOMS_BROKER_LICENSE',
    'VAT_CERTIFICATE',
    'NATIONAL_ADDRESS_PROOF',
    'INSURANCE_POLICY',
    'WAREHOUSE_LICENSE',
    'OTHER',
  ]),
  relatedActivity: z.string().optional(),
  number: z.string().min(1).max(100),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  fileId: z.string().uuid(),
});

const workspaceQuery = z.object({
  workspace: z.enum(['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'DRIVER']).default('SUPPLIER'),
});

const activityTypes = [
  'FREIGHT_SEA',
  'FREIGHT_AIR',
  'FREIGHT_LAND',
  'EXPRESS',
  'TRANSPORT_CARRIER',
  'TRANSPORT_BROKER',
  'WAREHOUSE',
  'CUSTOMS_BROKER',
  'OTHER',
] as const;

const addActivitySchema = z
  .object({ activity: z.enum(activityTypes), otherText: z.string().trim().min(2).max(120).optional() })
  .refine((v) => v.activity !== 'OTHER' || !!v.otherText, { message: 'otherText is required for OTHER', path: ['otherText'] });

const documentRequirementsQuery = z.object({
  workspace: z.enum(['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'DRIVER']).optional(),
  activity: z.enum(activityTypes).optional(),
});

/** backend/md/modules/02-organizations-kyb-terms.md */
@Controller('organizations/:id')
@UseGuards(JwtAuthGuard)
export class KybController {
  constructor(private readonly kyb: KybService) {}

  @Get('business-profile')
  getBusinessProfile(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.getBusinessProfile(id, user.sub);
  }

  @Put('business-profile')
  putBusinessProfile(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.kyb.putBusinessProfile(id, user.sub, parseBody(businessProfileSchema, body));
  }

  @Get('addresses')
  listAddresses(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.listAddresses(id, user.sub);
  }

  @Post('addresses')
  createAddress(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.createAddress(id, user.sub, parseBody(addressSchema, body));
  }

  @Patch('addresses/:addressId')
  updateAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.kyb.updateAddress(id, addressId, user.sub, parseBody(addressSchema.partial(), body));
  }

  @Delete('addresses/:addressId')
  async deleteAddress(
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @CurrentUser() user: AppTokenPayload,
  ): Promise<{ success: true }> {
    await this.kyb.deleteAddress(id, addressId, user.sub);
    return { success: true };
  }

  @Get('bank-accounts')
  listBankAccounts(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.listBankAccounts(id, user.sub);
  }

  @Post('bank-accounts')
  addBankAccount(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.addBankAccount(id, user.sub, parseBody(bankAccountSchema, body));
  }

  @Get('licenses')
  listLicenses(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.listLicenses(id, user.sub);
  }

  @Post('licenses')
  addLicense(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.addLicense(id, user.sub, parseBody(licenseSchema, body));
  }

  @Get('activities')
  listActivities(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.kyb.listActivities(id, user.sub);
  }

  @Post('activities')
  addActivity(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { activity, otherText } = parseBody(addActivitySchema, body);
    return this.kyb.addActivity(id, user.sub, activity, otherText);
  }

  @Get('verification')
  getVerification(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { workspace } = parseBody(workspaceQuery, query);
    return this.kyb.getVerification(id, user.sub, workspace);
  }

  @Post('verification/submit')
  submitVerification(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    const { workspace } = parseBody(workspaceQuery, body ?? {});
    return this.kyb.submitVerification(id, user.sub, workspace);
  }
}
