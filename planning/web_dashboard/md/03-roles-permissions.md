# Web Dashboard — Roles and Permissions

Roles are bundles of permissions stored in the database (editable by super admin). Permissions follow `area.resource.action`. Staff can hold several roles.

## 1. Roles
`SUPER_ADMIN`, `OPS_AGENT`, `KYB_REVIEWER`, `FINANCE`, `SUPPORT_AGENT`, `CONTENT_MANAGER`, `AUDITOR`. Optional later: `OPS_LEAD`, `FINANCE_LEAD` (approvers), `MARKETPLACE_MODERATOR`.

## 2. Permission matrix

Legend: **R** read, **W** write/act, **A** approve (checker in maker-checker), **—** none. PII is always masked unless the permission `pii.reveal` is held (a reason is always required).

| Area / capability | Super admin | Ops | KYB | Finance | Support | Content | Auditor |
|---|---|---|---|---|---|---|---|
| Home KPIs | R | R | R (KYB only) | R | R (cases) | — | R |
| Verification queue: view | R | R | R | R | R | — | R |
| Verification: decide items/case | W | — | W | — | — | — | — |
| Licences expiry monitor | R/W | R | R/W | — | — | — | R |
| Organizations: view | R | R | R | R | R | — | R |
| Organizations: suspend / reactivate | W | W (ops reasons) | W (compliance reasons) | — | — | — | — |
| Users: view / revoke sessions | R/W | R | R | R | R/W | — | R |
| Requests: view | R | R | — | R | R | — | R |
| Requests: extend expiry, cancel with reason | W | W | — | — | W | — | — |
| Orders: view 360 | R | R | — | R | R | — | R |
| Orders: correct milestone (source ADMIN) | W | W | — | — | — | — | — |
| Orders: force-complete / force-cancel | W (maker) | W (maker) | — | A | — | — | — |
| Live trips map | R | R | — | — | R | — | R |
| Customs: verify/revert authorization, manual declaration update | W | W | — | — | — | — | R |
| Warehousing: stock adjustment (exceptional) | W (maker) | W (maker) | — | A | — | — | R |
| Marketplace: categories | W | — | — | — | — | W | R |
| Marketplace: product moderation / takedown | W | W | — | — | W | W | R |
| Returns escalation decision | W | W | — | A (if refund > threshold) | W | — | R |
| Payments: view / reconcile | R | R | — | R/W | R | — | R |
| Refunds ≤ threshold | W | — | — | W | W | — | R |
| Refunds > threshold | W (maker) | — | — | W (maker) / A | W (maker) | — | R |
| Cancellation review decision ≤ threshold | W | W | — | W | W | — | R |
| Cancellation review decision > threshold | W (maker) | W (maker) | — | A | W (maker) | — | R |
| Settlements: view / hold / release hold | R/W | R | — | R/W | R | — | R |
| Payout batch: create / export | W | — | — | W (maker) | — | — | R |
| Payout batch: approve / mark paid | A | — | — | A (different user) | — | — | R |
| Commission rules | W (maker) | — | — | W (maker) / A | — | — | R |
| Cancellation / return rules | W (maker) | — | — | A | — | W (maker) | R |
| Invoices / credit notes | R | R | — | R/W | R | — | R |
| Ledger manual adjustment | W (maker) | — | — | W (maker) / A | — | — | R |
| Cases: view / work | R/W | R/W | — | R/W (finance cases) | R/W | — | R |
| Insurance ops | W | W | — | R | W | — | R |
| Reference data | W | R | — | — | — | W | R |
| Terms: draft | W | — | — | — | — | W | R |
| Terms: publish (new version) | A | — | — | — | — | W (maker) | R |
| Notification templates / FAQs / banners | W | — | — | — | — | W | R |
| Broadcasts (push to segments) | A | W (maker) | — | — | — | W (maker) | R |
| Business calendar (holidays) | W | — | — | W | — | W | R |
| Feature flags / app config | W | R | — | — | — | — | R |
| Reports / exports | R/W | R/W (ops) | R/W (KYB) | R/W (finance) | R (cases) | — | R/W |
| Audit log | R | R (own area) | R (own area) | R (own area) | R (own area) | R (own area) | R |
| Consent audit search | R | R | R | — | R | — | R |
| Staff and roles management | W | — | — | — | — | — | R |
| System (queues, DLQ retry, webhooks replay, integrations health) | W | R | — | R (payments webhooks) | — | — | R |
| PII reveal (`pii.reveal`) | W | W | W | W (IBAN) | W (phone) | — | — |

Thresholds (configurable in settings): refund maker-checker > 5,000 SAR, cancellation decision maker-checker > 5,000 SAR. Proposals, confirm with finance.

## 3. Maker-checker catalog

| Action | Maker | Checker |
|---|---|---|
| Payout batch approval | Finance | Finance (different user) / Super admin |
| Refund > threshold | Finance / Support | Finance lead |
| Cancellation decision > threshold | Ops / Support | Finance |
| Commission rule change | Finance | Super admin / Finance lead |
| Cancellation / return rule change | Content / Finance | Super admin |
| Ledger manual adjustment | Finance | Super admin |
| Force-complete / force-cancel order | Ops | Finance |
| Warehouse stock adjustment by admin | Ops | Finance |
| Terms publication | Content | Super admin (after legal sign-off recorded) |
| Broadcast to > 1,000 users | Ops / Content | Super admin |

## 4. Rules
- Two-factor authentication is mandatory for all staff. Super admin and finance also require an IP allow-list (optional, recommended).
- Access reviews run quarterly: the super admin exports staff × roles for review (audited).
- Staff cannot act on organizations they're linked to as app users (conflict of interest). This is flagged in the UI and blocked for KYB/finance decisions.
- Every permission check failure is logged (security monitoring).
