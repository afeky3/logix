import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Documents a customs request asks for, by movement (client step 3). */
export const CUSTOMS_DOCS = {
  IMPORT: ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CERTIFICATE_OF_ORIGIN', 'SABER_CERTIFICATE', 'OTHER'],
  EXPORT: ['BOOKING_CONFIRMATION', 'COMMERCIAL_INVOICE', 'CERTIFICATE_OF_ORIGIN', 'OTHER'],
  TRANSIT: ['BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CERTIFICATE_OF_ORIGIN', 'SABER_CERTIFICATE', 'OTHER'],
} as const;

/**
 * Client step 3: every document is optional for now so the flow isn't
 * blocked; flip this to make the movement's documents (except OTHER and
 * SABER_CERTIFICATE, which only apply when needed) required on submit.
 */
export const CUSTOMS_DOCS_MANDATORY = false;
const NEVER_MANDATORY: readonly string[] = ['OTHER', 'SABER_CERTIFICATE'];

export const CUSTOMS_DOC_TYPES = [...new Set(Object.values(CUSTOMS_DOCS).flat())] as [CustomsDocType, ...CustomsDocType[]];

export type CustomsMovement = keyof typeof CUSTOMS_DOCS;
export type CustomsDocType = (typeof CUSTOMS_DOCS)[CustomsMovement][number];
export type CustomsPortType = 'SEA' | 'AIR' | 'LAND';

function isRequired(docType: string) {
  return CUSTOMS_DOCS_MANDATORY && !NEVER_MANDATORY.includes(docType);
}

@Injectable()
export class CustomsService {
  constructor(private readonly prisma: PrismaService) {}

  private async isMember(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    return membership?.status === 'ACTIVE';
  }

