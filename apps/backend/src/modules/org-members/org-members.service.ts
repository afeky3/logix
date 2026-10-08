import { randomUUID } from 'node:crypto';
import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

const INVITE_TTL_DAYS = 7;
const MANAGER_ROLES = new Set(['OWNER', 'MANAGER']);

@Injectable()
export class OrgMembersService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const m = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!m || m.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'Not a member of this organization');
    return m;
  }

  private async requireManager(orgId: string, userId: string) {
    const m = await this.requireMembership(orgId, userId);
    if (!MANAGER_ROLES.has(m.role)) throw new AppError('FORBIDDEN', 'Only owners and managers can perform this action');
    return m;
  }

  private async requireOwner(orgId: string, userId: string) {
    const m = await this.requireMembership(orgId, userId);
    if (m.role !== 'OWNER') throw new AppError('FORBIDDEN', 'Only the owner can perform this action');
    return m;
  }

  // ---- Invite ---------------------------------------------------------------

  async invite(orgId: string, inviterId: string, phoneE164: string, role: 'MANAGER' | 'MEMBER' | 'DRIVER') {
    await this.requireManager(orgId, inviterId);

    // Idempotent: return existing active invite for same phone+org
    const existing = await this.prisma.org_invitations.findFirst({
      where: { organization_id: orgId, phone_e164: phoneE164, used_at: null, expires_at: { gt: new Date() } },
    });
    if (existing) return { id: existing.id, token: existing.token, expiresAt: existing.expires_at };

    // Check if user already exists and is an active member
    const targetUser = await this.prisma.users.findUnique({ where: { phone_e164: phoneE164 } });
    if (targetUser) {
      const existingMembership = await this.prisma.memberships.findUnique({
        where: { user_id_organization_id: { user_id: targetUser.id, organization_id: orgId } },
      });
      if (existingMembership?.status === 'ACTIVE') {
        throw new AppError('BUSINESS_RULE_VIOLATION', 'This user is already a member of this organization');
      }
    }

    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const token = randomBytes(20).toString('hex');

    // Pre-create the membership row (INVITED) if the user already has an account
    let membershipId: string | undefined;
    if (targetUser) {
      const m = await this.prisma.memberships.upsert({
        where: { user_id_organization_id: { user_id: targetUser.id, organization_id: orgId } },
        create: {
          id: randomUUID(),
          user_id: targetUser.id,
          organization_id: orgId,
          role: role as never,
          status: 'INVITED',
          invited_by_user_id: inviterId,
        },
        update: { role: role as never, status: 'INVITED', invited_by_user_id: inviterId },
      });
      membershipId = m.id;
    }

    const invite = await this.prisma.org_invitations.create({
      data: {
        id: randomUUID(),
        organization_id: orgId,
        phone_e164: phoneE164,
        role: role as never,
        invited_by_user_id: inviterId,
        token,
        expires_at: expiresAt,
        membership_id: membershipId,
      },
    });

    return { id: invite.id, token: invite.token, expiresAt: invite.expires_at };
  }

  // ---- Pending invitations for an org (admin view) --------------------------

  async listInvitations(orgId: string, userId: string) {
    await this.requireManager(orgId, userId);
    const rows = await this.prisma.org_invitations.findMany({
      where: { organization_id: orgId, used_at: null, expires_at: { gt: new Date() } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({ id: r.id, phoneE164: r.phone_e164, role: r.role, expiresAt: r.expires_at }));
  }

  // ---- Pending invitations for the current user (invitee view) --------------

  async myInvitations(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) return [];
    const rows = await this.prisma.org_invitations.findMany({
      where: { phone_e164: user.phone_e164, used_at: null, expires_at: { gt: new Date() } },
      include: { organizations: { select: { id: true, display_name: true } } },
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => ({
      token: r.token,
      organizationId: r.organization_id,
      organizationName: r.organizations.display_name,
      role: r.role,
      expiresAt: r.expires_at,
    }));
  }

  // ---- Accept invitation ----------------------------------------------------

  async acceptInvitation(userId: string, token: string) {
    const invite = await this.prisma.org_invitations.findUnique({ where: { token } });
    if (!invite || invite.used_at || invite.expires_at < new Date()) {
      throw new AppError('NOT_FOUND', 'Invitation not found or expired');
    }
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    if (user.phone_e164 !== invite.phone_e164) {
      throw new AppError('FORBIDDEN', 'This invitation was sent to a different phone number');
    }

    const membership = await this.prisma.memberships.upsert({
      where: { user_id_organization_id: { user_id: userId, organization_id: invite.organization_id } },
      create: {
        id: randomUUID(),
        user_id: userId,
        organization_id: invite.organization_id,
        role: invite.role,
        status: 'ACTIVE',
        invited_by_user_id: invite.invited_by_user_id,
        joined_at: new Date(),
      },
      update: { status: 'ACTIVE', role: invite.role, joined_at: new Date() },
    });

    // DRIVER role → auto-create driver profile
    if (invite.role === 'DRIVER') {
      await this.prisma.drivers.upsert({
        where: { membership_id: membership.id },
        create: {
          id: randomUUID(),
          membership_id: membership.id,
          organization_id: invite.organization_id,
          user_id: userId,
          status: 'ACTIVE',
        },
        update: { status: 'ACTIVE' },
      });
    }

    await this.prisma.org_invitations.update({
      where: { token },
      data: { used_at: new Date(), membership_id: membership.id },
    });

    return {
      organizationId: invite.organization_id,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joined_at,
    };
  }

  // ---- Members list ---------------------------------------------------------

  async listMembers(orgId: string, userId: string) {
    await this.requireManager(orgId, userId);
    const rows = await this.prisma.memberships.findMany({
      where: { organization_id: orgId, status: 'ACTIVE' },
      include: {
        users_memberships_user_idTousers: { select: { id: true, full_name: true, phone_e164: true } },
        drivers: { select: { id: true, status: true } },
      },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      userId: m.user_id,
      fullName: m.users_memberships_user_idTousers?.full_name ?? null,
      phoneE164: m.users_memberships_user_idTousers?.phone_e164 ?? null,
      role: m.role,
      joinedAt: m.joined_at,
      driverId: m.drivers?.id ?? null,
    }));
  }

  // ---- Remove member --------------------------------------------------------

  async removeMember(orgId: string, ownerId: string, membershipId: string) {
    await this.requireOwner(orgId, ownerId);
    const m = await this.prisma.memberships.findUnique({ where: { id: membershipId } });
    if (!m || m.organization_id !== orgId) throw new AppError('NOT_FOUND', 'Member not found');
    if (m.role === 'OWNER') throw new AppError('BUSINESS_RULE_VIOLATION', 'Cannot remove the owner');
    await this.prisma.memberships.update({
      where: { id: membershipId },
      data: { status: 'REMOVED', removed_at: new Date() },
    });
    return { success: true };
  }

  // ---- Drivers list (for trip assignment UI) --------------------------------

  async listDrivers(orgId: string, userId: string) {
    await this.requireManager(orgId, userId);
    const rows = await this.prisma.drivers.findMany({
      where: { organization_id: orgId, status: 'ACTIVE' },
      include: { users_drivers_user_idTousers: { select: { id: true, full_name: true, phone_e164: true } } },
    });
    return rows.map((d) => ({
      id: d.id,
      userId: d.user_id,
      fullName: d.users_drivers_user_idTousers.full_name ?? null,
      phoneE164: d.users_drivers_user_idTousers.phone_e164,
      status: d.status,
    }));
  }
}
