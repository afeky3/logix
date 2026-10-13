import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { ContractsService } from './contracts.service';
import { InvoicesService } from './invoices.service';
import { OrderProgressModule } from './order-progress.module';
import { ReferenceGenerator } from '../../common/references/reference-generator';

@Module({
  imports: [JwtModule.register({}), OrderProgressModule], // JwtAuthGuard/StaffAuthGuard need JwtService
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService, ReferenceGenerator, InvoicesService, ContractsService],
})
export class OrdersModule {}
