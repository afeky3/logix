# Module 02 — Organizations, KYB, Licences, Bank Accounts, Terms and Consent

## Purpose
Create customer, supplier and provider accounts, verify businesses (KYB), manage provider activities and service areas, licences with expiry, payout bank accounts, versioned terms and the consent audit trail.

## Screens served
App: A04 (add role), A05 Create account, A06 Business verification, A07 Terms & consent, A08 Verification status, X06 (profile & addresses). Kit: K-P01 Business registration, K-P02 Licences & bank, K-P03 Provider terms, K-P04 Verification status, K-S07 Supplier consent.
Dashboard: verification queue, organization detail, licence expiry monitor, terms management, consent audit search.

## Entities
`Organization`, `Membership`, `OrgWorkspace`, `BusinessProfile`, `Address`, `ProviderActivity`, `ServiceArea`, `License`, `BankAccount`, `VerificationCase`, `VerificationItem`, `TermsDocument`, `Consent`.

`ServiceArea` (per provider activity): `activity_id`, `area_type` (`CITY`|`REGION`|`COUNTRY`|`PORT`|`CHECKPOINT`|`LANE`), `ref_id` or `(origin, destination)` for lanes.

## Onboarding flows

### Customer (individual)
A04 → A05 (account type = individual, full name, email?, address) → A07 (customer terms) → workspace `CUSTOMER` = `ACTIVE` immediately.

### Customer (company)
A05 (account type = company) → A06 (business name and CR, VAT ID and national address, optional bank account) → A07 → workspace `CUSTOMER` = `ACTIVE` with `verification = PENDING`. The company can request quotes but **cannot pay** until KYB is approved (D-17).

### Supplier / Provider
A05 → A06 (legal details, activity licence *based on the selected service*, VAT and address docs, business bank account IBAN + bank proof) → activities and service areas (provider) → A07 (role-specific terms: seller 3.5% commission and returns; provider 10% freight/transport, 20% customs/storage) → submit → A08 status. Quoting and publishing are unlocked only after approval (A08 "Quoting and publishing after approval").

### Required documents by activity (configurable matrix)

| Activity | Required | Optional |
|---|---|---|
| All businesses | Commercial registration, national address, bank account + proof | VAT certificate (required if VAT-registered) |
| `TRANSPORT_CARRIER` | TGA transport activity licence, vehicle operating cards (per vehicle, fleet module), cargo insurance | — |
| `TRANSPORT_BROKER` | TGA brokerage licence | Insurance |
| `FREIGHT_SEA`/`AIR`/`LAND`/`EXPRESS` | Freight forwarding licence/activity in CR | Insurance |
| `WAREHOUSE` | Warehouse licence (municipality/civil defense as applicable), insurance | — |
| `CUSTOMS_BROKER` | Customs broker licence (ZATCA) | — |
| `SUPPLIER` | CR with trading activity | Trademark/agency certificates |

*"Required documents depend on activity, not every license for every provider."* The matrix is data (dashboard-managed), not code.

## KYB review (dashboard)
- The queue is sorted by submission time with an SLA timer (target 1 business day).
- The reviewer checks each `VerificationItem` and marks it accepted or changes requested with a reason, for example *"A clearer copy is required"* (A08).
- The case decision is `APPROVED`, `CHANGES_REQUESTED` (the app shows per-item reasons and "Upload file and expiry date") or `REJECTED` (with reason; the user can contact support).
- Phase 4: Wathq CR auto-check and National Address API validation pre-fill items as "auto-verified".
- Approval activates the workspace and the approved activities, and triggers a notification ("Your account is ready").

## Licence expiry monitoring
- Daily job: reminders at 30, 7 and 1 days before `expires_at` (push + email).
- On expiry, the licence becomes `EXPIRED`, and the dependent activity is `SUSPENDED`: no new quotes and no new matches. Running orders continue, but ops is alerted.
- Uploading a renewed licence opens a mini verification case for that item only.

## Bank accounts
- SA IBAN validation (24 characters, `SA` prefix, mod-97 checksum).
- The account holder name must match the legal name. Mismatches are flagged for manual review.
- A new IBAN triggers `PENDING` + a 48-hour payout hold + a notification to the owner (anti-fraud).
- Only `VERIFIED` accounts receive payouts, and one account is the default.

## Terms and consent
- `TermsDocument` versions per audience and locale. Only one `is_current` per audience+locale. Publishing a new version can force re-consent at next login (flag `requires_reconsent`).
- Terms screens show the **summary items** (client PDFs pages 34–36) and a "Read full terms" link to the full text. The checkbox is never pre-selected.
- `POST /consents` records `{ consentKey, termsDocumentId?, context }` together with IP, device and timestamp, and never updates an existing row.
- The consent keys used across the app are listed in [03-domain-model.md §3](../03-domain-model.md#3-organizations-kyb-and-terms).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/organizations` | `{ kind, displayName }` → creates org + OWNER membership |
| POST | `/organizations/{id}/workspaces` | `{ workspace, activities?[] }` |
| GET / PUT | `/organizations/{id}/business-profile` | |
| GET / POST / PATCH / DELETE | `/organizations/{id}/addresses` | National address fields + lat/lng + contact |
| GET / POST / PATCH | `/organizations/{id}/activities` | + service areas |
| GET / POST / PATCH | `/organizations/{id}/licenses` | `{ type, number, expiresAt, fileId }` |
| GET / POST | `/organizations/{id}/bank-accounts` | IBAN masked in responses |
| GET | `/organizations/{id}/verification` | Case + items + reasons (A08) |
| POST | `/organizations/{id}/verification/submit` | Validates the completeness matrix |
| GET | `/terms/current?audience=PROVIDER` | Localized by `Accept-Language` |
| POST | `/consents` | Idempotent per `(user, consentKey, context)` |
| GET | `/document-requirements?workspace=PROVIDER&activities=…` | Drives the A06 checklist |

Admin: `GET /admin/verification-cases?status=…`, `POST /admin/verification-cases/{id}/items/{itemId}/decision`, `POST /admin/verification-cases/{id}/decision`, `GET /admin/organizations/{id}`, `POST /admin/organizations/{id}/suspend|reactivate`, `GET /admin/licenses?expiringWithin=30d`, `POST /admin/terms`, `POST /admin/terms/{id}/publish`, `GET /admin/consents?orgId&key&from&to`.

## Events
`organization.created`, `workspace.requested`, `verification.submitted`, `verification.decided`, `license.expiring`, `license.expired`, `activity.suspended`, `bank_account.changed`, `terms.published`, `consent.recorded`.

## Edge cases
- A user who is both a supplier and a customer under the **same** company uses one organization with two workspaces, sharing KYB.
- A provider with multiple activities gets per-activity approval. One can be approved while another is pending.
- Changing the legal name or CR after approval opens a new verification case. Existing orders are unaffected, and payouts are held until re-approval.

## Acceptance criteria
- [ ] Each role can complete onboarding with the correct document checklist per activity.
- [ ] Changes-requested loops work item by item, and resubmit keeps accepted items.
- [ ] Expired licences suspend matching automatically, and a renewal restores it after approval.
- [ ] Every consent is traceable (who, what version, when, context) from the dashboard.
