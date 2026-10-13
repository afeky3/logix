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
  imageFileIds?: string[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categorySlug?: 'packaging' | 'equipment' | 'building-materials' | 'other';
  categoryOther?: string;
  specsText?: string;
  originText?: string;
  packagingText?: string;
  unitPriceHalalas?: number;
  stockQty?: number;
  moq?: number;
  leadTimeDays?: number;
  imageFileIds?: string[];
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
        unit_price: 1n, // placeholder — products_unit_price_check requires > 0; set for real on publish
        status: 'DRAFT',
        supply_notes: input.originText && originCountryCode === 'SA' && !input.originText.includes('سعود')
          ? `Origin as entered: ${input.originText}`
          : undefined,
      },
    });

    const allImageIds = input.imageFileIds ?? (input.imageFileId ? [input.imageFileId] : []);
    for (let i = 0; i < allImageIds.length; i++) {
      const file = await this.prisma.files.findFirst({
        where: { id: allImageIds[i], organization_id: orgId, purpose: 'PRODUCT_IMAGE' as never },
      });
      if (file) {
        await this.prisma.product_images.create({
          data: { id: randomUUID(), product_id: productId, file_id: file.id, is_cover: i === 0, sort_order: i },
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

    // Governance gap found auditing against the platform spec: a supplier
    // whose KYB isn't approved yet (workspace not ACTIVE) could publish to
    // the public catalog. Block that here — the same gate matching already
    // applies to providers.
    const workspace = await this.prisma.org_workspaces.findFirst({
      where: { organization_id: orgId, workspace: 'SUPPLIER' },
    });
    if (workspace?.status !== 'ACTIVE') {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Organization is not verified yet — publishing is blocked until KYB is approved');
    }

    const unitCode = await this.matchUnitCode(input.unitText);
    const now = new Date();

    // ck_products_published: PUBLISHED needs a listing consent — the
    // "I declare this listing is accurate" checkbox on the price/stock step.
    const consent = await this.prisma.consents.create({
      data: {
        id: randomUUID(),
        user_id: userId,
        organization_id: orgId,
        workspace: 'SUPPLIER',
        consent_key: 'LISTING_ACCURACY',
        context_type: 'product',
        context_id: productId,
        context_reference: product.name,
      },
    });

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
        listing_consent_id: consent.id,
      },
    });
    return { id: updated.id, status: updated.status };
  }

  async getOne(orgId: string, userId: string, productId: string) {
    await this.requireMembership(orgId, userId);
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: { product_images: { orderBy: { sort_order: 'asc' } } },
    });
    if (!product || product.supplier_org_id !== orgId || product.deleted_at) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }
    const specsArr = (product.specs as { key: string; value: string }[]) ?? [];
    const category = await this.prisma.product_categories.findUnique({ where: { id: product.category_id } });
    return {
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      categorySlug: category?.slug ?? 'other',
      categoryOther: specsArr.find((s) => s.key === 'categoryOther')?.value ?? '',
      specsText: specsArr.find((s) => s.key === 'specs')?.value ?? '',
      packagingText: specsArr.find((s) => s.key === 'packaging')?.value ?? '',
      status: product.status,
      unitPriceHalalas: Number(product.unit_price),
      vatTreatment: product.vat_treatment ?? 'INCLUSIVE',
      unitCode: product.unit_code,
      stockQty: product.stock_qty,
      moq: product.moq,
      leadTimeDays: product.lead_time_days,
      imageFileIds: product.product_images.map((i) => i.file_id),
    };
  }

  async update(orgId: string, userId: string, productId: string, input: UpdateProductInput) {
    await this.requireMembership(orgId, userId);
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: { product_images: true },
    });
    if (!product || product.supplier_org_id !== orgId || product.deleted_at) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }

    let specsArr = (product.specs as { key: string; value: string }[]) ?? [];
    if (input.specsText !== undefined) {
      specsArr = specsArr.filter((s) => s.key !== 'specs');
      if (input.specsText) specsArr.push({ key: 'specs', value: input.specsText });
    }
    if (input.packagingText !== undefined) {
      specsArr = specsArr.filter((s) => s.key !== 'packaging');
      if (input.packagingText) specsArr.push({ key: 'packaging', value: input.packagingText });
    }
    if (input.categoryOther !== undefined) {
      specsArr = specsArr.filter((s) => s.key !== 'categoryOther');
      if (input.categoryOther) specsArr.push({ key: 'categoryOther', value: input.categoryOther });
    }

    let categoryId = product.category_id;
    if (input.categorySlug) {
      const cat = await this.prisma.product_categories.findUnique({ where: { slug: input.categorySlug } });
      if (cat) categoryId = cat.id;
    }

    const originCountryCode = input.originText ? await this.matchCountryCode(input.originText) : undefined;

    await this.prisma.products.update({
      where: { id: productId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        category_id: categoryId,
        specs: specsArr,
        ...(originCountryCode && { origin_country_code: originCountryCode }),
        ...(input.unitPriceHalalas !== undefined && { unit_price: BigInt(Math.round(input.unitPriceHalalas)) }),
        ...(input.stockQty !== undefined && { stock_qty: input.stockQty }),
        ...(input.moq !== undefined && { moq: input.moq }),
        ...(input.leadTimeDays !== undefined && { lead_time_days: input.leadTimeDays }),
      },
    });

    if (input.imageFileIds !== undefined) {
      await this.prisma.product_images.deleteMany({ where: { product_id: productId } });
      for (let i = 0; i < input.imageFileIds.length; i++) {
        const file = await this.prisma.files.findFirst({
          where: { id: input.imageFileIds[i], organization_id: orgId, purpose: 'PRODUCT_IMAGE' as never },
        });
        if (file) {
          await this.prisma.product_images.create({
            data: { id: randomUUID(), product_id: productId, file_id: file.id, is_cover: i === 0, sort_order: i },
          });
        }
      }
    }

    return { id: productId };
  }

  async setStatus(orgId: string, userId: string, productId: string, status: 'PUBLISHED' | 'PAUSED' | 'REMOVED') {
    await this.requireMembership(orgId, userId);
    const product = await this.prisma.products.findUnique({ where: { id: productId } });
    if (!product || product.supplier_org_id !== orgId) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }
    if (status === 'PUBLISHED' && !product.listing_consent_id) {
      throw new AppError('BUSINESS_RULE_VIOLATION', 'Complete the publish flow to activate this product');
    }
    const updated = await this.prisma.products.update({
      where: { id: productId },
      data: {
        status: status as never,
        ...(status === 'REMOVED' && { deleted_at: new Date() }),
      },
    });
    return { id: updated.id, status: updated.status };
  }

  async remove(orgId: string, userId: string, productId: string) {
    await this.requireMembership(orgId, userId);
    const product = await this.prisma.products.findUnique({ where: { id: productId } });
    if (!product || product.supplier_org_id !== orgId) {
      throw new AppError('NOT_FOUND', 'Product not found');
    }
    await this.prisma.products.update({
      where: { id: productId },
      data: { status: 'REMOVED' as never, deleted_at: new Date() },
    });
    return { success: true };
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
