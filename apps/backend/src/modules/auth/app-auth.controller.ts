import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { AppAuthService } from './app-auth.service';

const otpRequestSchema = z.object({
  phone: z.string().min(6),
  purpose: z.literal('SIGN_IN').default('SIGN_IN'),
});

const deviceSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  // `.nullish()` (not `.optional()`) — some clients send an explicit `null`
  // for an absent value rather than omitting the key.
  appVersion: z.string().nullish(),
  pushToken: z.string().nullish(),
});

const otpVerifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().length(6),
  device: deviceSchema,
});

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

const pushTokenSchema = z.object({ pushToken: z.string().min(1) });

/** App auth — backend/md/modules/01-auth-identity.md. */
@Controller('auth')
export class AppAuthController {
  constructor(private readonly auth: AppAuthService) {}

  @Post('otp/request')
  async requestOtp(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { phone } = parseBody(otpRequestSchema, body);
    return this.auth.requestOtp(phone, req.ip, undefined);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { challengeId, code, device } = parseBody(otpVerifySchema, body);
    return this.auth.verifyOtp(challengeId, code, device, req.ip);
  }

  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const { refreshToken } = parseBody(refreshSchema, body);
    return this.auth.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AppTokenPayload): Promise<{ success: true }> {
    await this.auth.logout(user.sid);
    return { success: true };
  }
}

/** POST /devices/push-token — updates the current session's push token. */
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly auth: AppAuthService) {}

  @Post('push-token')
  async setPushToken(
    @Body() body: unknown,
    @CurrentUser() user: AppTokenPayload,
  ): Promise<{ success: true }> {
    const { pushToken } = parseBody(pushTokenSchema, body);
    await this.auth.updatePushToken(user.sid, pushToken);
    return { success: true };
  }
}
