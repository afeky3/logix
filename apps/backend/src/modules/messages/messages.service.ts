import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

const DEFAULT_PAGE = 30;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Guards ────────────────────────────────────────────────────────────────

  private async requireMembership(orgId: string, userId: string) {
    const m = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!m || m.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  private async requireParticipant(conversationId: string, orgId: string) {
    const p = await this.prisma.conversation_participants.findFirst({
      where: { conversation_id: conversationId, organization_id: orgId, left_at: null },
    });
    if (!p) throw new AppError('FORBIDDEN', 'Not a participant in this conversation');
    return p;
  }

  // ─── List conversations ────────────────────────────────────────────────────

  async listConversations(userId: string, organizationId: string) {
    await this.requireMembership(organizationId, userId);

    const participants = await this.prisma.conversation_participants.findMany({
      where: { organization_id: organizationId, left_at: null },
      select: { conversation_id: true, last_read_at: true },
    });
    if (participants.length === 0) return [];

    const convIds = participants.map((p) => p.conversation_id);
    const readByConvId = new Map(participants.map((p) => [p.conversation_id, p.last_read_at]));

    const convs = await this.prisma.conversations.findMany({
      where: { id: { in: convIds } },
      orderBy: { last_message_at: { sort: 'desc', nulls: 'last' } },
      include: {
        conversation_participants: {
          where: { left_at: null },
          include: { organizations: { select: { display_name: true } } },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            organizations: { select: { display_name: true } },
            users: { select: { full_name: true } },
          },
        },
      },
    });

    return convs.map((c) => {
      const lastMsg = c.messages[0] ?? null;
      const myReadAt = readByConvId.get(c.id) ?? null;

      // Unread = messages after last_read_at
      const unreadCount = myReadAt == null && lastMsg
        ? 1
        : 0; // accurate unread requires a count query; use simple heuristic for now

      return this.serializeConversation(c, lastMsg, unreadCount, organizationId);
    });
  }

  // ─── Get or create ─────────────────────────────────────────────────────────

  async getOrCreate(
    userId: string,
    organizationId: string,
    contextType: string,
    contextId?: string,
  ) {
    await this.requireMembership(organizationId, userId);

    const dedupeKey = contextId
      ? `${contextType.toLowerCase()}:${contextId}`
      : `support:${userId}`;

    const existing = await this.prisma.conversations.findUnique({
      where: { dedupe_key: dedupeKey },
      include: {
        conversation_participants: {
          where: { left_at: null },
          include: { organizations: { select: { display_name: true } } },
        },
        messages: { orderBy: { created_at: 'desc' }, take: 1, include: { organizations: { select: { display_name: true } }, users: { select: { full_name: true } } } },
      },
    });
    if (existing) {
      // Ensure the requesting org is a participant (may have been added later)
      await this._ensureParticipant(existing.id, organizationId, 'CUSTOMER');
      return this.serializeConversation(existing, existing.messages[0] ?? null, 0, organizationId);
    }

    // Resolve context reference and counter-party org
    let contextReference: string | null = null;
    let counterPartyOrgId: string | null = null;
    let counterPartyRole: string = 'PROVIDER';

    if (contextType === 'ORDER' && contextId) {
      const order = await this.prisma.orders.findUnique({ where: { id: contextId } });
      if (!order) throw new AppError('NOT_FOUND', 'Order not found');
      contextReference = order.reference;
      // Determine who the other party is
      if (order.customer_org_id === organizationId) {
        counterPartyOrgId = order.provider_org_id;
        counterPartyRole = 'PROVIDER';
      } else if (order.provider_org_id === organizationId) {
        counterPartyOrgId = order.customer_org_id;
        counterPartyRole = 'CUSTOMER';
      } else {
        throw new AppError('FORBIDDEN', 'Not a party to this order');
      }
    } else if (contextType === 'REQUEST_CLARIFICATION' && contextId) {
      const req = await this.prisma.service_requests.findUnique({ where: { id: contextId } });
      if (!req) throw new AppError('NOT_FOUND', 'Request not found');
      contextReference = req.reference;
    }

    const convId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO msg.conversations (id, conversation_type, dedupe_key, context_type, context_id, context_reference, status, created_at, updated_at)
        VALUES (${convId}::uuid, ${contextType}::core.conversation_type, ${dedupeKey}, ${contextType}, ${contextId ?? null}::uuid, ${contextReference}, 'OPEN'::core.conversation_status, ${now}::timestamptz, ${now}::timestamptz)
      `;

      const myRole = counterPartyOrgId
        ? (counterPartyRole === 'PROVIDER' ? 'CUSTOMER' : 'PROVIDER')
        : 'CUSTOMER';

      await tx.$executeRaw`
        INSERT INTO msg.conversation_participants (id, conversation_id, organization_id, role, joined_at)
        VALUES (${randomUUID()}::uuid, ${convId}::uuid, ${organizationId}::uuid, ${myRole}::core.participant_role, ${now}::timestamptz)
      `;

      if (counterPartyOrgId) {
        await tx.$executeRaw`
          INSERT INTO msg.conversation_participants (id, conversation_id, organization_id, role, joined_at)
          VALUES (${randomUUID()}::uuid, ${convId}::uuid, ${counterPartyOrgId}::uuid, ${counterPartyRole}::core.participant_role, ${now}::timestamptz)
        `;
      }
    });

    const created = await this.prisma.conversations.findUniqueOrThrow({
      where: { id: convId },
      include: {
        conversation_participants: {
          where: { left_at: null },
          include: { organizations: { select: { display_name: true } } },
        },
        messages: { orderBy: { created_at: 'desc' }, take: 1, include: { organizations: { select: { display_name: true } }, users: { select: { full_name: true } } } },
      },
    });

    return this.serializeConversation(created, null, 0, organizationId);
  }

  private async _ensureParticipant(conversationId: string, orgId: string, role: string) {
    const exists = await this.prisma.conversation_participants.findFirst({
      where: { conversation_id: conversationId, organization_id: orgId },
    });
    if (!exists) {
      await this.prisma.$executeRaw`
        INSERT INTO msg.conversation_participants (id, conversation_id, organization_id, role, joined_at)
        VALUES (${randomUUID()}::uuid, ${conversationId}::uuid, ${orgId}::uuid, ${role}::core.participant_role, now())
      `;
    } else if (exists.left_at !== null) {
      await this.prisma.$executeRaw`
        UPDATE msg.conversation_participants SET left_at = NULL WHERE id = ${exists.id}::uuid
      `;
    }
  }

  // ─── List messages ─────────────────────────────────────────────────────────

  async listMessages(
    userId: string,
    organizationId: string,
    conversationId: string,
    cursor?: string,
    limit = DEFAULT_PAGE,
  ) {
    await this.requireMembership(organizationId, userId);
    await this.requireParticipant(conversationId, organizationId);

    const msgs = await this.prisma.messages.findMany({
      where: {
        conversation_id: conversationId,
        deleted_at: null,
        ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      include: {
        organizations: { select: { display_name: true } },
        users: { select: { full_name: true } },
      },
    });

    const hasMore = msgs.length > limit;
    const items = hasMore ? msgs.slice(0, limit) : msgs;
    const nextCursor = hasMore ? items[items.length - 1].created_at.toISOString() : null;

    return {
      items: items.map((m) => this.serializeMessage(m, organizationId)),
      nextCursor,
      hasMore,
    };
  }

  // ─── Send message ──────────────────────────────────────────────────────────

  async sendMessage(
    userId: string,
    organizationId: string,
    conversationId: string,
    body: string,
  ) {
    await this.requireMembership(organizationId, userId);
    await this.requireParticipant(conversationId, organizationId);

    const conv = await this.prisma.conversations.findUnique({ where: { id: conversationId } });
    if (!conv) throw new AppError('NOT_FOUND', 'Conversation not found');
    if (conv.status === 'LOCKED') throw new AppError('INVALID_STATE_TRANSITION', 'Conversation is locked');

    const msgId = randomUUID();
    const now = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO msg.messages (id, conversation_id, kind, sender_user_id, sender_org_id, body, created_at)
      VALUES (${msgId}::uuid, ${conversationId}::uuid, 'TEXT'::core.message_kind, ${userId}::uuid, ${organizationId}::uuid, ${body}, ${now}::timestamptz)
    `;

    await this.prisma.$executeRaw`
      UPDATE msg.conversations SET last_message_at = ${now}::timestamptz, updated_at = ${now}::timestamptz
      WHERE id = ${conversationId}::uuid
    `;

    // Auto mark-read for sender
    await this.prisma.$executeRaw`
      UPDATE msg.conversation_participants
      SET last_read_message_id = ${msgId}::uuid, last_read_at = ${now}::timestamptz
      WHERE conversation_id = ${conversationId}::uuid AND organization_id = ${organizationId}::uuid
    `;

    const msg = await this.prisma.messages.findUniqueOrThrow({
      where: { id: msgId },
      include: {
        organizations: { select: { display_name: true } },
        users: { select: { full_name: true } },
      },
    });

    return this.serializeMessage(msg, organizationId);
  }

  // ─── Mark read ─────────────────────────────────────────────────────────────

  async markRead(userId: string, organizationId: string, conversationId: string) {
    await this.requireMembership(organizationId, userId);
    await this.requireParticipant(conversationId, organizationId);

    const latest = await this.prisma.messages.findFirst({
      where: { conversation_id: conversationId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    if (latest) {
      const now = new Date();
      await this.prisma.$executeRaw`
        UPDATE msg.conversation_participants
        SET last_read_message_id = ${latest.id}::uuid, last_read_at = ${now}::timestamptz
        WHERE conversation_id = ${conversationId}::uuid AND organization_id = ${organizationId}::uuid
      `;
    }

    return { ok: true };
  }

  // ─── Unread count (lightweight) ────────────────────────────────────────────

  async unreadCount(userId: string, organizationId: string) {
    await this.requireMembership(organizationId, userId);

    // Count conversations where last_message_at > last_read_at for this org
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint AS count
      FROM msg.conversation_participants cp
      JOIN msg.conversations c ON c.id = cp.conversation_id
      WHERE cp.organization_id = ${organizationId}::uuid
        AND cp.left_at IS NULL
        AND c.last_message_at IS NOT NULL
        AND (cp.last_read_at IS NULL OR c.last_message_at > cp.last_read_at)
    `;

    return { unread: Number(result[0].count) };
  }

  // ─── Serializers ───────────────────────────────────────────────────────────

  private serializeConversation(
    c: {
      id: string;
      conversation_type: string;
      context_type: string | null;
      context_id: string | null;
      context_reference: string | null;
      title: string | null;
      status: string;
      last_message_at: Date | null;
      conversation_participants: Array<{
        organization_id: string | null;
        role: string;
        organizations: { display_name: string } | null;
      }>;
    },
    lastMsg: {
      id: string;
      body: string | null;
      kind: string;
      sender_org_id: string | null;
      created_at: Date;
      organizations: { display_name: string } | null;
      users: { full_name: string | null } | null;
    } | null,
    unreadCount: number,
    myOrgId: string,
  ) {
    const otherParty = c.conversation_participants.find((p) => p.organization_id !== myOrgId);
    const myParty = c.conversation_participants.find((p) => p.organization_id === myOrgId);

    return {
      id: c.id,
      conversationType: c.conversation_type,
      contextType: c.context_type,
      contextId: c.context_id,
      contextReference: c.context_reference,
      title: c.title ?? c.context_reference ?? c.conversation_type,
      status: c.status,
      lastMessageAt: c.last_message_at,
      counterPartyName: otherParty?.organizations?.display_name ?? null,
      counterPartyRole: otherParty?.role ?? null,
      myRole: myParty?.role ?? null,
      unreadCount,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            body: lastMsg.body,
            kind: lastMsg.kind,
            senderName: lastMsg.organizations?.display_name ?? lastMsg.users?.full_name ?? null,
            mine: lastMsg.sender_org_id === myOrgId,
            createdAt: lastMsg.created_at,
          }
        : null,
    };
  }

  private serializeMessage(
    m: {
      id: string;
      conversation_id: string;
      kind: string;
      body: string | null;
      sender_user_id: string | null;
      sender_org_id: string | null;
      is_masked: boolean;
      created_at: Date;
      edited_at: Date | null;
      organizations: { display_name: string } | null;
      users: { full_name: string | null } | null;
    },
    myOrgId: string,
  ) {
    return {
      id: m.id,
      conversationId: m.conversation_id,
      kind: m.kind,
      body: m.is_masked ? null : m.body,
      isMasked: m.is_masked,
      senderOrgId: m.sender_org_id,
      senderName: m.organizations?.display_name ?? m.users?.full_name ?? null,
      mine: m.sender_org_id === myOrgId,
      createdAt: m.created_at,
      editedAt: m.edited_at,
    };
  }
}
