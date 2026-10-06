import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Documents a customs request needs, by movement (client round 1, item 3). */
export const CUSTOMS_REQUIRED_DOCS = {
  IMPORT: ['CERTIFICATE_OF_ORIGIN', 'BILL_OF_LADING', 'COMMERCIAL_INVOICE'],
  EXPORT: ['ORIGIN_INVOICE', 'PACKING_LIST'],
  TRANSIT: [],
} as const;

export type CustomsMovement = keyof typeof CUSTOMS_REQUIRED_DOCS;
export type CustomsDocType = (typeof CUSTOMS_REQUIRED_DOCS)[CustomsMovement][number];

@Injectable()
export class CustomsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  private async getCustomsRequest(requestId: string, userId: string) {
    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request || request.service_type !== 'CUSTOMS') {
      throw new AppError('NOT_FOUND', 'Customs request not found');
    }
    await this.requireMembership(request.customer_org_id, userId);
    return request;
  }

  /** Movement, BL and goods details for a customs draft. */
  async saveDetails(
    requestId: string,
    userId: string,
    input: { movement: CustomsMovement; billOfLadingNo?: string; hsCode?: string; goodsDescription?: string },
  ) {
    const request = await this.getCustomsRequest(requestId, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }
    const data = {
      movement: input.movement,
      bill_of_lading_no: input.billOfLadingNo,
      hs_code: input.hsCode,
      goods_description: input.goodsDescription,
    };
    await this.prisma.customs_request_details.upsert({
      where: { request_id: requestId },
      create: { request_id: requestId, ...data },
      update: data,
    });
    return this.status(requestId, userId);
  }

  /** Required documents for the request's movement, with what is already attached. */
  async status(requestId: string, userId: string) {
    await this.getCustomsRequest(requestId, userId);
    const details = await this.prisma.customs_request_details.findUnique({ where: { request_id: requestId } });
    const movement = (details?.movement ?? null) as CustomsMovement | null;
    const required = movement ? [...CUSTOMS_REQUIRED_DOCS[movement]] : [];

    const uploaded = await this.prisma.$queryRaw<{ doc_type: string; file_id: string; original_name: string | null }[]>`
      SELECT cd.doc_type, cd.file_id::text AS file_id, f.original_name
      FROM svc.customs_documents cd
      JOIN files.files f ON f.id = cd.file_id
      WHERE cd.request_id = ${requestId}::uuid
    `;
    const byType = new Map(uploaded.map((u) => [u.doc_type, u]));

    return {
      movement,
      documents: required.map((type) => {
        const u = byType.get(type);
        return { type, status: u ? 'UPLOADED' : 'MISSING', fileId: u?.file_id ?? null, fileName: u?.original_name ?? null };
      }),
      complete: required.every((t) => byType.has(t)),
    };
  }

  /** Attaches an uploaded SHIPMENT_DOCUMENT file to one required document slot. */
  async attachDocument(requestId: string, userId: string, docType: string, fileId: string) {
    const request = await this.getCustomsRequest(requestId, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }
    const details = await this.prisma.customs_request_details.findUnique({ where: { request_id: requestId } });
    const movement = details?.movement as CustomsMovement | undefined;
    if (!movement || !(CUSTOMS_REQUIRED_DOCS[movement] as readonly string[]).includes(docType)) {
      throw new AppError('VALIDATION_FAILED', `${docType} is not a required document for this movement`, {
        details: [{ field: 'docType', code: 'invalid' }],
      });
    }

    const file = await this.prisma.files.findFirst({
      where: { id: fileId, organization_id: request.customer_org_id, purpose: 'SHIPMENT_DOCUMENT' as never, deleted_at: null },
    });
    if (!file) {
      throw new AppError('VALIDATION_FAILED', 'fileId must be a shipment document uploaded for this organization', {
        details: [{ field: 'fileId', code: 'not_found' }],
      });
    }

    await this.prisma.$executeRaw`
      INSERT INTO svc.customs_documents (request_id, doc_type, file_id)
      VALUES (${requestId}::uuid, ${docType}, ${fileId}::uuid)
      ON CONFLICT (request_id, doc_type) DO UPDATE SET file_id = EXCLUDED.file_id, uploaded_at = now()
    `;
    return this.status(requestId, userId);
  }

  /** Used by submit: a customs request can only go out with every required document attached. */
  async assertReadyToSubmit(requestId: string) {
    const details = await this.prisma.customs_request_details.findUnique({ where: { request_id: requestId } });
    const missing: string[] = [];
    if (!details?.movement) missing.push('movement');
    if (details?.movement) {
      const rows = await this.prisma.$queryRaw<{ doc_type: string }[]>`
        SELECT doc_type FROM svc.customs_documents WHERE request_id = ${requestId}::uuid
      `;
      const have = new Set(rows.map((r) => r.doc_type));
      for (const t of CUSTOMS_REQUIRED_DOCS[details.movement as CustomsMovement]) {
        if (!have.has(t)) missing.push(t);
      }
    }
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', `Missing required fields: ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }
  }
}
