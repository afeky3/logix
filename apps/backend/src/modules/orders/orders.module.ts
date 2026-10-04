import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { ReferenceGenerator } from '../../common/references/reference-generator';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard/StaffAuthGuard need JwtService
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService, ReferenceGenerator],
})
export class OrdersModule {}
