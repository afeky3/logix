import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
