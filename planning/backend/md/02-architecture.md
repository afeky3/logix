# Backend — Architecture

## 1. Style: modular monolith

One NestJS application, deployed as two process types from the same image:

| Process | Role | Scaling |
|---|---|---|
| `api` | REST API, Socket.IO gateway, webhooks | Horizontal (stateless; Redis adapter for sockets) |
| `worker` | BullMQ consumers, cron jobs, outbox relay, PDF rendering | Horizontal per queue |

Modules own their tables and expose **application services** (interfaces) to other modules. A module never queries another module's tables directly. It either calls the owning service or reacts to domain events. This keeps later extraction into services possible.

## 2. Source layout (`apps/backend/src`)

```
src/
├── main.ts / worker.ts            # entrypoints (api, worker)
├── app.module.ts
├── common/                        # cross-cutting, no business logic
│   ├── auth/ (guards, decorators: @CurrentUser, @OrgContext, @Workspace)
│   ├── authz/ (CASL ability factory, policies)
│   ├── errors/ (AppError, error codes, filters)
│   ├── http/ (interceptors: idempotency, logging, i18n, pagination)
│   ├── money/ (Money type, VAT & rounding helpers)
│   ├── time/ (business-day calendar, Asia/Riyadh helpers)
│   ├── events/ (domain event base, outbox writer)
│   ├── references/ (LX-/PO-/RT-… number generator)
│   └── i18n/ (message catalogs for server-rendered text)
├── infrastructure/
│   ├── prisma/ (PrismaService, transaction helper)
│   ├── redis/, queue/, storage/ (S3), realtime/ (Socket.IO gateway)
│   └── integrations/ (payment, sms, push, email, maps, zatca, fasah, wathq, national-address)
└── modules/
    ├── auth/  identity/  organizations/  kyb/  terms/
    ├── reference-data/  files/  documents/
    ├── requests/  matching/  quotes/
    ├── orders/  tracking/  ratings/
    ├── shipping/  transport/  fleet/  warehousing/  customs/
    ├── marketplace/ (catalog, search, cart, checkout, purchase-orders, returns)
    ├── payments/  ledger/  commissions/  invoicing/  settlements/  payouts/
    ├── cancellations/  cases/  insurance/
    ├── messaging/  notifications/
    └── admin/ (admin-facing controllers that compose module services), audit/, reporting/
```

Each module has the same internal shape:

```
modules/<name>/
├── <name>.module.ts
├── api/            controllers (app/, provider/, driver/, admin/) + DTO schemas
├── application/    use-case services (one class per use case for complex flows)
├── domain/         entities, value objects, state machine definitions, policies
├── infrastructure/ repositories (Prisma), mappers
├── events/         event definitions + handlers
└── jobs/           BullMQ processors owned by the module
```

## 3. Request pipeline

```
HTTP → Fastify → RequestId/TraceId → Auth guard (JWT) → OrgContext guard (X-Organization-Id + membership)
     → Workspace guard (X-Workspace) → Throttler → Idempotency interceptor (POST with Idempotency-Key)
     → Zod validation pipe → Controller → Application service (Prisma transaction + outbox write)
     → Response mapper → i18n error filter
```

- **Org context:** every app request carries `X-Organization-Id`. The guard loads the user's membership (cached in Redis for 60 s) and rejects requests if the membership or workspace is missing or suspended.
- **Workspace:** `X-Workspace: CUSTOMER | SUPPLIER | PROVIDER | DRIVER` selects the permission set and must be enabled and approved for that organization.
- **Admin routes** (`/api/v1/admin/**`) use a separate staff JWT audience and a staff RBAC guard. See [06-security-compliance.md](06-security-compliance.md).

## 4. Domain events and the outbox

Reliable side effects (notifications, ledger postings, search indexing, analytics) use the **transactional outbox** pattern:

1. The use case writes business rows **and** an `outbox_event` row in the same DB transaction.
2. The outbox relay (worker, polls every 500 ms or uses `LISTEN/NOTIFY`) publishes to a BullMQ `domain-events` queue.
3. Handlers are idempotent and keyed by `event_id`. A `processed_events` table protects against duplicates.

Event naming: `<aggregate>.<past-tense-verb>` with a version, for example `order.completed.v1`.

Core events (non-exhaustive, full list in each module doc):

