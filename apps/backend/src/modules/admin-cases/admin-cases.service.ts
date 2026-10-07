import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Staff review of buyer-reported issues (client round 1). */
@Injectable()
export class AdminCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(status?: string) {
    const rows = await this.prisma.cases.findMany({
      where: { status: status ? (status as never) : undefined },
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        organizations_cases_opened_by_org_idToorganizations: { select: { display_name: true } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      reference: c.reference,
      caseType: c.case_type,
      status: c.status,
      priority: c.priority,
      openedByOrgName: c.organizations_cases_opened_by_org_idToorganizations?.display_name ?? null,
      subjectReference: c.subject_reference,
      createdAt: c.created_at,
    }));
  }

  async get(id: string) {
    const c = await this.prisma.cases.findUnique({
      where: { id },
      include: {
        organizations_cases_opened_by_org_idToorganizations: { select: { display_name: true } },
        organizations_cases_counterparty_org_idToorganizations: { select: { display_name: true } },
      },
    });
    if (!c) throw new AppError('NOT_FOUND', 'Case not found');
    return {
      id: c.id,
      reference: c.reference,
      caseType: c.case_type,
      status: c.status,
      priority: c.priority,
      description: c.description,
      evidenceFileIds: c.evidence_file_ids,
      subjectType: c.subject_type,
      subjectId: c.subject_id,
      subjectReference: c.subject_reference,
      openedByOrgName: c.organizations_cases_opened_by_org_idToorganizations?.display_name ?? null,
      counterpartyOrgName: c.organizations_cases_counterparty_org_idToorganizations?.display_name ?? null,
      resolutionCode: c.resolution_code,
      resolutionNote: c.resolution_note,
      createdAt: c.created_at,
      resolvedAt: c.resolved_at,
      closedAt: c.closed_at,
    };
  }

  /** Any non-final status change, or the final resolution with its code/note. */
  async decide(
    id: string,
    staffId: string,
    status: 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED',
    resolutionCode?: string,
    resolutionNote?: string,
  ) {
    const existing = await this.prisma.cases.findUnique({ where: { id } });
    if (!existing) throw new AppError('NOT_FOUND', 'Case not found');
    if (existing.status === 'CLOSED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Case is already closed');
    }
    if (status === 'RESOLVED' && !resolutionCode) {
      throw new AppError('VALIDATION_FAILED', 'resolutionCode is required to resolve a case', {
        details: [{ field: 'resolutionCode', code: 'required' }],
      });
    }

    const now = new Date();
    await this.prisma.cases.update({
      where: { id },
      data: {
        status,
        assignee_staff_id: existing.assignee_staff_id ?? staffId,
        first_responded_at: existing.first_responded_at ?? now,
        resolution_code: status === 'RESOLVED' ? (resolutionCode as never) : undefined,
        resolution_note: resolutionNote ?? undefined,
        resolved_at: status === 'RESOLVED' ? now : undefined,
        closed_at: status === 'CLOSED' ? now : undefined,
      },
    });
    return this.get(id);
  }
}
