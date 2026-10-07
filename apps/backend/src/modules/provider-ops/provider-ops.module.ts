import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ProviderOpsController } from './provider-ops.controller';
import { ProviderOpsService } from './provider-ops.service';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [ProviderOpsController],
  providers: [ProviderOpsService],
})
export class ProviderOpsModule {}
