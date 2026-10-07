import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface CreateProductInput {
  name: string;
  description?: string;
  categorySlug: 'packaging' | 'equipment' | 'building-materials' | 'other';
  categoryOther?: string;
  specsText?: string;
  originText?: string;
  packagingText?: string;
  imageFileId?: string;
}

export interface PublishProductInput {
  unitPriceHalalas: number;
  vatTreatment: 'INCLUSIVE' | 'EXCLUSIVE';
  unitText?: string;
  stockQty: number;
  moq?: number;
  leadTimeDays: number;
}

/** Supplier product catalog, on mkt.products (which already existed for this). */
@Injectable()
export class SupplierProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  /** The app's origin/unit fields are free text, not pickers — best match
   * against the seeded list, falling back to a safe default. */
  private async matchCountryCode(text?: string): Promise<string> {
    if (text) {
      const rows = await this.prisma.countries.findMany({ select: { code: true, name_ar: true, name_en: true } });
      const needle = text.trim().toLowerCase();
      const hit = rows.find(
        (c) => c.name_ar.includes(text.trim()) || c.name_en.toLowerCase().includes(needle),
      );
      if (hit) return hit.code;
    }
    return 'SA';
  }

  private async matchUnitCode(text?: string): Promise<string> {
    if (text) {
      const rows = await this.prisma.units_of_measure.findMany({ select: { code: true, name_ar: true, name_en: true } });
      const needle = text.trim().toLowerCase();
      const hit = rows.find(
        (u) => u.name_ar.includes(text.trim()) || u.name_en.toLowerCase().includes(needle),
      );
      if (hit) return hit.code;
    }
    return 'OTHER';
  }

  async create(orgId: string, userId: string, input: CreateProductInput) {
    await this.requireMembership(orgId, userId);

    const category = await this.prisma.product_categories.findUnique({ where: { slug: input.categorySlug } });
    if (!category) throw new AppError('NOT_FOUND', `Unknown category: ${input.categorySlug}`);

    const originCountryCode = await this.matchCountryCode(input.originText);
    const specs: { key: string; value: string }[] = [];
    if (input.specsText) specs.push({ key: 'specs', value: input.specsText });
    if (input.categorySlug === 'other' && input.categoryOther) specs.push({ key: 'categoryOther', value: input.categoryOther });
    if (input.packagingText) specs.push({ key: 'packaging', value: input.packagingText });

    const productId = randomUUID();
    await this.prisma.products.create({
      data: {
        id: productId,
        supplier_org_id: orgId,
        category_id: category.id,
        name: input.name,
        description: input.description,
        specs,
        origin_country_code: originCountryCode,
        unit_code: 'OTHER',
        lead_time_days: 1,
        unit_price: 0n,
        status: 'DRAFT',
        supply_notes: input.originText && originCountryCode === 'SA' && !input.originText.includes('سعود')
          ? `Origin as entered: ${input.originText}`
          : undefined,
      },
    });

    if (input.imageFileId) {
      const file = await this.prisma.files.findFirst({
        where: { id: input.imageFileId, organization_id: orgId, purpose: 'PRODUCT_IMAGE' as never },
      });
      if (file) {
        await this.prisma.product_images.create({
          data: { id: randomUUID(), product_id: productId, file_id: file.id, is_cover: true },
        });
      }
    }

    return { id: productId, status: 'DRAFT' };
  }

  async publish(orgId: string, userId: string, productId: string, input: PublishProductInput) {
    await this.requireMembership(orgId, userId);
    const product = await this.prisma.products.findUnique({ where: { id: productId } });
    if (!product || product.supplier_org_id !== orgId) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }

    const unitCode = await this.matchUnitCode(input.unitText);
    const now = new Date();
    const updated = await this.prisma.products.update({
      where: { id: productId },
      data: {
        unit_price: BigInt(Math.round(input.unitPriceHalalas)),
        vat_treatment: input.vatTreatment,
        unit_code: unitCode,
        stock_qty: input.stockQty,
        moq: input.moq ?? 1,
        lead_time_days: input.leadTimeDays,
        status: 'PUBLISHED',
        published_at: now,
      },
    });
    return { id: updated.id, status: updated.status };
  }

  async list(orgId: string, userId: string, status?: string) {
    await this.requireMembership(orgId, userId);
    const rows = await this.prisma.products.findMany({
      where: { supplier_org_id: orgId, deleted_at: null, status: status ? (status as never) : undefined },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      unitPriceHalalas: Number(p.unit_price),
      stockQty: p.stock_qty,
      moq: p.moq,
      unitCode: p.unit_code,
    }));
  }
}
