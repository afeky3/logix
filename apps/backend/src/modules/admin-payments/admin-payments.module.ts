import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../../common/audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { StaffPermissionGuard } from '../../common/auth/staff-permission.guard';

@Module({
  imports: [JwtModule.register({}), AuditModule, NotificationsModule, OrdersModule], // JwtModule: StaffAuthGuard needs JwtService
  controllers: [AdminPaymentsController],
  providers: [AdminPaymentsService, StaffPermissionGuard],
})
export class AdminPaymentsModule {}
