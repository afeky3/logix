import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { AccountDeletionService, type Locale } from './account-deletion.service';

const confirmSchema = z.object({ challengeId: z.string().uuid(), code: z.string().length(6) });
const publicOtpSchema = z.object({ phone: z.string().min(6).max(20) });

/** The language of the person's app: refusal messages come back in it. Arabic when nothing says otherwise. */
const localeOf = (req: FastifyRequest): Locale => {
  const h = String(req.headers['x-localization'] ?? req.headers['accept-language'] ?? '').toLowerCase();
  return h.startsWith('en') ? 'en' : 'ar';
};
const metaOf = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

/** From inside the app. */
@Controller('me/account-deletion')
@UseGuards(JwtAuthGuard)
export class AccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Post('otp')
  @HttpCode(201)
  otp(@CurrentUser() user: AppTokenPayload, @Req() req: FastifyRequest) {
    return this.deletion.requestOtp(user.sub, localeOf(req), req.ip);
  }

  @Post('confirm')
  @HttpCode(201)
  confirm(@Body() body: unknown, @CurrentUser() user: AppTokenPayload, @Req() req: FastifyRequest) {
    const { challengeId, code } = parseBody(confirmSchema, body);
    return this.deletion.confirm(user.sub, challengeId, code, localeOf(req), metaOf(req));
  }
}

/** The public web form at logix-co.com/{ar,en}/delete-account: same steps, no sign-in. */
@Controller('account-deletion')
export class PublicAccountDeletionController {
  constructor(private readonly deletion: AccountDeletionService) {}

  @Post('otp')
  @HttpCode(201)
  otp(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { phone } = parseBody(publicOtpSchema, body);
    return this.deletion.requestPublicOtp(phone, req.ip);
  }

  @Post('confirm')
  @HttpCode(201)
  confirm(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { challengeId, code } = parseBody(confirmSchema, body);
    return this.deletion.confirmPublic(challengeId, code, localeOf(req), metaOf(req));
  }
}
