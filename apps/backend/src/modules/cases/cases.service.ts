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

  private async requireMember(userId: string, organizationId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: organizationId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  /** The cases an organization opened, newest first. */
  async list(userId: string, organizationId: string) {
    await this.requireMember(userId, organizationId);
    const rows = await this.prisma.cases.findMany({
      where: { opened_by_org_id: organizationId },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: { id: true, reference: true, case_type: true, status: true, subject_reference: true, created_at: true },
    });
    return rows.map((c) => ({
      id: c.id,
      reference: c.reference,
      caseType: c.case_type,
      status: c.status,
      orderReference: c.subject_reference,
      createdAt: c.created_at,
    }));
  }

  /**
   * One case, by id or by reference (CASE-260001). Only the organization that opened it sees it: someone
   * else's case is a 403, a case that does not exist is a 404.
   *
   * The timeline holds what the customer may know and only what was recorded: it is built from the dates
   * on the case (opened, first answer, resolved, closed). Staff's internal notes (ops.case_internal_notes)
   * are never read here, and there is no history of intermediate status changes to show.
   */
  async get(userId: string, idOrReference: string) {
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrReference);
    const c = await this.prisma.cases.findFirst({
      where: isId ? { id: idOrReference } : { reference: idOrReference },
    });
    if (!c) throw new AppError('NOT_FOUND', 'Case not found');
    if (!c.opened_by_org_id) throw new AppError('FORBIDDEN', 'This case belongs to another organization');
    await this.requireMember(userId, c.opened_by_org_id).catch(() => {
      throw new AppError('FORBIDDEN', 'This case belongs to another organization');
    });

    const events: { type: string; at: Date; note: string | null }[] = [{ type: 'OPENED', at: c.created_at, note: c.description }];
    if (c.first_responded_at) events.push({ type: 'FIRST_RESPONSE', at: c.first_responded_at, note: null });
    if (c.resolved_at) events.push({ type: 'RESOLVED', at: c.resolved_at, note: c.resolution_note });
    if (c.closed_at) events.push({ type: 'CLOSED', at: c.closed_at, note: null });
    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    return {
      id: c.id,
      reference: c.reference,
      caseType: c.case_type,
      status: c.status,
      orderReference: c.subject_reference,
      description: c.description,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      events,
    };
  }
}
