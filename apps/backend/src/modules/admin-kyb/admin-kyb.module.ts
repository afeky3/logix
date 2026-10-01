import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminKybController } from './admin-kyb.controller';
import { AdminKybService } from './admin-kyb.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [JwtModule.register({}), FilesModule], // StaffAuthGuard needs JwtService
  controllers: [AdminKybController],
  providers: [AdminKybService],
})
export class AdminKybModule {}
