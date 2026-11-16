import { Module } from '@nestjs/common';
import { OrderProgressService } from './order-progress.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [OrderProgressService],
  exports: [OrderProgressService],
})
export class OrderProgressModule {}
