# Module 15 — Messaging and Notifications

## Purpose
In-app conversations (order chat, pre-award clarifications, supplier inquiries, driver ↔ coordinator, case threads, support) and multi-channel notifications (in-app center, push, SMS, email) with bilingual templates and user preferences.

## Screens served
- App: X05 Notifications and messages, Messages tab (all workspaces), SHF "Service provider — message in the app", M05 Supplier conversation, TR05 "Message driver", PT2 "Message order coordinator", X04 "Chat with support", notification bell (kit header).
- Dashboard: support inbox, notification templates, broadcast.

## 1. Conversations

**Conversation**: `type` (`ORDER`, `REQUEST_CLARIFICATION`, `PRODUCT_INQUIRY`, `PURCHASE_ORDER`, `TRIP`, `CASE`, `SUPPORT`), `context_type` + `context_id`, `title`, `status` (`OPEN`/`CLOSED`/`LOCKED`), `last_message_at`.
**Participant**: `conversation_id`, `organization_id`, `user_id?` (null = whole org), `role`, `last_read_message_id`, `muted`.
**Message**: `conversation_id`, `sender_user_id`, `sender_org_id`, `kind` (`TEXT`/`ATTACHMENT`/`SYSTEM`), `body`, `attachments[]` (file ids), `masked` (bool), `created_at`, `edited_at?`, `deleted_at?`.

Rules:
- Conversations are created automatically:
  - `ORDER` when an order is confirmed (customer org ↔ provider org)
  - `PURCHASE_ORDER` on PO placed
  - `TRIP` on driver assignment (driver ↔ provider coordinator; the customer can message the driver per TR05 "Message driver", relayed through the order conversation with driver visibility, which is the proposal)
  - `CASE` on case open
- `REQUEST_CLARIFICATION` and `PRODUCT_INQUIRY` start on demand.
- **Anti-circumvention (D-16):** before award or first paid PO, phone numbers, emails, URLs and WhatsApp mentions are detected (regex, including Arabic-Indic digits) and masked (`masked = true`). The sender sees a hint, and ops sees a flag.
- Messages are immutable after 5 min (edits are allowed within 5 min and marked edited). Deletion hides the body ("message deleted") but keeps it for audit.
- Attachments go through module 04 (scan). Images get thumbnails.
- `SYSTEM` messages post key events into order threads ("Quote accepted", "Driver assigned: Mohammed • truck 4821", "Document requires correction").
- Read receipts are per participant. Typing indicators are sent via realtime only (not stored).

API:

| Method | Path |
|---|---|
| GET | `/conversations?type&contextId&cursor` (inbox with unread counts) |
| POST | `/conversations` `{ type, contextId }` (idempotent: returns the existing thread) |
| GET | `/conversations/{id}/messages?cursor` |
| POST | `/conversations/{id}/messages` `{ body?, fileIds? }` |
| POST | `/conversations/{id}/read` `{ lastMessageId }` |
| POST | `/conversations/{id}/mute` |

Realtime: `message.created`, `message.read`, `typing`, `conversation.updated`.

## 2. Notifications

**Notification** (in-app center): `user_id`, `organization_id`, `workspace`, `type`, `title_key`, `body_key`, `params` (JSON), `deep_link` (e.g. `logix://orders/{id}`), `priority`, `read_at?`, `created_at`. Titles are rendered client-side from keys, so they stay correct if the language changes.

**Channels**: in-app (always), push (FCM), SMS (critical/transactional only), email (invoices, statements, KYB decisions, staff).

**Templates**: `notification_templates` (`key`, `channel`, `locale`, `title`, `body`, `variables[]`), editable by content managers in the dashboard, with a preview and test-send. A CI check ensures every key exists in `ar` and `en`.

**Preferences**: per user, per category (orders, quotes, messages, marketing, finance). Transactional/security notifications cannot be disabled. Quiet hours for non-urgent push are 23:00–07:00 Riyadh (proposal).

### Catalog (initial)

| Event | Recipient | Channels | Example (EN) |
|---|---|---|---|
| OTP | User | SMS | "Your Logix code is 123456" |
| `request.matched` | Provider | push, in-app | "New request matches your activity: Riyadh → Jeddah" |
| `quote.submitted` | Customer | push, in-app | "A quote arrived for your shipment" (X05) |
| `quote.expiring` (2 h before) | Customer | push | "An offer expires soon" |
| `quote.not_selected` | Provider | in-app | "Customer selected another offer" |
| `payment.succeeded` | Customer, provider | push, in-app, email (receipt) | "Payment confirmed • LX-2048" |
| `payment.failed` | Customer | push, in-app | "Payment not confirmed. Check status before paying again" |
| `order.confirmed` | Provider | push, in-app | "Your quote is accepted. Check payment before starting work" |
| `document.changes_requested` | Uploader | push, in-app | "Document needs correction: Origin certificate • open order" |
| `order.milestone_recorded` | Customer | push (key milestones), in-app | "Shipment departed" (X05 "Execution update") |
| `trip.assigned` | Driver | push | "New job assigned: LX-3081" |
| `trip.issue_reported` | Customer, provider | push | "Delay reported: access issue at pickup" |
| `order.completion_submitted` | Customer | push, in-app, SMS | "Your delivery is complete. Please inspect and confirm receipt" |
| `order.receipt_reminder` | Customer | push | "Please confirm receipt of LX-2048" |
| `order.completed` | Provider | in-app | "Customer confirmed receipt. Settlement scheduled" |
| `settlement.paid` | Provider/supplier | push, email | "Payout sent • TRX-2048" |
| `verification.decided` | Org owner | push, email | "Your account is ready" / "A clearer copy is required" |
| `license.expiring` | Org owner | push, email | "Your activity licence expires in 7 days" |
| `purchase_order.placed` | Supplier | push, in-app | "New purchase order PO-1048 • 100 cartons" |
| `return.requested` | Supplier | push | "Return requested for PO-1048" |
| `message.created` | Participants | push (if not active in thread) | "Message from your provider" |
| `case.updated` | Opener | push, in-app | "Update on CASE-2048" |
| `broker_authorization.action_required` | Customer | push, in-app, SMS | "Complete the official authorization action" |

## 3. Delivery pipeline
- The domain event handler resolves recipients, preferences and locale, creates the in-app notification, and enqueues channel jobs.
- Push: FCM with `data` payload (deep link, notification id) + localized `notification` block. Invalid tokens are pruned.
- SMS: provider adapter (T-04) with DLR webhooks and a fallback provider if the primary fails.
- Email: SES with bilingual templates. Invoices and statements are attached or linked.
- Dedup: collapse keys for bursts (for example several quotes become a digest after the third).
- Realtime `notification.created` updates the badge count immediately.

## 4. API (notifications)

| Method | Path |
|---|---|
| GET | `/notifications?cursor&unreadOnly` |
| GET | `/notifications/unread-count` |
| POST | `/notifications/{id}/read`, `/notifications/read-all` |
| GET / PUT | `/notification-preferences` |
| POST | `/devices/push-token` |
| — | Admin: `/admin/notification-templates` CRUD + preview/test, `/admin/broadcasts` (segmented announcements, approval required) |

## Acceptance criteria
- [ ] Every catalog event reaches the right recipients in their locale, and deep links open the right screen.
- [ ] Pre-award contact details are masked, and ops can review flags.
- [ ] Push token lifecycle works (login, refresh, logout, invalid token cleanup).
- [ ] Missing template translations fail CI.
