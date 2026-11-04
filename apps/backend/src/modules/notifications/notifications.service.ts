import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface NewNotification {
  userId: string;
  organizationId?: string | null;
  workspace?: 'CUSTOMER' | 'SUPPLIER' | 'PROVIDER' | 'DRIVER' | null;
  /** Dotted, e.g. 'payment.approved'. */
  type: string;
  category: 'ORDERS' | 'QUOTES' | 'MESSAGES' | 'FINANCE' | 'ACCOUNT' | 'MARKETING' | 'SECURITY';
  /** i18n keys: the client renders the text, params fill its placeholders. */
  titleKey: string;
  bodyKey: string;
  params?: Prisma.InputJsonObject;
  deepLink?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface NotificationListQuery {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
}

/** The in-app notification center (msg.notifications). Push delivery comes later. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the caller's transaction so the notification only exists if the change it announces committed. */
  async create(entries: NewNotification[], tx?: Prisma.TransactionClient): Promise<void> {
    if (entries.length === 0) return;
    await (tx ?? this.prisma).notifications.createMany({
      data: entries.map((n) => ({
        id: randomUUID(),
        user_id: n.userId,
        organization_id: n.organizationId ?? null,
        workspace: n.workspace ?? null,
        notification_type: n.type,
        category: n.category,
        title_key: n.titleKey,
        body_key: n.bodyKey,
        params: n.params ?? {},
        deep_link: n.deepLink ?? null,
        priority: n.priority ?? 'NORMAL',
      })),
    });
  }

  async list(userId: string, { page, pageSize, unreadOnly }: NotificationListQuery) {
    const where: Prisma.notificationsWhereInput = { user_id: userId, ...(unreadOnly ? { read_at: null } : {}) };
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.count({ where: { user_id: userId, read_at: null } }),
    ]);
    return {
      items: rows.map((n) => ({
        id: n.id,
        type: n.notification_type,
        category: n.category,
        titleKey: n.title_key,
        bodyKey: n.body_key,
        params: n.params,
        deepLink: n.deep_link,
        priority: n.priority,
        isRead: n.read_at !== null,
        readAt: n.read_at,
        createdAt: n.created_at,
      })),
      page,
      pageSize,
      total,
      unreadCount,
    };
  }

  /** Only the owner's own rows are touched, so someone else's id is a quiet no-op. */
  async markRead(userId: string, id: string): Promise<{ unreadCount: number }> {
    await this.prisma.notifications.updateMany({
      where: { id, user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
    return { unreadCount: await this.prisma.notifications.count({ where: { user_id: userId, read_at: null } }) };
  }

  async markAllRead(userId: string): Promise<{ unreadCount: number }> {
    await this.prisma.notifications.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
    return { unreadCount: 0 };
  }
}
