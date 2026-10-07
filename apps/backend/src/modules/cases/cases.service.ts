import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ReferenceGenerator } from '../../common/references/reference-generator';

export interface OpenCaseInput {
  caseType: 'DAMAGE_SHORTAGE' | 'GENERAL_SUPPORT';
  orderReference?: string;
  description?: string;
  fileIds?: string[];
}

/**
 * Buyer-reported issues (client round 1, item 2's claims list), on the
 * ops.cases table that already existed for this. A buyer always opens it
 * against their own org as CUSTOMER; staff take it from there.
 */
@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: ReferenceGenerator,
  ) {}

  async open(userId: string, organizationId: string, input: OpenCaseInput) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }

    // Best-effort: a typo'd order reference still opens the case, just
    // without the order linked — staff can fix the link by hand.
    let subjectId: string | null = null;
    let counterpartyOrgId: string | null = null;
    if (input.orderReference) {
      const order = await this.prisma.orders.findFirst({
        where: { reference: input.orderReference, customer_org_id: organizationId },
      });
      if (order) {
        subjectId = order.id;
        counterpartyOrgId = order.provider_org_id;
      }
    }

    const reference = await this.refs.next('CASE');
    const kase = await this.prisma.cases.create({
      data: {
        id: randomUUID(),
        reference,
        case_type: input.caseType,
        subject_type: subjectId ? 'ORDER' : 'NONE',
        subject_id: subjectId,
        subject_reference: input.orderReference,
        description: input.description,
        evidence_file_ids: input.fileIds ?? [],
        opened_by_user_id: userId,
        opened_by_org_id: organizationId,
        opened_by_workspace: 'CUSTOMER',
        counterparty_org_id: counterpartyOrgId,
        status: 'OPEN',
        priority: 'NORMAL',
      },
    });
    return { id: kase.id, reference: kase.reference, status: kase.status };
  }
}
