import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

/** Public-ish product catalog for buyers (mirrors supplier-products, read side). */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { category?: string; q?: string; limit: number }) {
    const where = {
      status: 'PUBLISHED' as const,
      deleted_at: null,
      product_categories: opts.category ? { slug: opts.category } : undefined,
      name: opts.q ? { contains: opts.q, mode: 'insensitive' as const } : undefined,
    };
    const rows = await this.prisma.products.findMany({
      where,
      take: opts.limit,
      orderBy: { created_at: 'desc' },
      include: {
        organizations: { select: { display_name: true } },
        product_categories: { select: { slug: true, name_ar: true, name_en: true } },
      },
    });
    return rows.map((p) => this.summarize(p));
  }

  async get(id: string) {
    const p = await this.prisma.products.findUnique({
      where: { id },
      include: {
        organizations: { select: { id: true, display_name: true } },
        product_categories: { select: { slug: true, name_ar: true, name_en: true } },
        countries: { select: { name_ar: true, name_en: true } },
        units_of_measure: { select: { name_ar: true, name_en: true } },
        product_images: { select: { file_id: true, is_cover: true }, orderBy: { sort_order: 'asc' } },
      },
    });
    if (!p || p.status !== 'PUBLISHED' || p.deleted_at) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      supplierOrgId: p.organizations.id,
      supplierName: p.organizations.display_name,
      categorySlug: p.product_categories.slug,
      categoryNameAr: p.product_categories.name_ar,
      categoryNameEn: p.product_categories.name_en,
      unitPriceHalalas: Number(p.unit_price),
      vatTreatment: p.vat_treatment,
      unitNameAr: p.units_of_measure?.name_ar ?? null,
      unitNameEn: p.units_of_measure?.name_en ?? null,
      moq: p.moq,
      stockQty: p.stock_qty,
      leadTimeDays: p.lead_time_days,
      originCountryAr: p.countries?.name_ar ?? null,
      originCountryEn: p.countries?.name_en ?? null,
      specs: p.specs,
      imageFileIds: p.product_images.map((i) => i.file_id),
    };
  }

  private summarize(p: {
    id: string;
    name: string;
    unit_price: bigint;
    moq: number;
    stock_qty: number;
    organizations: { display_name: string };
    product_categories: { slug: string; name_ar: string; name_en: string };
  }) {
    return {
      id: p.id,
      name: p.name,
      supplierName: p.organizations.display_name,
      categorySlug: p.product_categories.slug,
      unitPriceHalalas: Number(p.unit_price),
      moq: p.moq,
      stockQty: p.stock_qty,
    };
  }
}
