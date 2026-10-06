import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomsController } from './customs.controller';
import { CustomsService } from './customs.service';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [CustomsController],
  providers: [CustomsService],
  exports: [CustomsService],
})
export class CustomsModule {}
