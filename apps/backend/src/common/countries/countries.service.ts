import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../errors/app-error';

export interface CountryLabel {
  countryCode: string;
  countryNameAr: string | null;
  countryNameEn: string | null;
}

/**
 * The country on accounts, products and service requests (migration 029). Every list that scopes by
 * country resolves its filter here, so the rule is the same everywhere: an explicit `country` wins,
 * `ALL` turns the filter off, otherwise the active account's country applies.
 */
@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the normalized code, or throws VALIDATION_FAILED on `countryCode` for a country we don't list. */
  async assertValid(code: string): Promise<string> {
    const normalized = code.trim().toUpperCase();
    const row = await this.prisma.countries.findFirst({ where: { code: normalized, is_active: true }, select: { code: true } });
    if (!row) {
      throw new AppError('VALIDATION_FAILED', 'Unknown country', {
        details: [{ field: 'countryCode', code: 'unknown_country' }],
      });
    }
    return row.code;
  }

  /** Display names for a set of codes, keyed by code. A code with no row still gets an entry (names null). */
  async labels(codes: Iterable<string>): Promise<Map<string, CountryLabel>> {
    const unique = [...new Set([...codes].map((c) => c.trim()))];
    const rows = unique.length
      ? await this.prisma.countries.findMany({
          where: { code: { in: unique } },
          select: { code: true, name_ar: true, name_en: true },
        })
      : [];
    const byCode = new Map(rows.map((r) => [r.code, r]));
    return new Map(
      unique.map((code) => [
        code,
        { countryCode: code, countryNameAr: byCode.get(code)?.name_ar ?? null, countryNameEn: byCode.get(code)?.name_en ?? null },
      ]),
    );
  }

  async label(code: string): Promise<CountryLabel> {
    return (await this.labels([code])).get(code.trim())!;
  }

  async orgCountry(organizationId: string): Promise<string> {
    const org = await this.prisma.organizations.findUnique({ where: { id: organizationId }, select: { country_code: true } });
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');
    return org.country_code;
  }

  /**
   * The country a list should be restricted to, or null for no restriction.
   * Callers check the user's membership of `organizationId` before relying on it.
   */
  async resolveFilter(opts: { country?: string; organizationId?: string }): Promise<string | null> {
    if (opts.country) {
      const country = opts.country.trim().toUpperCase();
      if (country === 'ALL') return null;
      return this.assertValid(country);
    }
    if (opts.organizationId) return this.orgCountry(opts.organizationId);
    return null;
  }
}
