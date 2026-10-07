import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { ShippingService } from './shipping.service';

const detailsSchema = z.object({
  freightMode: z.enum(['SEA', 'AIR', 'LAND']).optional(),
  tradeDirection: z.enum(['IMPORT', 'EXPORT']).optional(),
  originCountry: z.enum(['CN', 'AE', 'TR', 'SA', 'OTHER']).optional(),
  originCountryOther: z.string().max(120).optional(),
  originLabel: z.string().max(200).optional(),
  destinationCountry: z.enum(['CN', 'AE', 'TR', 'SA', 'OTHER']).optional(),
  destinationCountryOther: z.string().max(120).optional(),
  destinationLabel: z.string().max(200).optional(),
  goodsTypeOther: z.string().max(120).optional(),
  containerKind: z.enum(['STANDARD', 'HIGH_CUBE', 'REEFER', 'OTHER']).optional(),
  containerKindOther: z.string().max(120).optional(),
  borderCrossing: z.enum(['BATHA', 'HADITHA', 'RAQI', 'OTHER']).optional(),
  borderCrossingOther: z.string().max(120).optional(),
  piecesCount: z.number().int().positive().optional(),
  weightKg: z.number().positive().optional(),
  hsCode: z.string().max(20).optional(),
  goodsDescription: z.string().max(1000).optional(),
  dimensionsCm: z.string().max(100).optional(),
  volumeCbm: z.number().positive().optional(),
  dangerousGoods: z.boolean().optional(),
  doorToDoor: z.boolean().optional(),
  urgentPriority: z.boolean().optional(),
  customsOnArrival: z.boolean().optional(),
  temporaryStorage: z.boolean().optional(),
  readinessDate: z.string().optional(),
  specialRequirements: z.string().max(2000).optional(),
});

/** International shipping: route, cargo and extras (client round 1, item 2). */
@Controller('service-requests/:id')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Put('shipping-details')
  saveDetails(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.shipping.saveDetails(id, user.sub, parseBody(detailsSchema, body));
  }

  @Get('shipping-details')
  get(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.shipping.get(id, user.sub);
  }
}
