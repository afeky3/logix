import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StaffPermissionGuard } from '../../common/auth/staff-permission.guard';
import { AdminLegalController, LegalController } from './legal.controller';
import { LegalAcceptancesService } from './legal-acceptances.service';
import { ReturnPoliciesService } from './return-policies.service';
import { AdminLegalService } from './admin-legal.service';

/** Legal acceptances and suppliers' return policies. Global: auth (registration), orders (quote
 * acceptance gate) and products (returnPolicy on the detail) all use it. */
@Global()
@Module({
  imports: [JwtModule.register({})], // the guards need JwtService
  controllers: [LegalController, AdminLegalController],
  providers: [LegalAcceptancesService, ReturnPoliciesService, AdminLegalService, StaffPermissionGuard],
  exports: [LegalAcceptancesService, ReturnPoliciesService],
})
export class LegalModule {}
