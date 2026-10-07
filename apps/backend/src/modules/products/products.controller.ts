import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ProductsService } from './products.service';

const listQuery = z.object({
  category: z.enum(['packaging', 'equipment', 'building-materials', 'other']).optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Buyer-facing product catalog (client round 1 follow-up). */
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.products.list(parseBody(listQuery, query));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.get(id);
  }
}
