# Module 16 — Admin APIs, Audit and Reporting

## Purpose
The backend surface for the web dashboard: staff identity and RBAC, cross-module admin endpoints (composing module services, never bypassing their rules), audit log access, operational queues, configuration, and reporting/analytics.

## 1. Staff RBAC

Roles and capabilities (the full matrix is in [web_dashboard/md/03-roles-permissions.md](../../../web_dashboard/md/03-roles-permissions.md)):

| Role | Core capabilities |
|---|---|
| `SUPER_ADMIN` | Everything, including staff management and feature flags |
| `OPS_AGENT` | Requests/orders monitor, milestone corrections, zero-match queue, insurance ops, provider nudges |
| `KYB_REVIEWER` | Verification queue, licence reviews, organization suspend/reactivate (with reason) |
| `FINANCE` | Payments, refunds, settlements, payout batches (maker or checker), commission rules (maker), invoices, reports |
| `SUPPORT_AGENT` | Cases inbox, conversations, user lookup (masked PII), cancellation reviews (below threshold) |
| `CONTENT_MANAGER` | Reference data, terms drafts, notification templates, categories, banners |
| `AUDITOR` | Read-only everything including the audit log. No PII unmasking |

- Permissions are checked per endpoint via `@RequirePermission('finance.payouts.approve')`.
- Roles map to permission sets stored in the DB (editable by `SUPER_ADMIN`).
- **Maker-checker** endpoints need two distinct staff users: payout batch approval, refunds above a threshold (e.g. 5,000 SAR, configurable), commission rule changes, cancellation rule changes, manual ledger adjustments, bulk broadcasts.
- **PII unmasking** (full phone, IBAN, national ID) requires a reason and is audit-logged.

## 2. Admin endpoint groups

| Group | Base path | Highlights |
|---|---|---|
| Staff and auth | `/admin/auth`, `/admin/staff` | Invite, roles, deactivate, 2FA reset (super admin) |
| Dashboard KPIs | `/admin/metrics/overview` | See §4 |
| Verification | `/admin/verification-cases`, `/admin/licenses` | Queue, decisions, expiry monitor |
| Organizations and users | `/admin/organizations`, `/admin/users` | Search, detail, suspend/reactivate, sessions revoke, members |
| Requests | `/admin/service-requests` | Filters, zero-match/zero-quote queues, extend expiry, cancel with reason |
| Orders | `/admin/orders` | Detail (timeline, money, documents, links, cases), milestone correction, reassign provider (exceptional, with customer consent), force-complete (maker-checker) |
| Live operations | `/admin/trips/live` | Map feed of active trips (realtime room `staff:ops`) |
| Customs | `/admin/customs/authorizations`, `/admin/customs/declarations` | Verify or revert authorization status, manual Fasah updates (source ADMIN) |
| Warehousing | `/admin/storage-contracts` | Inventory and movements audit, stuck releases |
| Marketplace | `/admin/products`, `/admin/product-categories`, `/admin/purchase-orders`, `/admin/returns` | Moderation, takedown, escalations decision |
| Finance | `/admin/payments`, `/admin/refunds`, `/admin/settlements`, `/admin/payout-batches`, `/admin/commission-rules`, `/admin/invoices`, `/admin/ledger` | See module 12 |
| Cancellations and cases | `/admin/cancellation-requests`, `/admin/cases` | Queues, assignment, decisions, internal notes |
| Insurance | `/admin/insurers`, `/admin/insurance/*` | Module 14 |
| Content and config | `/admin/reference/*`, `/admin/terms`, `/admin/notification-templates`, `/admin/holidays`, `/admin/cancellation-rules`, `/admin/document-requirements`, `/admin/feature-flags`, `/admin/app-config` | Versioned, audited |
| Communications | `/admin/broadcasts` | Segment, schedule, approval |
| Audit | `/admin/audit-logs`, `/admin/consents` | Search and export |
| Reports | `/admin/reports/*` | Async CSV/XLSX exports |
| System | `/admin/system/queues`, `/admin/system/integrations`, `/admin/system/webhooks` | DLQ retry, integration health, webhook replay |

All admin list endpoints support offset pagination, multi-filters, sorting, saved views (stored per staff) and CSV export (async job, emailed link, audit-logged).

## 3. Audit log

**AuditLog**: `occurred_at`, `actor_type` (`USER`/`STAFF`/`SYSTEM`/`INTEGRATION`), `actor_id`, `actor_org_id?`, `action` (e.g. `order.milestone.corrected`), `entity_type`, `entity_id`, `reference?` (LX-…), `before` / `after` (JSON, sensitive fields redacted), `reason?`, `ip`, `user_agent`, `request_id`.

- Append-only (DB permissions: no UPDATE/DELETE for the app role), partitioned monthly.
- Written by a common interceptor for admin mutations and explicitly in use cases for state transitions.
- Searchable by entity, reference, actor and date. The dashboard shows an "Activity" tab on every entity.
- Consents are stored separately (module 02) but surfaced in the same search.

## 4. Metrics and reporting

**Overview KPIs** (`/admin/metrics/overview?from&to&serviceType&city`):
- GMV (paid order value), commission revenue, orders by status and service, conversion funnel (drafts → submitted → quoted → accepted → paid → completed)
- Average quotes per request, time to first quote, zero-quote rate
- Provider supply: active providers per activity and city, acceptance rate, cancellation rate, on-time delivery %
- Customer: new sign-ups, active customers, repeat rate
- Marketplace: listings, POs, return rate
- Finance: settlements due and paid, payout backlog, refunds
- Ops queues: KYB pending (with SLA), cases open/breached, cancellation reviews pending

**Implementation:**
- Phase 1–3: SQL views and materialized views refreshed every 15 min on a read replica, with cached responses.
- Phase 4: event stream to a warehouse (BigQuery/Redshift/ClickHouse) + BI tool (Metabase/Looker Studio).

**Standard reports (exports):** orders ledger, commission report, VAT report (commission VAT; service VAT if principal), settlements and payouts, refunds, KYB decisions, licence expiries, provider performance, marketplace sales, cases SLA.

## 5. Operational queues (backend support)

| Queue | Source | Endpoint |
|---|---|---|
| KYB pending | Verification cases `SUBMITTED` | `/admin/verification-cases?status=SUBMITTED` |
| Zero-match / zero-quote requests | Module 05 | `/admin/service-requests?flag=ZERO_MATCH\|ZERO_QUOTE` |
| Readiness not confirmed > 24 h | Module 06 | `/admin/orders?flag=READINESS_OVERDUE` |
| Stale GPS on active trips | Module 08 | `/admin/trips/live?flag=STALE` |
| Pending authorization verification | Module 10 | `/admin/customs/authorizations?status=ACTIVE&verified=false` |
| Cancellation reviews | Module 13 | `/admin/cancellation-requests?status=UNDER_REVIEW` |
| Cases by SLA | Module 13 | `/admin/cases?sla=BREACHING` |
| Insurance tasks | Module 14 | `/admin/insurance/requests?status=REQUESTED` |
| Settlements due / failed payouts | Module 12 | `/admin/settlements?dueBy=today`, `?status=FAILED` |
| Flagged messages (masking) | Module 15 | `/admin/conversations/flags` |
| Product moderation | Module 11 | `/admin/products?status=PENDING_REVIEW` |

## Acceptance criteria
- [ ] Every admin mutation creates an audit row with actor, reason (where required) and diff.
- [ ] Maker-checker cannot be satisfied by the same staff user.
- [ ] PII is masked by default, and unmasking is reasoned and logged.
- [ ] KPI numbers reconcile with the ledger and order tables (spot-check report).
