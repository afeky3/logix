import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { StorageService } from './storage.service';

const detailsSchema = z.object({
  kind: z.enum(['NEW', 'EXIT', 'EXTENSION']),
  city: z.string().max(40).optional(),
  cityOther: z.string().max(120).optional(),
  storageKind: z.enum(['DRY', 'CHILLED', 'FROZEN']).optional(),
  pallets: z.number().int().positive().max(100000).optional(),
  entryDate: z.string().optional(),
  parcelReference: z.string().max(100).optional(),
  requestedDate: z.string().optional(),
  requirements: z.string().max(2000).optional(),
});

/** Storage requests: new storage, exit, or extension (client round 1, item 7). */
@Controller('service-requests/:id')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Put('storage-details')
  saveDetails(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.storage.saveDetails(id, user.sub, parseBody(detailsSchema, body));
  }

  @Get('storage-details')
  get(@Param('id') id: string, @CurrentUser() user: AppTokenPayload) {
    return this.storage.get(id, user.sub);
  }
}
