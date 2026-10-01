import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { encryptField, fingerprint } from '../../common/util/crypto';
import { isValidSaudiIban } from '../../common/util/iban';
import { toBytes } from '../../common/util/bytes';

const BANK_PAYOUT_HOLD_HOURS = 48;

export interface AddressInput {
  label?: string;
  contactName?: string;
  contactPhone?: string;
  countryCode?: string;
  cityId?: string;
  district?: string;
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  additionalNumber?: string;
  shortAddress?: string;
  addressLine?: string;
  isDefault?: boolean;
  isRegistered?: boolean;
}

export interface BusinessProfileInput {
  legalName: string;
  tradeName?: string;
  crNumber: string;
  crExpiry?: string;
  vatNumber?: string;
  contactPhone?: string;
  contactEmail?: string;
  registeredAddressId?: string;
}

export interface BankAccountInput {
  iban: string;
  bankName: string;
  accountHolderName: string;
  proofDocumentId?: string;
}

export interface LicenseInput {
  licenseType: string;
  relatedActivity?: string;
  number: string;
  issuedAt?: string;
  expiresAt?: string;
  /** id of a file already uploaded via POST /files for this organization. */
  fileId: string;
}

@Injectable()
export class KybService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get ibanKey(): string {
    return this.config.getOrThrow<string>('IBAN_ENCRYPTION_KEY');
  }

  async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
    return membership;
  }

  // ---- Business profile --------------------------------------------------

  async getBusinessProfile(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const profile = await this.prisma.business_profiles.findUnique({
      where: { organization_id: orgId },
    });
    if (!profile) throw new AppError('NOT_FOUND', 'No business profile yet');
    return this.serializeBusinessProfile(profile);
  }

  async putBusinessProfile(orgId: string, userId: string, input: BusinessProfileInput) {
    await this.requireMembership(orgId, userId);
    const profile = await this.prisma.business_profiles.upsert({
      where: { organization_id: orgId },
      create: {
        organization_id: orgId,
        legal_name: input.legalName,
        trade_name: input.tradeName,
        cr_number: input.crNumber,
        cr_expiry: input.crExpiry ? new Date(input.crExpiry) : undefined,
        vat_number: input.vatNumber,
        contact_phone: input.contactPhone,
        contact_email: input.contactEmail,
        registered_address_id: input.registeredAddressId,
      },
      update: {
        legal_name: input.legalName,
        trade_name: input.tradeName,
        cr_number: input.crNumber,
        cr_expiry: input.crExpiry ? new Date(input.crExpiry) : undefined,
        vat_number: input.vatNumber,
        contact_phone: input.contactPhone,
        contact_email: input.contactEmail,
        registered_address_id: input.registeredAddressId,
        version: { increment: 1 },
      },
    });
    return this.serializeBusinessProfile(profile);
  }

  private serializeBusinessProfile(p: {
    organization_id: string;
    legal_name: string;
    trade_name: string | null;
    cr_number: string;
    cr_expiry: Date | null;
    vat_number: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    registered_address_id: string | null;
    verification_status: string;
  }) {
    return {
      organizationId: p.organization_id,
      legalName: p.legal_name,
      tradeName: p.trade_name,
      crNumber: p.cr_number,
      crExpiry: p.cr_expiry,
      vatNumber: p.vat_number,
      contactPhone: p.contact_phone,
      contactEmail: p.contact_email,
      registeredAddressId: p.registered_address_id,
      verificationStatus: p.verification_status,
    };
  }

  // ---- Addresses ----------------------------------------------------------

  async listAddresses(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const rows = await this.prisma.addresses.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((a) => this.serializeAddress(a));
  }

  async createAddress(orgId: string, userId: string, input: AddressInput) {
    await this.requireMembership(orgId, userId);
    const addr = await this.prisma.addresses.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        label: input.label,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        country_code: input.countryCode ?? 'SA',
        city_id: input.cityId,
        district: input.district,
        street: input.street,
        building_number: input.buildingNumber,
        postal_code: input.postalCode,
        additional_number: input.additionalNumber,
        short_address: input.shortAddress,
        address_line: input.addressLine,
        is_default: input.isDefault ?? false,
        is_registered: input.isRegistered ?? false,
      },
    });
    return this.serializeAddress(addr);
  }

  async updateAddress(orgId: string, addressId: string, userId: string, input: Partial<AddressInput>) {
    await this.requireMembership(orgId, userId);
    const existing = await this.prisma.addresses.findFirst({
      where: { id: addressId, organization_id: orgId, deleted_at: null },
    });
    if (!existing) throw new AppError('NOT_FOUND', 'Address not found');

    const addr = await this.prisma.addresses.update({
      where: { id: addressId },
      data: {
        label: input.label,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        country_code: input.countryCode,
        city_id: input.cityId,
        district: input.district,
        street: input.street,
        building_number: input.buildingNumber,
        postal_code: input.postalCode,
        additional_number: input.additionalNumber,
        short_address: input.shortAddress,
        address_line: input.addressLine,
        is_default: input.isDefault,
        is_registered: input.isRegistered,
      },
    });
    return this.serializeAddress(addr);
  }

  async deleteAddress(orgId: string, addressId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const existing = await this.prisma.addresses.findFirst({
      where: { id: addressId, organization_id: orgId, deleted_at: null },
    });
    if (!existing) throw new AppError('NOT_FOUND', 'Address not found');
    await this.prisma.addresses.update({ where: { id: addressId }, data: { deleted_at: new Date() } });
  }

  private serializeAddress(a: {
    id: string;
    label: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    country_code: string;
    city_id: string | null;
    district: string | null;
    street: string | null;
    building_number: string | null;
    postal_code: string | null;
    additional_number: string | null;
    short_address: string | null;
    address_line: string | null;
    is_default: boolean;
    is_registered: boolean;
  }) {
    return {
      id: a.id,
      label: a.label,
      contactName: a.contact_name,
      contactPhone: a.contact_phone,
      countryCode: a.country_code,
      cityId: a.city_id,
      district: a.district,
      street: a.street,
      buildingNumber: a.building_number,
      postalCode: a.postal_code,
      additionalNumber: a.additional_number,
      shortAddress: a.short_address,
      addressLine: a.address_line,
      isDefault: a.is_default,
      isRegistered: a.is_registered,
    };
  }

  // ---- Bank accounts --------------------------------------------------------

  async listBankAccounts(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const rows = await this.prisma.bank_accounts.findMany({
      where: { organization_id: orgId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((b) => ({
      id: b.id,
      bankName: b.bank_name,
      accountHolderName: b.account_holder_name,
      ibanLast4: b.iban_last4,
      status: b.status,
      isDefault: b.is_default,
      payoutHoldUntil: b.payout_hold_until,
    }));
  }

  async addBankAccount(orgId: string, userId: string, input: BankAccountInput) {
    await this.requireMembership(orgId, userId);

    const iban = input.iban.replace(/\s+/g, '').toUpperCase();
    if (!isValidSaudiIban(iban)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid Saudi IBAN', {
        details: [{ field: 'iban', code: 'invalid_iban' }],
      });
    }

    const existingCount = await this.prisma.bank_accounts.count({
      where: { organization_id: orgId, deleted_at: null },
    });

    const account = await this.prisma.bank_accounts.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        iban_enc: toBytes(encryptField(iban, this.ibanKey)),
        iban_last4: iban.slice(-4),
        iban_fingerprint: toBytes(fingerprint(iban)),
        bank_name: input.bankName,
        account_holder_name: input.accountHolderName,
        proof_document_id: input.proofDocumentId,
        status: 'PENDING',
        is_default: existingCount === 0,
        // A new IBAN holds payouts for 48h (anti-fraud) — backend/md/modules/02-organizations-kyb-terms.md.
        payout_hold_until: new Date(Date.now() + BANK_PAYOUT_HOLD_HOURS * 60 * 60 * 1000),
      },
    });

    return {
      id: account.id,
      bankName: account.bank_name,
      accountHolderName: account.account_holder_name,
      ibanLast4: account.iban_last4,
      status: account.status,
      isDefault: account.is_default,
      payoutHoldUntil: account.payout_hold_until,
    };
  }

  // ---- Licenses -------------------------------------------------------------

  async listLicenses(orgId: string, userId: string) {
    await this.requireMembership(orgId, userId);
    const rows = await this.prisma.licenses.findMany({
      where: { organization_id: orgId },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((l) => ({
      id: l.id,
      licenseType: l.license_type,
      relatedActivity: l.related_activity,
      number: l.number,
      issuedAt: l.issued_at,
      expiresAt: l.expires_at,
      status: l.status,
      documentId: l.document_id,
    }));
  }

  async addLicense(orgId: string, userId: string, input: LicenseInput) {
    await this.requireMembership(orgId, userId);

    const file = await this.prisma.files.findFirst({
      where: { id: input.fileId, organization_id: orgId, deleted_at: null },
    });
    if (!file) {
      throw new AppError('VALIDATION_FAILED', 'fileId must reference a file uploaded for this organization', {
        details: [{ field: 'fileId', code: 'not_found' }],
      });
    }

    // `licenses.document_id` points at the review/versioning entity
    // (files.documents + document_versions), not at `files` directly —
    // wrap the uploaded file in a single-version document so the normal
    // KYB review flow (document_reviews, re-upload = new version) applies
    // to license evidence the same way it will to everything else.
    const documentTypeCode = input.licenseType;
    const documentId = randomUUID();
    const versionId = randomUUID();
    // `ck_documents_has_version` requires current_version_id together with
    // any non-MISSING status, so the document starts MISSING/no-version,
    // then the version is attached and the status flips in the same
    // transaction — never a row with one but not the other.
    await this.prisma.$transaction([
      this.prisma.documents.create({
        data: {
          id: documentId,
          owner_type: 'ORGANIZATION',
          owner_id: orgId,
          document_type_code: documentTypeCode,
          status: 'MISSING',
          reviewer_scope: 'STAFF',
          visibility: 'STAFF_ONLY',
        },
      }),
      this.prisma.document_versions.create({
        data: {
          id: versionId,
          document_id: documentId,
          file_id: file.id,
          version_no: 1,
          uploaded_by_user_id: userId,
          uploaded_by_org_id: orgId,
        },
      }),
      this.prisma.documents.update({
        where: { id: documentId },
        data: { current_version_id: versionId, status: 'UNDER_REVIEW' },
      }),
    ]);

    const license = await this.prisma.licenses.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        license_type: input.licenseType as never,
        related_activity: input.relatedActivity as never,
        number: input.number,
        issued_at: input.issuedAt ? new Date(input.issuedAt) : undefined,
        expires_at: input.expiresAt ? new Date(input.expiresAt) : undefined,
        document_id: documentId,
        status: 'PENDING',
      },
    });

    return {
      id: license.id,
      licenseType: license.license_type,
      relatedActivity: license.related_activity,
      number: license.number,
      issuedAt: license.issued_at,
      expiresAt: license.expires_at,
      status: license.status,
      documentId: license.document_id,
    };
  }

  // ---- Verification case -----------------------------------------------------

  async getVerification(orgId: string, userId: string, workspace: 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER') {
    await this.requireMembership(orgId, userId);
    const kase = await this.prisma.verification_cases.findFirst({
      where: { organization_id: orgId, workspace },
      orderBy: { created_at: 'desc' },
      include: { verification_items: true },
    });
    if (!kase) return { status: 'DRAFT', items: [] };

    return {
      id: kase.id,
      status: kase.status,
      submittedAt: kase.submitted_at,
      decidedAt: kase.decided_at,
      decisionReason: kase.decision_reason,
      items: kase.verification_items.map((i) => ({
        id: i.id,
        type: i.item_type,
        refId: i.ref_id,
        status: i.status,
        reasonNote: i.reason_note,
      })),
    };
  }

  /** Minimal completeness check: a business profile, at least one license,
   * and at least one bank account must exist. The full per-activity
   * document-requirements matrix (ref.document_requirements) isn't seeded
   * yet — see S0 gaps — so this is intentionally conservative rather than
   * silently approving an incomplete submission. */
  async submitVerification(
    orgId: string,
    userId: string,
    workspace: 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER',
  ) {
    await this.requireMembership(orgId, userId);

    const [profile, licenses, bankAccounts] = await Promise.all([
      this.prisma.business_profiles.findUnique({ where: { organization_id: orgId } }),
      this.prisma.licenses.findMany({ where: { organization_id: orgId } }),
      this.prisma.bank_accounts.findMany({ where: { organization_id: orgId, deleted_at: null } }),
    ]);

    const missing: string[] = [];
    if (!profile) missing.push('business_profile');
    if (licenses.length === 0) missing.push('license');
    if (bankAccounts.length === 0) missing.push('bank_account');
    if (missing.length) {
      throw new AppError('BUSINESS_RULE_VIOLATION', `Verification incomplete: missing ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }

    const existing = await this.prisma.verification_cases.findFirst({
      where: { organization_id: orgId, workspace, status: { in: ['DRAFT', 'CHANGES_REQUESTED'] } },
      orderBy: { created_at: 'desc' },
    });

    const caseId = existing?.id ?? randomUUID();
    const kase = await this.prisma.verification_cases.upsert({
      where: { id: caseId },
      create: {
        id: caseId,
        organization_id: orgId,
        workspace,
        status: 'SUBMITTED',
        submitted_at: new Date(),
      },
      update: {
        status: 'SUBMITTED',
        submitted_at: new Date(),
        resubmission_count: { increment: existing ? 1 : 0 },
      },
    });

    await this.prisma.verification_items.upsert({
      where: { case_id_item_type_ref_id: { case_id: kase.id, item_type: 'BUSINESS_PROFILE', ref_id: orgId } },
      create: { id: randomUUID(), case_id: kase.id, item_type: 'BUSINESS_PROFILE', ref_id: orgId },
      update: { status: 'PENDING' },
    });
    for (const l of licenses) {
      await this.prisma.verification_items.upsert({
        where: { case_id_item_type_ref_id: { case_id: kase.id, item_type: 'LICENSE', ref_id: l.id } },
        create: { id: randomUUID(), case_id: kase.id, item_type: 'LICENSE', ref_id: l.id },
        update: { status: 'PENDING' },
      });
    }
    for (const b of bankAccounts) {
      await this.prisma.verification_items.upsert({
        where: { case_id_item_type_ref_id: { case_id: kase.id, item_type: 'BANK_ACCOUNT', ref_id: b.id } },
        create: { id: randomUUID(), case_id: kase.id, item_type: 'BANK_ACCOUNT', ref_id: b.id },
        update: { status: 'PENDING' },
      });
    }

    return { id: kase.id, status: kase.status, submittedAt: kase.submitted_at };
  }
}
