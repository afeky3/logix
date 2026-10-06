import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAccountsController } from './admin-accounts.controller';
import { AdminAccountsService } from './admin-accounts.service';

@Module({
  imports: [JwtModule.register({})], // StaffAuthGuard needs JwtService
  controllers: [AdminAccountsController],
  providers: [AdminAccountsService],
})
export class AdminAccountsModule {}
