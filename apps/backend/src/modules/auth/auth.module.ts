import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AppAuthController, DevicesController } from './app-auth.controller';
import { AppAuthService } from './app-auth.service';
import { MeController } from './me.controller';
import { StaffAuthController, AdminMeController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { TokenService } from './token.service';
import { FirebasePhoneVerifier } from './firebase-phone.verifier';
import { AuditModule } from '../../common/audit/audit.module';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController, PublicAccountDeletionController } from './account-deletion.controller';
import { WhatsAppOtpSender } from '../../infrastructure/notifications/whatsapp-otp.sender';

@Module({
  imports: [JwtModule.register({}), OrganizationsModule, AuditModule], // secrets/TTL passed explicitly per call, see token.service.ts
  controllers: [
    AppAuthController,
    MeController,
    StaffAuthController,
    AdminMeController,
    DevicesController,
    AccountDeletionController,
    PublicAccountDeletionController,
  ],
  providers: [AppAuthService, StaffAuthService, TokenService, WhatsAppOtpSender, FirebasePhoneVerifier, AccountDeletionService],
})
export class AuthModule {}
