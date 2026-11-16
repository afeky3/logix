import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationEvents } from './notification-events.service';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationEvents],
  exports: [NotificationsService, NotificationEvents],
})
export class NotificationsModule {}
