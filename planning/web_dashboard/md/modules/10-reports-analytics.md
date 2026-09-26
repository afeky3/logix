# Dashboard Module 10 — Reports and Analytics (D40)

Backend: [admin-audit-reporting](../../../backend/md/modules/16-admin-audit-reporting.md#4-metrics-and-reporting). Decision D-W09 (built-in reports + Metabase on a replica).

## 1. Report catalog (built-in, exportable CSV/XLSX)

| Report | Audience | Key columns / measures | Filters |
|---|---|---|---|
| Orders register | Ops, Finance | Reference, service, customer, provider, dates (created/paid/completed), status, amounts (fee, VAT, total), commission, settlement status | Period, service, status, city, provider |
| Requests funnel | Ops, Product | Drafts, submitted, quoted, accepted, paid, completed; conversion %; time to first quote | Period, service, city |
| Provider performance | Ops | Quotes sent, win rate, avg price vs median, readiness time, on-time %, cancellations, disputes, rating | Period, activity, city |
| Supplier performance | Ops, Marketplace | Listings, POs, fulfilment time, on-time readiness, return rate, rating | Period, category |
| Commission report | Finance | Per order/PO: base, rate (rule version), commission, commission VAT; totals by category | Period, category |
| VAT report | Finance | Commission VAT (and service VAT under the principal model), credit notes | Period (monthly/quarterly) |
| Settlements and payouts | Finance | Settlement lines, payable dates, batches, TRX refs, failures | Period, status, beneficiary |
| Refunds | Finance, Support | Refund amounts, reasons, linked cases/cancellations, turnaround | Period, reason |
| Payables aging | Finance | Provider/supplier payables by age bucket | As-of date |
| Gateway reconciliation | Finance | Matched/unmatched items per day | Period |
| KYB operations | Compliance | Cases by status, median review time, first-time-right, rejection reasons | Period, workspace |
| Licence expiries | Compliance | Upcoming and expired licences, suspensions | Window |
| Cases and SLA | Support | Volume by type, first response and resolution times, breaches, outcomes | Period, type |
| Cancellations | Product, Finance | By stage, initiator, outcome (auto/review), fee amounts (feeds D-01 policy) | Period, service |
| Marketplace sales | Marketplace | GMV, POs, AOV, top categories/products/suppliers, return rate | Period, category, city |
| Insurance ops | Ops | Requests, quotes, issued, claims outcomes, turnaround | Period, insurer |
| Consent audit export | Legal | Consents by key/version/date | Period, audience |

- Exports run as async jobs: "Your report is ready" notification + download link valid 24 h. Every export is audit-logged (who, what filters, row count).
- PII columns are excluded or masked by default. Unmasked exports require `pii.reveal` + a reason, and are watermarked in the file metadata.
- Scheduled reports (e.g. weekly finance pack every Sunday 08:00) are emailed to staff distribution lists.

## 2. Analytics (Phase 2+ via Metabase, Phase 4 warehouse)
- **Metabase** (self-hosted) connects to a **read replica** through **masked SQL views** (no raw PII, no document keys).
- **Curated dashboards:**
  - Executive (GMV, revenue, growth)
  - Supply & demand heatmaps by city/lane
  - Operations (SLA, delays, stale GPS)
  - Marketplace
  - Finance
- **Phase 4:** stream domain events to a warehouse (BigQuery/Redshift/ClickHouse) for cohort, retention and LTV analysis, and join with app analytics (PostHog/Amplitude) by pseudonymous IDs.

## 3. Metric governance
- One metrics dictionary (definitions in [modules/01-home-kpis.md](01-home-kpis.md)) is used by D01, reports and Metabase. Changes are recorded with dates.
- Numbers are stamped with "data as of" and the refresh cadence.
- Finance reports are the source of truth for money. KPI tiles link to the underlying report for reconciliation.

## Acceptance criteria
- [ ] Each report's totals reconcile with the ledger/order tables for a sample period.
- [ ] Exports respect permissions and PII masking, and are audited.
- [ ] Scheduled reports deliver on time with correct period boundaries (Riyadh time).
