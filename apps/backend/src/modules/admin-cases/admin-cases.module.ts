import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminCasesController } from './admin-cases.controller';
import { AdminCasesService } from './admin-cases.service';

@Module({
  imports: [JwtModule.register({})], // StaffAuthGuard needs JwtService
  controllers: [AdminCasesController],
  providers: [AdminCasesService],
})
export class AdminCasesModule {}
