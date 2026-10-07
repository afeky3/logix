import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminSettlementsController } from './admin-settlements.controller';
import { AdminSettlementsService } from './admin-settlements.service';
import { ReferenceGenerator } from '../../common/references/reference-generator';

@Module({
  imports: [JwtModule.register({})], // StaffAuthGuard needs JwtService
  controllers: [AdminSettlementsController],
  providers: [AdminSettlementsService, ReferenceGenerator],
})
export class AdminSettlementsModule {}
