# Backend — Testing and Quality

## 1. Test pyramid

| Layer | Tooling | Scope | Gate |
|---|---|---|---|
| Unit | Jest | Domain logic: state machines, money/VAT/commission math, cancellation rule engine, business-day calendar, reference generators, matching rules | PR, ≥ 90% line coverage on `domain/` folders |
| Integration | Jest + Testcontainers (Postgres+PostGIS, Redis, MinIO) | Repositories, transactions, outbox, job processors, webhooks with recorded payloads | PR |
| API / e2e | Supertest against the app + seeded DB | Full journeys per role through HTTP (see §3) | PR (smoke subset), main (full) |
| Contract | OpenAPI diff + generated client compile in app/dashboard | Prevents breaking clients | PR |
| Integration fakes | In-repo fakes for gateway, SMS, FCM, maps, Fasah, ZATCA | Deterministic tests, and failure injection (timeouts, 5xx, bad signatures) | PR |
| Load | k6 | OTP, quotes list, tracking ingest and fan-out, marketplace search, checkout | Before each phase release |
| Security | ZAP baseline scan, authz test matrix, dependency and SAST scans | IDOR/tenant isolation, auth flows | Nightly + before release |

## 2. Must-have test suites

### 2.1 Money and finance (property-based with `fast-check`)
- VAT at 15% on every line, with half-up rounding to the halala. The sum of lines equals the total, and the total never drifts.
- Commission per category (10% / 20% / 3.5% under current rules) on the agreed base (D-02). Net = gross − commission − commission VAT (if applicable).
- The ledger balances for every transaction (Σ debits = Σ credits) and account balances reconcile with settlements and payouts.
- Partial refund plus cancellation fee: refunded + retained = paid, always.
- Examples from the client PDFs are regression fixtures:
  - Transport: 2,400 + 360 VAT = 2,760 SAR, and commission 10% = 240.
  - Marketplace: 1,200 + 200 shipping + 210 VAT = 1,610 SAR, and commission 3.5% on 1,200 = 42, net 1,158.
  - Shipping 12,000 + 1,800 = 13,800. Warehousing 3,000 + 450 = 3,450. Customs 1,000 + 150 = 1,150.

### 2.2 State machines
- Table-driven tests: every `(state, event)` pair is either a valid transition or a `409`.
- Guards: quote validity, mandate `ACTIVE` for declaration steps, return window, stock ≥ requested release, POD before RC, and RC before settlement.

### 2.3 Cancellation rule engine
- One test per rule row (0% / 10% / 25% / 100% + return cost), plus explicit tests that the **known overlap** (accepted-but-not-dispatched) and undefined stages (storage, non-vehicle) return `REQUIRES_REVIEW` and never an automatic deduction.

### 2.4 Business-day calendar
- T+3 business days skips Friday/Saturday and admin-defined holidays (Eid al-Fitr, Eid al-Adha, National Day 23 Sep, Founding Day 22 Feb). The dates come from the admin-managed calendar, not hard-coded.

### 2.5 Authorization matrix
- An automated matrix of roles × endpoints × ownership (own org, other org, matched provider, unmatched provider, driver assigned/unassigned, staff roles). Every cell asserts allow, deny or 404.
- Provider-private fields (`internal_cost`, `target_margin`) never appear in customer responses (snapshot tests on serializers).

### 2.6 Idempotency and concurrency
- Double-submit accept-quote, checkout, RC and refund: exactly one effect.
- Two customers cannot reserve the last stock unit. Two releases cannot exceed available pallets.
- Webhook duplicates and out-of-order delivery (FAILED after PAID must not downgrade).

### 2.7 Localization
- Every error code, notification template and PDF template exists in `ar` and `en` (a CI check fails on missing keys).
- Arabic PDF rendering snapshot tests for invoices and settlement statements.

## 3. End-to-end journey suites (API level)

Each suite runs in Arabic and English locales, as the client's release criteria require:

1. Sign-in → role selection → customer registration → business verification → approval.
2. Provider registration → licences → terms consent → approval → activity active.
3. Shipping (sea, FCL, door-to-door + linked customs) → quotes → accept → pay → milestones → POD → RC → settlement.
4. Transport (domestic, car carrier variant, cross-border variant) → driver assignment → GPS → POD → RC → rating.
5. Warehousing → quote → intake → partial release → final release → reconciliation → closure.
6. Customs import → documents → rejection and replacement → broker authorization → declaration → release → linked transport.
7. Marketplace → search → cart (MOQ) → checkout → supplier fulfilment → linked transport → RC → return (accepted) → refund → supplier settlement adjusted.
8. Cancellation at each stage, including the review path, with refund.
9. Insurance request → quote → pay → issue → claim.
10. Failure paths: payment failed (X07), quote expired, OTP expired (X08), invalid file, integration outage.

## 4. Release acceptance criteria (from the client roadmap, made measurable)

- [ ] Every service and role passes its e2e suite end to end in Arabic and English.
- [ ] Upload validation: type, size (10 MB), antivirus, replacement flow.
- [ ] Financial calculations match fixtures, and ledger reconciliation passes on a staging dataset.
- [ ] Customer-data protection: the authz matrix is green, and no PII appears in logs (log scan).
- [ ] Payment failure, gateway timeout and duplicate webhooks are handled without double charges.
- [ ] Integration outages (SMS, gateway, maps, Fasah) degrade gracefully with manual fallbacks.
- [ ] Refunds reconcile with gateway reports.
- [ ] p95 latency and error-rate SLOs are met under load profile §6 of the infra doc.
- [ ] Zero open critical or high security findings.

## 5. Code quality

- ESLint (typescript-eslint strict) + Prettier. Import boundaries between modules enforced with `eslint-plugin-boundaries`, so a module may only import another module's public `index.ts`.
- Conventional commits, PR template with a checklist (tests, migration, OpenAPI change, i18n keys, audit events).
- Two approvals for changes in `payments/`, `ledger/`, `settlements/`, `auth/` and `authz/` (CODEOWNERS).
- Architecture Decision Records (ADRs) in `apps/backend/docs/adr/` for each decision taken from the decisions log.
