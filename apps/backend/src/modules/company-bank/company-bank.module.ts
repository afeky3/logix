import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../../common/audit/audit.module';
import { StaffPermissionGuard } from '../../common/auth/staff-permission.guard';
import { AdminCompanyBankController, CompanyBankController } from './company-bank.controller';
import { CompanyBankAccountService } from './company-bank-account.service';

@Module({
  imports: [JwtModule.register({}), AuditModule], // the guards need JwtService
  controllers: [AdminCompanyBankController, CompanyBankController],
  providers: [CompanyBankAccountService, StaffPermissionGuard],
})
export class CompanyBankModule {}
