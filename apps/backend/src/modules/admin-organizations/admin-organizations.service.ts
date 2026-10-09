import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

@Injectable()
export class AdminOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { q?: string; limit: number; offset: number }) {
    const q = opts.q?.trim();
    const where = q
      ? { display_name: { contains: q, mode: 'insensitive' as const } }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.organizations.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: opts.limit,
        skip: opts.offset,
        select: {
          id: true,
          display_name: true,
          kind: true,
          status: true,
          created_at: true,
          org_workspaces: { select: { workspace: true, status: true } },
          _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
        },
      }),
      this.prisma.organizations.count({ where }),
    ]);

    return {
      total,
      items: rows.map((o) => ({
        id: o.id,
        displayName: o.display_name,
        kind: o.kind,
        status: o.status,
        createdAt: o.created_at,
        workspaces: o.org_workspaces.map((w) => ({ workspace: w.workspace, status: w.status })),
        memberCount: o._count.memberships,
      })),
    };
  }

  async listMembers(orgId: string) {
    const org = await this.prisma.organizations.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');

    const rows = await this.prisma.memberships.findMany({
      where: { organization_id: orgId },
      orderBy: { joined_at: 'asc' },
      include: {
        users_memberships_user_idTousers: { select: { id: true, phone_e164: true, full_name: true } },
      },
    });

    return rows.map((m) => ({
      id: m.id,
      userId: m.user_id,
      phoneE164: m.users_memberships_user_idTousers.phone_e164,
      fullName: m.users_memberships_user_idTousers.full_name,
      role: m.role,
      status: m.status,
      joinedAt: m.joined_at,
    }));
  }
}
