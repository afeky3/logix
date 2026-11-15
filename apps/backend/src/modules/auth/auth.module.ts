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
import { WhatsAppOtpSender } from '../../infrastructure/notifications/whatsapp-otp.sender';

@Module({
  imports: [JwtModule.register({}), OrganizationsModule], // secrets/TTL passed explicitly per call, see token.service.ts
  controllers: [
    AppAuthController,
    MeController,
    StaffAuthController,
    AdminMeController,
    DevicesController,
  ],
  providers: [AppAuthService, StaffAuthService, TokenService, WhatsAppOtpSender, FirebasePhoneVerifier],
})
export class AuthModule {}
