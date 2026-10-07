import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [JwtModule.register({})], // JwtAuthGuard needs JwtService
  controllers: [CasesController],
  providers: [CasesService],
})
export class CasesModule {}
