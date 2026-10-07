import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { ProviderOpsService } from './provider-ops.service';

const addVehicleSchema = z.object({
  plateNumber: z.string().trim().min(2).max(20),
  vehicleTypeCode: z.string().min(1),
  capacityTon: z.number().positive().max(9999).optional(),
  isReefer: z.boolean().optional(),
});

const assignTripSchema = z.object({
  organizationId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  driverName: z.string().trim().min(2).max(120),
  driverPhone: z.string().trim().max(30).optional(),
});

const tripEventSchema = z.object({
  organizationId: z.string().uuid(),
  eventType: z.enum([
    'START_TO_PICKUP',
    'ARRIVED_AT_PICKUP',
    'CARGO_COLLECTED',
    'DEPARTED',
    'BORDER_CROSSED',
    'ARRIVED_AT_DROPOFF',
  ]),
  clientEventId: z.string().uuid().optional(),
  unitCount: z.number().positive().optional(),
  note: z.string().max(500).optional(),
});

/** Provider workspace: settlements, fleet and trip execution. */
@Controller()
@UseGuards(JwtAuthGuard)
export class ProviderOpsController {
  constructor(private readonly ops: ProviderOpsService) {}

  @Get('organizations/:id/settlements')
  settlements(@Param('id') orgId: string, @CurrentUser() user: AppTokenPayload) {
    return this.ops.listSettlements(user.sub, orgId);
  }

  @Get('organizations/:id/vehicles')
  vehicles(@Param('id') orgId: string, @CurrentUser() user: AppTokenPayload) {
    return this.ops.listVehicles(user.sub, orgId);
  }

  @Post('organizations/:id/vehicles')
  addVehicle(@Param('id') orgId: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.ops.addVehicle(user.sub, orgId, parseBody(addVehicleSchema, body));
  }

  @Get('orders/:id/trip')
  trip(@Param('id') orderId: string, @CurrentUser() user: AppTokenPayload) {
    return this.ops.getTrip(user.sub, orderId);
  }

  @Post('orders/:id/trip')
  assign(@Param('id') orderId: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.ops.assignTrip(user.sub, orderId, parseBody(assignTripSchema, body));
  }

  @Post('orders/:id/trip-events')
  event(@Param('id') orderId: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    return this.ops.recordEvent(user.sub, orderId, parseBody(tripEventSchema, body));
  }
}
