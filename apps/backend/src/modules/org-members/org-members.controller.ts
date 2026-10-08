import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { parseBody } from '../../common/http/validate';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AppTokenPayload } from '../../common/auth/jwt-payload';
import { OrgMembersService } from './org-members.service';

const inviteSchema = z.object({
  phoneE164: z.string().regex(/^\+\d{7,15}$/, 'Must be E.164 format e.g. +966501234567'),
  role: z.enum(['MANAGER', 'MEMBER', 'DRIVER']),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class OrgMembersController {
  constructor(private readonly svc: OrgMembersService) {}

  /** Invite a new member by phone number */
  @Post('organizations/:id/invitations')
  invite(@Param('id') orgId: string, @Body() body: unknown, @CurrentUser() user: AppTokenPayload) {
    const { phoneE164, role } = parseBody(inviteSchema, body);
    return this.svc.invite(orgId, user.sub, phoneE164, role);
  }

  /** Pending invitations for this org (manager/owner view) */
  @Get('organizations/:id/invitations')
  listInvitations(@Param('id') orgId: string, @CurrentUser() user: AppTokenPayload) {
    return this.svc.listInvitations(orgId, user.sub);
  }

  /** Active members of this org */
  @Get('organizations/:id/members')
  listMembers(@Param('id') orgId: string, @CurrentUser() user: AppTokenPayload) {
    return this.svc.listMembers(orgId, user.sub);
  }

  /** Remove a member (owner only) */
  @Delete('organizations/:id/members/:memberId')
  removeMember(
    @Param('id') orgId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AppTokenPayload,
  ) {
    return this.svc.removeMember(orgId, user.sub, memberId);
  }

  /** Active drivers in this org (for the trip-assignment picker) */
  @Get('organizations/:id/drivers')
  listDrivers(@Param('id') orgId: string, @CurrentUser() user: AppTokenPayload) {
    return this.svc.listDrivers(orgId, user.sub);
  }

  /** Pending invitations waiting for the currently-logged-in user to accept */
  @Get('me/invitations')
  myInvitations(@CurrentUser() user: AppTokenPayload) {
    return this.svc.myInvitations(user.sub);
  }

  /** Accept an invitation by its one-time token */
  @Post('invitations/:token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AppTokenPayload) {
    return this.svc.acceptInvitation(user.sub, token);
  }
}
