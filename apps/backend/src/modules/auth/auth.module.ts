import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AppAuthController } from './app-auth.controller';
import { AppAuthService } from './app-auth.service';
import { MeController } from './me.controller';
import { StaffAuthController, AdminMeController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { TokenService } from './token.service';

@Module({
  imports: [JwtModule.register({})], // secrets/TTL passed explicitly per call, see token.service.ts
  controllers: [AppAuthController, MeController, StaffAuthController, AdminMeController],
  providers: [AppAuthService, StaffAuthService, TokenService],
})
export class AuthModule {}
