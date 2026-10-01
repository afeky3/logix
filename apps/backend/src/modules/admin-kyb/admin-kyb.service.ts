import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/**
 * Admin stopgap (backend/md/modules/02-organizations-kyb-terms.md "KYB
 * review (dashboard)") — enough for a staff user to review and decide a
 * verification case from Swagger/the dashboard. No per-staff case
 * assignment or RBAC scoping yet (any authenticated staff can review any
 * case); that can tighten later without changing these shapes.
 */
@Injectable()
export class AdminKybService {
  constructor(private readonly prisma: PrismaService) {}

  async listCases(status?: string) {
    const rows = await this.prisma.verification_cases.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { submitted_at: 'asc' },
      include: { organizations: { select: { display_name: true, kind: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      organizationId: c.organization_id,
      organizationName: c.organizations.display_name,
      organizationKind: c.organizations.kind,
      workspace: c.workspace,
      status: c.status,
      submittedAt: c.submitted_at,
      resubmissionCount: c.resubmission_count,
    }));
  }

  async getOrganization(orgId: string) {
    const org = await this.prisma.organizations.findUnique({ where: { id: orgId } });
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');

    const [profile, addresses, licenses, bankAccounts, workspaces, files, cases] = await Promise.all([
      this.prisma.business_profiles.findUnique({ where: { organization_id: orgId } }),
      this.prisma.addresses.findMany({ where: { organization_id: orgId, deleted_at: null } }),
      this.prisma.licenses.findMany({ where: { organization_id: orgId } }),
      this.prisma.bank_accounts.findMany({ where: { organization_id: orgId, deleted_at: null } }),
      this.prisma.org_workspaces.findMany({ where: { organization_id: orgId } }),
      this.prisma.files.findMany({
        where: { organization_id: orgId, deleted_at: null },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.verification_cases.findMany({
        where: { organization_id: orgId },
        orderBy: { created_at: 'desc' },
        include: { verification_items: true },
      }),
    ]);

    return {
      id: org.id,
      kind: org.kind,
      displayName: org.display_name,
      status: org.status,
      businessProfile: profile
        ? {
            legalName: profile.legal_name,
            tradeName: profile.trade_name,
            crNumber: profile.cr_number,
            crExpiry: profile.cr_expiry,
            vatNumber: profile.vat_number,
            verificationStatus: profile.verification_status,
          }
        : null,
      addresses: addresses.map((a) => ({
        id: a.id,
        district: a.district,
        street: a.street,
        buildingNumber: a.building_number,
        isRegistered: a.is_registered,
      })),
      licenses: licenses.map((l) => ({
        id: l.id,
        licenseType: l.license_type,
        number: l.number,
        status: l.status,
        documentId: l.document_id,
        expiresAt: l.expires_at,
      })),
      bankAccounts: bankAccounts.map((b) => ({
        id: b.id,
        bankName: b.bank_name,
        accountHolderName: b.account_holder_name,
        ibanLast4: b.iban_last4,
        status: b.status,
        payoutHoldUntil: b.payout_hold_until,
      })),
      workspaces: workspaces.map((w) => ({ workspace: w.workspace, status: w.status })),
      files: files.map((f) => ({
        id: f.id,
        purpose: f.purpose,
        mimeType: f.mime_type,
        originalName: f.original_name,
        scanStatus: f.scan_status,
        createdAt: f.created_at,
      })),
      verificationCases: cases.map((c) => ({
        id: c.id,
        workspace: c.workspace,
        status: c.status,
        submittedAt: c.submitted_at,
        decidedAt: c.decided_at,
        items: c.verification_items.map((i) => ({
          id: i.id,
          type: i.item_type,
          refId: i.ref_id,
          status: i.status,
          reasonNote: i.reason_note,
        })),
      })),
    };
  }

  async decideItem(
    staffId: string,
    caseId: string,
    itemId: string,
    status: 'ACCEPTED' | 'CHANGES_REQUESTED' | 'REJECTED',
    reasonNote?: string,
  ) {
    const item = await this.prisma.verification_items.findFirst({
      where: { id: itemId, case_id: caseId },
    });
    if (!item) throw new AppError('NOT_FOUND', 'Verification item not found');

    const updated = await this.prisma.verification_items.update({
      where: { id: itemId },
      data: { status, reason_note: reasonNote, decided_by_staff_id: staffId, decided_at: new Date() },
    });

    // Reflect the per-item decision onto the underlying record so the user
    // sees it on their own license/bank-account list, not just the case.
    if (item.item_type === 'LICENSE') {
      await this.prisma.licenses.update({
        where: { id: item.ref_id },
        data: {
          status: status === 'ACCEPTED' ? 'VALID' : status === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED',
        },
      });
    } else if (item.item_type === 'BANK_ACCOUNT') {
      await this.prisma.bank_accounts.update({
        where: { id: item.ref_id },
        data: {
          status: status === 'ACCEPTED' ? 'VERIFIED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING',
          verified_at: status === 'ACCEPTED' ? new Date() : undefined,
        },
      });
    } else if (item.item_type === 'BUSINESS_PROFILE') {
      await this.prisma.business_profiles.update({
        where: { organization_id: item.ref_id },
        data: {
          verification_status:
            status === 'ACCEPTED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'CHANGES_REQUESTED',
        },
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      reasonNote: updated.reason_note,
      decidedAt: updated.decided_at,
    };
  }

  /** Final case decision. APPROVED activates the workspace — "Approval
   * activates the workspace and the approved activities" (same doc,
   * "KYB review (dashboard)"). */
  async decideCase(
    staffId: string,
    caseId: string,
    decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
    reason?: string,
  ) {
    const kase = await this.prisma.verification_cases.findUnique({ where: { id: caseId } });
    if (!kase) throw new AppError('NOT_FOUND', 'Verification case not found');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(kase.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', `Cannot decide a case in status ${kase.status}`);
    }

    const updated = await this.prisma.verification_cases.update({
      where: { id: caseId },
      data: {
        status: decision,
        decided_at: new Date(),
        reviewer_staff_id: staffId,
        decision_reason: reason,
      },
    });

    if (decision === 'APPROVED') {
      await this.prisma.org_workspaces.updateMany({
        where: { organization_id: kase.organization_id, workspace: kase.workspace },
        data: { status: 'ACTIVE', activated_at: new Date() },
      });
      await this.prisma.provider_activities.updateMany({
        where: { organization_id: kase.organization_id, status: 'PENDING' },
        data: { status: 'APPROVED', approved_at: new Date() },
      });
    }

    return { id: updated.id, status: updated.status, decidedAt: updated.decided_at };
  }
}
