import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface StaffAuditEntry {
  staffId: string;
  /** Dotted, e.g. 'payment.approved' (see the audit_logs column comment in 001_init.sql). */
  action: string;
  entityType: string;
  /** Null for an entity that has no uuid (e.g. a setting identified by its key: use entityReference). */
  entityId?: string | null;
  entityReference?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  /** Required for sensitive staff actions, e.g. why a transfer was rejected. */
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Writes audit.audit_logs (append-only, partitioned by month). Pass the caller's transaction
 * so the entry commits or rolls back together with the change it records. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** An action by an app user on their own account (e.g. deleting it). */
  async logUser(
    entry: { userId: string; action: string; entityType: string; entityId: string; after?: Prisma.InputJsonValue; ip?: string | null; userAgent?: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).audit_logs.create({
      data: {
        id: randomUUID(),
        actor_type: 'USER',
        actor_user_id: entry.userId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        after: entry.after,
        ip: entry.ip ?? null,
        user_agent: entry.userAgent ?? null,
      },
    });
  }

  async logStaff(entry: StaffAuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    await (tx ?? this.prisma).audit_logs.create({
      data: {
        id: randomUUID(),
        actor_type: 'STAFF',
        actor_staff_id: entry.staffId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        entity_reference: entry.entityReference ?? null,
        before: entry.before,
        after: entry.after,
        reason: entry.reason ?? null,
        ip: entry.ip ?? null,
        user_agent: entry.userAgent ?? null,
        request_id: entry.requestId ?? null,
      },
    });
  }
}
