import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AdminMarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { q?: string; status?: string; limit: number; offset: number }) {
    const q = opts.q?.trim();
    const where = {
      deleted_at: null,
      ...(opts.status ? { status: opts.status as any } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { organizations: { display_name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        include: {
          organizations: { select: { id: true, display_name: true } },
          product_categories: { select: { slug: true, name_ar: true, name_en: true } },
        },
      }),
      this.prisma.products.count({ where }),
    ]);

    return {
      total,
      items: rows.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        condition: p.condition,
        unitPriceHalalas: Number(p.unit_price),
        moq: p.moq,
        stockQty: p.stock_qty,
        leadTimeDays: p.lead_time_days,
        supplierOrgId: p.organizations.id,
        supplierName: p.organizations.display_name,
        categorySlug: p.product_categories.slug,
        categoryNameAr: p.product_categories.name_ar,
        categoryNameEn: p.product_categories.name_en,
        createdAt: p.created_at,
      })),
    };
  }
}