  private async requireMembership(orgId: string, userId: string) {
    if (!(await this.isMember(orgId, userId))) {
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

  /** Movement, port type, BL and goods details for a customs draft. */
  async saveDetails(
    requestId: string,
    userId: string,
    input: { movement: CustomsMovement; portType: CustomsPortType; billOfLadingNo?: string; hsCode?: string; goodsDescription?: string },
  ) {
    const request = await this.getCustomsRequest(requestId, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }
    const data = {
      movement: input.movement,
      checkpoint_type: input.portType,
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

  /** Documents for the request's movement, with what is already attached. */
  async status(requestId: string, userId: string) {
    await this.getCustomsRequest(requestId, userId);
    const details = await this.prisma.customs_request_details.findUnique({ where: { request_id: requestId } });
    const movement = (details?.movement ?? null) as CustomsMovement | null;
    const types = movement ? [...CUSTOMS_DOCS[movement]] : [];

    const uploaded = await this.prisma.$queryRaw<{ doc_type: string; file_id: string; original_name: string | null }[]>`
      SELECT cd.doc_type, cd.file_id::text AS file_id, f.original_name
      FROM svc.customs_documents cd
      JOIN files.files f ON f.id = cd.file_id
      WHERE cd.request_id = ${requestId}::uuid
    `;
    const byType = new Map(uploaded.map((u) => [u.doc_type, u]));

    return {
      movement,
      portType: details?.checkpoint_type ?? null,
      documents: types.map((type) => {
        const u = byType.get(type);
        return {
          type,
          required: isRequired(type),
          status: u ? 'UPLOADED' : 'MISSING',
          fileId: u?.file_id ?? null,
          fileName: u?.original_name ?? null,
        };
      }),
      complete: types.filter(isRequired).every((t) => byType.has(t)),
    };
  }

  /** The file must be a SHIPMENT_DOCUMENT uploaded for the customer's organization. */
  private async requireShipmentDocument(fileId: string, orgId: string) {
    const file = await this.prisma.files.findFirst({
      where: { id: fileId, organization_id: orgId, purpose: 'SHIPMENT_DOCUMENT' as never, deleted_at: null },
    });
    if (!file) {
      throw new AppError('VALIDATION_FAILED', 'fileId must be a shipment document uploaded for this organization', {
        details: [{ field: 'fileId', code: 'not_found' }],
      });
    }
  }

  /** Attaches an uploaded SHIPMENT_DOCUMENT file to one document slot. */
  async attachDocument(requestId: string, userId: string, docType: string, fileId: string) {
    const request = await this.getCustomsRequest(requestId, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }
    const details = await this.prisma.customs_request_details.findUnique({ where: { request_id: requestId } });
    const movement = details?.movement as CustomsMovement | undefined;
    if (!movement || !(CUSTOMS_DOCS[movement] as readonly string[]).includes(docType)) {
      throw new AppError('VALIDATION_FAILED', `${docType} is not a document for this movement`, {
        details: [{ field: 'docType', code: 'invalid' }],
      });
    }
    await this.requireShipmentDocument(fileId, request.customer_org_id);

    await this.prisma.$executeRaw`
      INSERT INTO svc.customs_documents (request_id, doc_type, file_id)
      VALUES (${requestId}::uuid, ${docType}, ${fileId}::uuid)
      ON CONFLICT (request_id, doc_type) DO UPDATE SET file_id = EXCLUDED.file_id, uploaded_at = now()
    `;
    return this.status(requestId, userId);
  }

  /**
   * Extra files the broker asks for. Readable by the customer and by the
   * provider holding a live order on the request; only the customer adds
   * or removes them, at any point before the request is cancelled.
   */
  async listAttachments(requestId: string, userId: string) {
    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request || request.service_type !== 'CUSTOMS') {
      throw new AppError('NOT_FOUND', 'Customs request not found');
    }
    if (!(await this.isMember(request.customer_org_id, userId))) {
      const order = await this.prisma.orders.findFirst({
        where: { request_id: requestId, status: { not: 'VOID' } },
        select: { provider_org_id: true },
      });
      if (!order || !(await this.isMember(order.provider_org_id, userId))) {
        throw new AppError('FORBIDDEN', 'Not a party to this request');
      }
    }
    const rows = await this.prisma.$queryRaw<
      { id: string; file_id: string; original_name: string | null; note: string | null; uploaded_at: Date }[]
    >`
      SELECT ca.id::text AS id, ca.file_id::text AS file_id, f.original_name, ca.note, ca.uploaded_at
      FROM svc.customs_attachments ca
      JOIN files.files f ON f.id = ca.file_id
      WHERE ca.request_id = ${requestId}::uuid
      ORDER BY ca.uploaded_at
    `;
    return rows.map((r) => ({ id: r.id, fileId: r.file_id, fileName: r.original_name, note: r.note, uploadedAt: r.uploaded_at }));
  }

  async addAttachment(requestId: string, userId: string, fileId: string, note?: string) {
    const request = await this.getCustomsRequest(requestId, userId);
    if (request.status === 'CANCELLED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'This request is cancelled');
    }
    await this.requireShipmentDocument(fileId, request.customer_org_id);
    await this.prisma.$executeRaw`
      INSERT INTO svc.customs_attachments (request_id, file_id, note, uploaded_by)
      VALUES (${requestId}::uuid, ${fileId}::uuid, ${note ?? null}, ${userId}::uuid)
    `;
    return this.listAttachments(requestId, userId);
  }

  async removeAttachment(requestId: string, userId: string, attachmentId: string) {
    const request = await this.getCustomsRequest(requestId, userId);
    if (request.status === 'CANCELLED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'This request is cancelled');
    }
    if (!z.string().uuid().safeParse(attachmentId).success) throw new AppError('NOT_FOUND', 'Attachment not found');
    const removed = await this.prisma.$executeRaw`
      DELETE FROM svc.customs_attachments WHERE id = ${attachmentId}::uuid AND request_id = ${requestId}::uuid
    `;
    if (!removed) throw new AppError('NOT_FOUND', 'Attachment not found');
    return this.listAttachments(requestId, userId);
  }

  /** Used by submit: movement and port type are required; documents only when CUSTOMS_DOCS_MANDATORY. */
  async assertReadyToSubmit(requestId: string) {
    const details = await this.prisma.customs_request_details.findUnique({ where: { request_id: requestId } });
    const missing: string[] = [];
    if (!details?.movement) missing.push('movement');
    if (!details?.checkpoint_type) missing.push('portType');
    if (details?.movement && CUSTOMS_DOCS_MANDATORY) {
      const rows = await this.prisma.$queryRaw<{ doc_type: string }[]>`
        SELECT doc_type FROM svc.customs_documents WHERE request_id = ${requestId}::uuid
      `;
      const have = new Set(rows.map((r) => r.doc_type));
      for (const t of CUSTOMS_DOCS[details.movement as CustomsMovement]) {
        if (isRequired(t) && !have.has(t)) missing.push(t);
      }
    }
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', `Missing required fields: ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }
  }
}
