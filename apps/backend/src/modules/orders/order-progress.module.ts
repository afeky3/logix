import { Module } from '@nestjs/common';
import { OrderProgressService } from './order-progress.service';

@Module({
  providers: [OrderProgressService],
  exports: [OrderProgressService],
})
export class OrderProgressModule {}
