import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface AcceptanceFilter {
  userId?: string;
  organizationId?: string;
  context?: 'REGISTRATION' | 'APP_LAUNCH' | 'ORDER';
  quoteId?: string;
  productId?: string;
  from?: string; // YYYY-MM-DD, Riyadh day
  to?: string;
  q?: string; // phone, user name or organization name
  page: number;
  pageSize: number;
}

type Row = {
  id: string;
  accepted_at: Date;
  context: string;
  items: string[];
  terms_version: string;
  locale: string;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  quote_id: string | null;
  quote_reference: string | null;
  product_id: string | null;
  product_name: string | null;
  supplier_org_id: string | null;
  supplier_name: string | null;
  return_policy_version: string | null;
  identity_number: string | null;
  identity_type: string | null;
  ip: string | null;
  user_agent: string | null;
  app_version: string | null;
};

const serialize = (r: Row) => ({
  id: r.id,
  acceptedAt: r.accepted_at,
  context: r.context,
  items: r.items,
  termsVersion: r.terms_version,
  locale: r.locale,
  user: { id: r.user_id, name: r.user_name, phone: r.user_phone },
  organization: r.organization_id ? { id: r.organization_id, name: r.organization_name } : null,
  quote: r.quote_id ? { id: r.quote_id, requestReference: r.quote_reference } : null,
  product: r.product_id ? { id: r.product_id, name: r.product_name } : null,
  supplier: r.supplier_org_id ? { id: r.supplier_org_id, name: r.supplier_name } : null,
  returnPolicyVersion: r.return_policy_version,
  identityNumber: r.identity_number,
  identityType: r.identity_type,
  ip: r.ip,
  userAgent: r.user_agent,
  appVersion: r.app_version,
});

/** Consent log for the dashboard (read-only: the table is append-only). */
@Injectable()
export class AdminLegalService {
  constructor(private readonly prisma: PrismaService) {}

  private where(f: Omit<AcceptanceFilter, 'page' | 'pageSize'>): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (f.userId) parts.push(Prisma.sql`la.user_id = ${f.userId}::uuid`);
    if (f.organizationId) {
      parts.push(Prisma.sql`(la.organization_id = ${f.organizationId}::uuid OR la.supplier_org_id = ${f.organizationId}::uuid)`);
    }
    if (f.context) parts.push(Prisma.sql`la.context = ${f.context}`);
    if (f.quoteId) parts.push(Prisma.sql`la.quote_id = ${f.quoteId}::uuid`);
    if (f.productId) parts.push(Prisma.sql`la.product_id = ${f.productId}::uuid`);
    if (f.from) parts.push(Prisma.sql`la.accepted_at >= (${f.from}::date::timestamp AT TIME ZONE 'Asia/Riyadh')`);
    if (f.to) parts.push(Prisma.sql`la.accepted_at < ((${f.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Riyadh')`);
    if (f.q) {
      const like = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
      parts.push(Prisma.sql`(u.phone_e164 ILIKE ${like} OR u.full_name ILIKE ${like} OR o.display_name ILIKE ${like}
        OR sr.reference ILIKE ${like} OR la.identity_number ILIKE ${like})`);
    }
    return Prisma.join(parts, ' AND ');
  }

  private select(where: Prisma.Sql, tail: Prisma.Sql) {
    return this.prisma.$queryRaw<Row[]>`
      SELECT la.id, la.accepted_at, la.context, la.items, la.terms_version, la.locale,
             la.user_id, u.full_name AS user_name, u.phone_e164 AS user_phone,
             la.organization_id, o.display_name AS organization_name,
             la.quote_id, sr.reference AS quote_reference,
             la.product_id, p.name AS product_name,
             la.supplier_org_id, s.display_name AS supplier_name,
             la.return_policy_version, la.identity_number, la.identity_type,
             la.ip, la.user_agent, la.app_version
      FROM org.legal_acceptances la
      JOIN identity.users u ON u.id = la.user_id
      LEFT JOIN org.organizations o ON o.id = la.organization_id
      LEFT JOIN svc.quotes q ON q.id = la.quote_id
      LEFT JOIN svc.service_requests sr ON sr.id = q.request_id
      LEFT JOIN mkt.products p ON p.id = la.product_id
      LEFT JOIN org.organizations s ON s.id = la.supplier_org_id
      WHERE ${where}
      ORDER BY la.accepted_at DESC, la.id
      ${tail}`;
  }

  async list(f: AcceptanceFilter) {
    const where = this.where(f);
    const [rows, total] = await Promise.all([
      this.select(where, Prisma.sql`LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`),
      this.prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*) AS n FROM org.legal_acceptances la
        JOIN identity.users u ON u.id = la.user_id
        LEFT JOIN org.organizations o ON o.id = la.organization_id
        LEFT JOIN svc.quotes q ON q.id = la.quote_id
        LEFT JOIN svc.service_requests sr ON sr.id = q.request_id
        WHERE ${where}`,
    ]);
    return { items: rows.map(serialize), total: Number(total[0]?.n ?? 0), page: f.page, pageSize: f.pageSize };
  }

  async get(id: string) {
    const rows = await this.select(Prisma.sql`la.id = ${id}::uuid`, Prisma.empty);
    if (!rows[0]) throw new AppError('NOT_FOUND', 'Acceptance not found');
    const r = serialize(rows[0]);
    let returnPolicy = null;
    const full = await this.prisma.legal_acceptances.findUnique({
      where: { id },
      select: { return_policy_version_id: true },
    });
    if (full?.return_policy_version_id) {
      const v = await this.prisma.return_policy_versions.findUnique({ where: { id: full.return_policy_version_id } });
      if (v) {
        returnPolicy = {
          version: String(v.version),
          text: v.text,
          returnWindowDays: v.return_window_days,
          allowsReturn: v.allows_return,
          allowsExchange: v.allows_exchange,
          updatedAt: v.created_at,
        };
      }
    }
    return { ...r, returnPolicy };
  }

  /** Every matching row (capped) as CSV, UTF-8 with BOM so Excel shows Arabic. */
  async exportCsv(f: Omit<AcceptanceFilter, 'page' | 'pageSize'>) {
    const rows = await this.select(this.where(f), Prisma.sql`LIMIT 50000`);
    const head = [
      'id', 'accepted_at_utc', 'context', 'items', 'terms_version', 'locale', 'user_id', 'user_name', 'user_phone',
      'organization_id', 'organization_name', 'identity_type', 'identity_number', 'quote_id', 'request_reference',
      'product_id', 'product_name', 'supplier_org_id', 'supplier_name', 'return_policy_version', 'ip', 'user_agent',
      'app_version',
    ];
    const cell = (v: unknown) => {
      if (v === null || v === undefined) return '';
      let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(' | ') : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no formula injection when opened in a spreadsheet
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [
        r.id, r.accepted_at, r.context, r.items, r.terms_version, r.locale, r.user_id, r.user_name, r.user_phone,
        r.organization_id, r.organization_name, r.identity_type, r.identity_number, r.quote_id, r.quote_reference,
        r.product_id, r.product_name, r.supplier_org_id, r.supplier_name, r.return_policy_version, r.ip,
        r.user_agent, r.app_version,
      ].map(cell).join(','),
    );
    return '﻿' + [head.join(','), ...lines].join('\r\n') + '\r\n';
  }
}
