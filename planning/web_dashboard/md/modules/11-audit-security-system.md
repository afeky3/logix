# Dashboard Module 11 — Approvals, Audit, Staff and System (D02, D39, D41–D43)

Backend: [admin-audit-reporting](../../../backend/md/modules/16-admin-audit-reporting.md), [security-compliance](../../../backend/md/06-security-compliance.md), [integrations](../../../backend/md/modules/17-integrations.md).

## D02 — Approvals inbox (maker-checker)
- **Lists:** *Waiting for me* (I'm an eligible checker), *Submitted by me*, *History*.
- **Item:** action type (payout batch, refund > threshold, commission rule, cancellation decision > threshold, force-complete, stock adjustment, terms publication, broadcast, ledger adjustment), maker, created at, summary, amount, link to the subject.
- **Detail:** a clear diff or summary ("Refund 7,500 SAR to mada •••• 1234 for LX-260148 — reason …"), attachments, the maker's reason, and the related entity preview.
- **Actions:** `Approve` (optional note) / `Reject` (reason required). The maker cannot see the approve button for their own items (backend-enforced too).
- Items expire after 72 h if untouched (they are returned to the maker with a notification).

## D39 — Staff and roles
- **Staff list:** name, email, roles, status, 2FA enrolled, last login, IP allow-list scope.
- **Actions:**
  - invite (email + roles)
  - change roles
  - deactivate (immediate session revoke)
  - reset 2FA (super admin; requires the target to re-enrol)
  - force logout
- **Roles editor:** a permission set per role (checkbox matrix grouped by area), cloned from defaults, audited. Built-in roles are locked (clone to customize).
- **Access review export:** staff × roles × last activity (quarterly review).

## D41 — Audit log and consent search
- **Search by:** entity type + ID/reference, actor (staff/user/system/integration), action, date range, IP.
- **Row:** time (Riyadh), actor, action, entity (link), reason, request ID. Expand shows the before/after diff (sensitive fields redacted).
- **Entity "Audit" tabs** across the console reuse this component, pre-filtered.
- **Consent search:** by org/user, consent key (terms acceptance, request accuracy, quoted scope, receipt confirmation, listing accuracy, insurance terms, purchase terms, broker authorization), terms version, context reference (LX-/PO-).
- Export (audited). Read-only for everyone. No edit or delete exists at any level.

## D42 — System
| Panel | Content | Actions |
|---|---|---|
| Queues | Per BullMQ queue: waiting, active, delayed, failed, DLQ size, throughput | Retry failed / DLQ item (idempotent handlers), pause queue (super admin) |
| Outbox | Lag (oldest unpublished event age), throughput | — (alerts only) |
| Webhooks | Inbound events per provider (payments, SMS DLR, integrations): status, signature valid, processing result | Replay an event (idempotent), view the raw payload (masked) |
| Integrations health | Gateway, SMS primary/secondary, FCM, maps, ZATCA, Fasah (when live), Wathq, national address: last success, error rate, circuit state, latency | Switch SMS primary/secondary (super admin), test call |
| Jobs schedule | Cron jobs (settlement eligibility, licence reminders, reconciliation) with the last run and result | Run now (idempotent jobs only) |
| Versions | Backend, app min versions, dashboard build, migrations applied | — |

## D43 — Staff profile
Language (ar/en), 2FA management (regenerate backup codes), active sessions, notification preferences (email/in-console for assignments, approvals, SLA breaches), saved views management.

## Security monitoring surfaced to super admins
- Failed staff logins and 2FA failures, logins from new IPs or countries.
- Permission-denied spikes, PII reveals per staff (daily digest), large exports.
- Admin actions outside business hours (informational).

## Acceptance criteria
- [ ] Maker-checker cannot be bypassed from the UI or API, and approvals expire as configured.
- [ ] Audit entries exist for every mutation performed through the console, including exports and PII reveals.
- [ ] DLQ retries and webhook replays are safe to run repeatedly (idempotent) and are themselves audited.
- [ ] Deactivating a staff user revokes access immediately.