| Event | Main consumers |
|---|---|
| `request.submitted` | matching (fan-out to providers), notifications |
| `quote.submitted` / `quote.expired` | notifications (customer), requests (status) |
| `quote.accepted` | orders (create), payments (intent) |
| `payment.succeeded` / `payment.failed` | orders, ledger, notifications, invoicing |
| `order.confirmed` | notifications, customs (authorization prompt), warehousing (intake booking) |
| `order.milestone_recorded` | realtime, notifications, cancellations (stage) |
| `order.completion_submitted` (POD) | notifications (customer RC prompt), jobs (auto-acceptance timer) |
| `order.receipt_confirmed` / `order.completed` | settlements, ratings, invoicing |
| `order.damage_reported` | cases, settlements (hold) |
| `settlement.scheduled` / `payout.paid` | notifications, ledger |
| `cancellation.decided` | payments (refund), ledger, settlements |
| `document.rejected` / `document.accepted` | notifications, orders (start requirements) |
| `verification.decided` | organizations (activate workspace), notifications |
| `product.published` / `product.updated` | search index |
| `purchase_order.placed` / `.received` | suppliers, transport (linked order), settlements |
| `return.requested` / `.resolved` | suppliers, payments, settlements |

## 5. Background jobs

| Queue | Jobs | Trigger |
|---|---|---|
| `domain-events` | Event handlers | Outbox relay |
| `notifications` | push, SMS, email send, fan-out | Events |
| `expiry` | quote expiry, request expiry, payment-hold timeout, authorization validity | Delayed jobs at `valid_until` |
| `finance` | settlement eligibility (T+3 business days), payout batch prep, invoice generation, ZATCA submission | Events + daily cron 02:00 Riyadh |
| `compliance` | licence expiry reminders (30/7/1 days) and auto-suspension | Daily cron |
| `windows` | 24-hour damage-report window, 3-day return window, POD auto-acceptance (D-10) | Delayed jobs |
| `files` | antivirus scan, thumbnails, image EXIF strip, PDF render | Upload completion |
| `search` | product (re)index | Product events |
| `tracking` | GPS downsampling and archival | Every 5 minutes |
| `reminders` | confirm readiness, upload missing documents, confirm receipt | Delayed jobs |

All jobs are idempotent, retried with exponential backoff (max 8), and sent to a dead-letter queue shown in the dashboard's system page.

## 6. Realtime

- Socket.IO namespace `/rt`, authenticated with the same access token on handshake.
- Rooms: `user:{userId}`, `org:{orgId}`, `order:{orderId}`, `po:{poId}`, `conversation:{id}`, `staff:ops`.
- A server-side authorization check runs before joining any room (membership or participant).
- Events emitted: `notification.created`, `order.updated`, `order.milestone`, `quote.received`, `tracking.location`, `message.created`, `message.read`, `typing`.
- Clients treat realtime as a hint and re-fetch the resource via REST, which is authoritative.

## 7. Files

- Upload flow: `POST /files/upload-url` → client PUTs directly to S3 with the pre-signed URL → `POST /files/{id}/complete` → antivirus scan job → `file.status = CLEAN` → can be attached to a document.
- Downloads via short-lived pre-signed GET URLs (5 minutes), generated only after an ownership check.
- Buckets: `logix-private-{env}` (documents, evidence), `logix-public-{env}` (product images served via CDN after moderation).

## 8. Transactions and concurrency

- Money-moving and state-changing use cases run in a single Prisma interactive transaction with `SERIALIZABLE` or `SELECT … FOR UPDATE` on the aggregate row.
- Optimistic concurrency uses a `version` column on high-contention aggregates (orders, quotes, stock).
- Distributed locks (Redis Redlock) cover cross-request critical sections such as the payment-hold on an accepted quote.

## 9. Environments

| Env | Purpose | Data |
|---|---|---|
| `local` | Docker Compose: Postgres+PostGIS, Redis, MinIO, ClamAV, Mailpit, a fake SMS sink | Seed scripts |
| `dev` | Shared integration, auto-deploy from `main` | Synthetic |
| `staging` | Release candidates, gateway sandbox, UAT in Arabic and English | Anonymized or synthetic |
| `prod` | Live | Real |

Feature flags (a DB table with an admin UI) gate unfinished services per environment and allow a phased launch per service or city.

## 10. Scaling path (when needed)

1. Read replicas for reporting and admin list queries.
2. Move `tracking` ingestion to its own process, or to a time-series store if GPS volume grows.
3. Extract `notifications` and `search` into separate deployables (they already communicate only through events).
4. Partition large tables (`tracking_points`, `audit_logs`, `notifications`) by month.
