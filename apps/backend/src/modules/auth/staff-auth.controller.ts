import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { StaffAuthGuard } from '../../common/auth/staff-auth.guard';
import { CurrentStaff } from '../../common/auth/current-staff.decorator';
import type { StaffTokenPayload } from '../../common/auth/jwt-payload';
import { StaffAuthService } from './staff-auth.service';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const mfaSetupSchema = z.object({ mfaToken: z.string().min(10) });
const mfaVerifySchema = z.object({ mfaToken: z.string().min(10), code: z.string().min(6) });
const refreshSchema = z.object({ refreshToken: z.string().min(10) });

/** Staff console auth — backend/md/05-api-conventions.md §1 (separate audience). */
@Controller('admin/auth')
export class StaffAuthController {
  constructor(private readonly auth: StaffAuthService) {}

  @Post('login')
  async login(@Body() body: unknown) {
    const { email, password } = parseBody(loginSchema, body);
    return this.auth.login(email, password);
  }

  @Post('mfa/setup')
  async mfaSetup(@Body() body: unknown) {
    const { mfaToken } = parseBody(mfaSetupSchema, body);
    return this.auth.setupMfa(mfaToken);
  }

  @Post('mfa/verify')
  async mfaVerify(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { mfaToken, code } = parseBody(mfaVerifySchema, body);
    return this.auth.verifyMfa(mfaToken, code, req.ip, req.headers['user-agent']);
  }

  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const { refreshToken } = parseBody(refreshSchema, body);
    return this.auth.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(StaffAuthGuard)
  async logout(@CurrentStaff() staff: StaffTokenPayload): Promise<{ success: true }> {
    await this.auth.logout(staff.sid);
    return { success: true };
  }
}

@Controller('admin/me')
@UseGuards(StaffAuthGuard)
export class AdminMeController {
  constructor(private readonly auth: StaffAuthService) {}

  @Get()
  me(@CurrentStaff() staff: StaffTokenPayload) {
    return this.auth.me(staff.sub);
  }
}
