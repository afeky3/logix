# Backend — Security and Compliance

Target: **OWASP ASVS Level 2** for the API and dashboard, and **OWASP MASVS L1** for the mobile app. Compliance items that need legal confirmation are flagged and tracked in [09-open-decisions.md](09-open-decisions.md).

## 1. Authentication

### App users (phone OTP)
- 6-digit numeric OTP with a 5-minute TTL. The code is stored hashed (HMAC-SHA256 with a server pepper), never in plain text, never logged.
- Resend cooldown is 45 s (matches A03 "Resend available in 00:45"), with a maximum of 5 sends per hour per phone and 5 verify attempts per challenge. After that the challenge is locked and a new one is required.
- Response time on `otp/request` is the same whether or not the phone is registered, so the endpoint does not reveal which numbers have accounts.
- Tokens: JWT access token (15 min, ES256) plus an opaque refresh token (30 days, rotated on every use, reuse detection revokes the whole session family).
- Sessions are bound to `device_id` and listed in X06 with remote sign-out.
- Changing the phone number requires OTP on both the old and new numbers, or a support-assisted flow with KYB re-check for business owners.

### Staff (dashboard)
- Email + password (argon2id, min 12 chars, breached-password check) + **mandatory TOTP 2FA**.
- 8-hour session with 30-minute idle timeout. Staff invitations are single-use links with a 48-hour expiry.
- Optional IP allow-list for finance and super-admin roles.

## 2. Authorization

- **Tenant isolation:** every query on tenant data is scoped by `organization_id` from the verified membership, never from the request body. Repository helpers require an org scope parameter, which a lint rule enforces.
- **Resource ownership rules (examples):**
  - Customer: own org's requests, orders, POs, cases.
  - Provider: requests matched to it (reduced view), its own quotes, and orders where `provider_org_id` = org.
  - Driver: only trips assigned to them (`TripAssignment.driver_user_id`).
  - Supplier: own products, POs where `supplier_org_id` = org, returns on those POs.
  - Broker: customs documents of orders assigned to it, and only after award.
- **Field-level rules:** `internal_cost`/`target_margin` are only visible to the quoting provider. Customer contact details and customer documents are hidden from providers before award (D-16). IBAN is returned masked (`SA** **** **** 4821`) except in the finance payout export.
- **Staff RBAC:** roles `SUPER_ADMIN`, `OPS_AGENT`, `KYB_REVIEWER`, `FINANCE`, `SUPPORT_AGENT`, `CONTENT_MANAGER`, `AUDITOR`. The permission matrix is in the dashboard docs. Sensitive actions (payout approval, refund above a threshold, commission rule change) need **maker-checker**, meaning two different staff users.
- A 404 is returned instead of a 403 when revealing the resource's existence would leak information (IDOR hardening).

## 3. Data protection

| Data | Protection |
|---|---|
| IBAN, national ID/Iqama, driver licence number | Application-level encryption (AES-256-GCM, envelope keys in cloud KMS) + masked views |
| Documents (CR, licences, invoices, B/L, IDs) | Private bucket, SSE-KMS, pre-signed URLs (5 min), access logged |
| Passwords/OTP | argon2id / HMAC-SHA256 |
| Tokens | Refresh tokens stored hashed |
| Location history | Retained 12 months, then aggregated or deleted (proposal, confirm with legal) |
| Backups | Encrypted, and restores are tested quarterly |

- TLS 1.2+ everywhere, HSTS on the dashboard and API domains.
- EXIF metadata (GPS/device) is stripped from uploaded photos except where evidence location is intentionally recorded, in which case it is stored as structured data instead.
- Logs never contain OTPs, tokens, IBANs, full phone numbers (masked `+9665XXXX1234`) or document contents.

## 4. Saudi regulatory checklist (needs legal confirmation)

| Area | Requirement | Plan |
|---|---|---|
| **PDPL** (Personal Data Protection Law) and implementing regulations | Lawful basis, privacy notice, data subject rights, breach notification, cross-border transfer restrictions | Privacy policy terms document; consent records; export/delete tooling in the dashboard; hosting region decision (D-23) |
| **ZATCA e-invoicing (Fatoora)** | Compliant tax invoices (XML UBL 2.1, QR, cryptographic stamp; Phase 2 clearance/reporting) for VAT-registered issuers | Depends on the invoicing model (D-03). Invoicing module designed for it |
| **VAT (15%)** | Correct tax base, tax invoices, credit notes on refunds | Ledger + invoicing module; tax base decision (D-02) |
| **Payments / SAMA** | Collecting and holding funds for third parties may require a licensed arrangement | Use the gateway's marketplace/split capability or a licensed partner; confirm funds flow (D-04) |
| **Insurance Authority** | Distributing or comparing insurance products is regulated | Treat insurance as referral/ops-driven until confirmed (D-07) |
| **TGA** (transport) and customs broker licensing | Providers must hold valid licences | KYB licence checks + expiry monitoring + auto-suspension |
| **CST** SMS sender registration | Registered sender ID for OTP/SMS | SMS provider onboarding (T-04) |
| **E-commerce law** | Seller disclosure, returns, invoice | Supplier profile disclosure fields; returns module; terms |

## 5. Application security controls

- Input validation with zod on every endpoint (strict schemas, unknown keys rejected), and output DTO mapping so internal fields cannot leak.
- File uploads: MIME sniffing (magic bytes) plus an allow-list (PDF, JPG, PNG, HEIC→JPG), 10 MB max per file (client doc), ClamAV scan before use, images re-encoded to strip payloads.
- SSRF: no user-supplied URLs are fetched server-side, and outbound integrations go through an egress allow-list.
- Webhooks: HMAC signature verification, timestamp tolerance of 5 min, replay protection by event ID.
- Rate limiting and bot protection on auth and public search endpoints.
- Security headers via helmet. Dashboard CSP with nonces. Cookies (dashboard refresh) are `HttpOnly; Secure; SameSite=Strict`.
- Dependency scanning (Renovate + `pnpm audit` + GitHub Dependabot alerts) and SAST (CodeQL/Semgrep) in CI. Container image scanning (Trivy).
- Secrets live in the cloud secret manager, rotate every 90 days, and never go in the repo (gitleaks pre-commit + CI).
- **Integration credentials (gateway, Fasah, SMS, ZATCA certificates) exist only server-side.**

## 6. Anti-fraud and platform integrity

- Pre-award contact masking: phone numbers, emails and URLs in pre-award messages and quote notes are detected and masked, and the message is flagged for review (anti-circumvention, D-16).
- Velocity checks: many requests or cancellations from one account, repeated failed payments, or several accounts sharing one device or IBAN raise flags for ops review.
- Payouts go only to a verified IBAN whose holder name matches the legal name. An IBAN change triggers a payout hold of 48 h and a notification to the owner.
- Ratings can only be submitted by the counterparty of a completed order (one per order), and staff can moderate them.

## 7. Audit

- An append-only `audit_logs` table records actor (user/staff/system), action, entity, before/after diff (sensitive fields redacted), IP, user agent and request ID.
- Mandatory audit points: every state transition, every consent, every document review decision, every finance action, every staff login, permission change and data export.
- Retention is 7 years for finance-related audit (proposal aligned with tax record retention; confirm), and 2 years for the rest.

## 8. Incident readiness

- Severity matrix, on-call rotation, runbooks (payment gateway down, SMS provider down, Fasah down, data breach).
- Breach notification workflow per PDPL timelines (confirm exact timelines with legal).
- Kill switches (feature flags) for payments, new requests per service, and marketplace checkout.
