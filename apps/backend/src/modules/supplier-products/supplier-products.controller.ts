import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { SupplierProductsService } from './supplier-products.service';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  categorySlug: z.enum(['packaging', 'equipment', 'building-materials', 'other']),
  categoryOther: z.string().max(120).optional(),
  specsText: z.string().max(1000).optional(),
  originText: z.string().max(100).optional(),
  packagingText: z.string().max(1000).optional(),
  imageFileId: z.string().uuid().optional(),
});

const publishSchema = z.object({
  unitPriceHalalas: z.number().int().positive(),
  vatTreatment: z.enum(['INCLUSIVE', 'EXCLUSIVE']),
  unitText: z.string().max(60).optional(),
  stockQty: z.number().int().nonnegative(),
  moq: z.number().int().positive().optional(),
  leadTimeDays: z.number().int().nonnegative(),
});

const listQuery = z.object({
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'OUT_OF_STOCK', 'REMOVED']).optional(),
});

/** Supplier product catalog (client round 1). */
@Controller('organizations/:id/products')
@UseGuards(JwtAuthGuard)
export class SupplierProductsController {
  constructor(private readonly products: SupplierProductsService) {}

  @Post()
  create(@Param('id') orgId: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.products.create(orgId, user.sub, parseBody(createSchema, body));
  }

  @Put(':productId/publish')
  publish(
    @Param('id') orgId: string,
    @Param('productId') productId: string,
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.products.publish(orgId, user.sub, productId, parseBody(publishSchema, body));
  }

  @Get()
  list(@Param('id') orgId: string, @Query() query: Record<string, unknown>, @CurrentUser() user: AppTokenPayload) {
    const { status } = parseBody(listQuery, query);
    return this.products.list(orgId, user.sub, status);
  }
}
