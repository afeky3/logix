# Dashboard Module 09 — Configuration and Content (D31–D38)

Backend: [reference-data](../../../backend/md/modules/03-reference-data.md), [organizations-kyb-terms](../../../backend/md/modules/02-organizations-kyb-terms.md) (terms), [messaging-notifications](../../../backend/md/modules/15-messaging-notifications.md) (templates), [cancellations](../../../backend/md/modules/13-cancellations-refunds-cases.md) (rules), [payments-finance](../../../backend/md/modules/12-payments-finance.md) (calendar).

Everything here changes platform behaviour or user-facing text, so **every change is versioned, audited and (where marked) maker-checker**.

## D31 — Reference data
- One page per catalog: countries, regions/cities, ports and airports, customs checkpoints, vehicle types, container types, storage types, handling services, commodity categories, units, document types, cancellation/return reasons, issue types, case types.
- **Common UI:** table with search (ar/en), active filter, add/edit drawer (name_ar, name_en required + catalog-specific fields), deactivate (never delete if referenced), sort order, CSV import/export (ports, cities) with a validation report.
- **Document types** add: applies-to (KYB / service / movement), required-when rule builder (e.g. service = CUSTOMS AND movement IN (IMPORT, TRANSIT)), reviewer scope, has-expiry, help text (ar/en shown in the app).
- Changes reach apps via ETag caching (≤ 1 h). "Publish now" invalidates the cache version.

## D32 — Terms and policies
- **Audiences:** Customer, Supplier, Provider, Purchase (marketplace), Insurance, Privacy.
- **Version list per audience and locale:** version, status (Draft / Pending approval / Published / Retired), published at, requires re-consent (yes/no), legal sign-off (name, date, file).
- **Editor:** markdown with preview (mobile-sized preview in RTL and LTR), summary items (the cards shown in A07, e.g. *"Freight / transport 10%; customs / storage 20%"*), diff against the previous version.
- **Publish:** maker-checker. It requires the legal sign-off record (D-22). Optionally it forces re-consent at next login for the audience.
- **Consent search** (shared with the audit module): by org, user, key, version, date, context reference.

## D33 — Notification templates
- Keyed templates per channel (push, SMS, email, in-app) and locale.
- Editor with variables list (e.g. `{reference}`, `{providerName}`, `{amount}`), preview with sample data, character counter for SMS (Arabic UCS-2: 70 chars/segment), and "Send test to me".
- Validation: all variables used exist, both locales present, SMS length warning.
- Transactional templates (OTP, payment) require maker-checker to change.

## D34 — FAQs and banners
- **FAQs:** categories, question/answer (ar/en), order, visibility per workspace. Shown in the app help centre (G18).
- **Banners:** in-app announcement cards on the home screens (per workspace, city or service), schedule (start/end), priority, deep link, and a dismissible flag. Preview per locale.

## D35 — Broadcasts (Phase 4)
- Segmented push/in-app messages. Segments: workspace, city, activity, last active, has open orders.
- Scheduling, estimated reach, and approval for > 1,000 recipients (maker-checker).
- Quiet hours respected, marketing opt-outs honoured, and no SMS for marketing without consent.

## D36 — Rules
| Rule set | Editable fields | Control |
|---|---|---|
| Cancellation rules | Stage mapping per service → outcome (fee %, `REQUIRES_REVIEW`, not allowed), return-cost flag, effective dates | Maker-checker, simulation tool: "given order X at milestone Y → outcome" |
| Return policy | Return window days (3), damage report window hours (24), reasons, cost bearer per reason | Maker-checker |
| Auto-acceptance (D-10) | Enabled, hours after POD (72), reminder schedule | Maker-checker |
| Matching | Request validity days (7), default and min/max quote validity, notification digest thresholds | Admin |
| Thresholds | Maker-checker amounts (refund, cancellation), payout hold after IBAN change (48 h) | Super admin |
| Document requirements | Required-document matrix per workspace/activity (KYB) and per service/movement (orders) | Admin |
| Upload limits | Max size (10 MB), allowed types | Admin |

Every rule set shows its version history and the effective version for "now".

## D37 — Business calendar
- A holiday calendar (date, name ar/en) used for T+3 business-day settlements and SLAs. Weekend = Friday and Saturday (configurable).
- Yearly setup reminder: add Eid dates once announced (they depend on moon sighting, so they're entered manually), National Day (23 Sep) and Founding Day (22 Feb).
- A preview tool answers "payable date if completed on …".

## D38 — Feature flags and app config
- **Flags:** name, description, scope (global / environment / workspace / city / org allow-list / percentage), state, owner. Examples: `service.customs.enabled`, `service.warehousing.enabled` (D-25), `marketplace.checkout.enabled`, `marketplace.premoderation`, `payments.applePay`, `insurance.enabled`, `businessFinance.enabled`, `autoAcceptance.enabled`.
- **Kill switches** (payments, new requests per service, checkout) sit at the top with a confirmation and an incident note.
- **App config:** min app version (iOS/Android), recommended version, maintenance mode + message (ar/en), support phone/WhatsApp/email, upload limits.
- Every change is audited, and critical flags require a reason.

## Acceptance criteria
- [ ] No hard deletes of referenced data. Deactivation keeps history valid.
- [ ] Terms can't be published without the legal sign-off record and a checker approval.
- [ ] Rule changes are versioned with effective dates, and the simulation tool matches backend behaviour.
- [ ] Templates can't be saved missing a locale or with unknown variables.
