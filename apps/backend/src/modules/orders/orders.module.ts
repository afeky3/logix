import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReferenceGenerator } from '../../common/references/reference-generator';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [OrdersController],
  providers: [OrdersService, ReferenceGenerator],
})
export class OrdersModule {}
