import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface RecordConsentInput {
  userId: string;
  organizationId: string;
  workspace: 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER';
  consentKey: string;
  termsDocumentId?: string;
  contextType?: string;
  contextId?: string;
  contextReference?: string;
  ip?: string;
  deviceId?: string;
  userAgent?: string;
}

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `audience` + `locale` — falls back to the audience's current doc in
   * `ar` if the requested locale has no published version yet. */
  async current(audience: string, locale: 'ar' | 'en') {
    const doc =
      (await this.prisma.terms_documents.findFirst({
        where: { audience: audience as never, locale, is_current: true, status: 'PUBLISHED' },
      })) ??
      (await this.prisma.terms_documents.findFirst({
        where: { audience: audience as never, is_current: true, status: 'PUBLISHED' },
      }));

    if (!doc) throw new AppError('NOT_FOUND', `No published terms for audience ${audience}`);

    return {
      id: doc.id,
      audience: doc.audience,
      version: doc.version,
      locale: doc.locale,
      title: doc.title,
      bodyMarkdown: doc.body_markdown,
      summaryItems: doc.summary_items,
      publishedAt: doc.published_at,
    };
  }

  async recordConsent(input: RecordConsentInput) {
    // Idempotent per (user, consentKey, context) — never updates an existing
    // row (backend/md/modules/02-organizations-kyb-terms.md "Terms and consent").
    const existing = await this.prisma.consents.findFirst({
      where: {
        user_id: input.userId,
        consent_key: input.consentKey as never,
        context_type: input.contextType ?? null,
        context_id: input.contextId ?? null,
      },
    });
    if (existing) return { id: existing.id, acceptedAt: existing.accepted_at };

    let termsVersion: string | undefined;
    if (input.termsDocumentId) {
      const doc = await this.prisma.terms_documents.findUnique({
        where: { id: input.termsDocumentId },
      });
      if (!doc) throw new AppError('NOT_FOUND', 'Unknown terms document');
      termsVersion = doc.version;
    }

    const consent = await this.prisma.consents.create({
      data: {
        id: randomUUID(),
        user_id: input.userId,
        organization_id: input.organizationId,
        workspace: input.workspace,
        consent_key: input.consentKey as never,
        terms_document_id: input.termsDocumentId,
        terms_version: termsVersion,
        context_type: input.contextType,
        context_id: input.contextId,
        context_reference: input.contextReference,
        ip: input.ip,
        device_id: input.deviceId,
        user_agent: input.userAgent,
      },
    });

    return { id: consent.id, acceptedAt: consent.accepted_at };
  }
}
