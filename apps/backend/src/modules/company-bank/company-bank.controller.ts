import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { RequireStaffPermission, StaffPermissionGuard } from '../../common/auth/staff-permission.guard';
import { CurrentStaff } from '../../common/auth/current-staff.decorator';
import type { StaffTokenPayload } from '../../common/auth/jwt-payload';
import { CompanyBankAccountService, companyBankAccountSchema, type RequestMeta } from './company-bank-account.service';

const meta = (req: FastifyRequest): RequestMeta => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'] ?? null,
  requestId: (req.headers['x-request-id'] as string | undefined) ?? null,
});

/** Dashboard: view and change the account customers transfer to. */
@Controller('admin/settlements/company-bank-account')
@UseGuards(StaffAuthGuard, StaffPermissionGuard)
export class AdminCompanyBankController {
  constructor(private readonly bank: CompanyBankAccountService) {}

  @Get()
  @RequireStaffPermission('finance.bank_account.read')
  get() {
    return this.bank.get();
  }

  @Put()
  @RequireStaffPermission('finance.bank_account.write')
  put(@Body() body: unknown, @CurrentStaff() staff: StaffTokenPayload, @Req() req: FastifyRequest) {
    return this.bank.put(staff.sub, parseBody(companyBankAccountSchema, body), meta(req));
  }
}

/** App: the account shown on the "pay by bank transfer" screens. */
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class CompanyBankController {
  constructor(private readonly bank: CompanyBankAccountService) {}

  @Get('bank-transfer-details')
  details() {
    return this.bank.forCustomers();
  }
}
