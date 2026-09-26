# Dashboard Module 01 — Home and KPIs (D01)

Backend: `GET /admin/metrics/overview`, queue counters (see [admin module §4–5](../../../backend/md/modules/16-admin-audit-reporting.md#4-metrics-and-reporting)).

## Purpose
Give each staff role an at-a-glance view of **what needs action now** (queues), then **how the business is doing** (KPIs). The content adapts to permissions.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Filters: date range (today / 7d / 30d / custom) · service · city        │
├──────────────────────────────────────────────────────────────────────────┤
│ ACTION QUEUES (cards with count + oldest age + SLA colour)              │
│ KYB pending · Zero-quote requests · Readiness overdue · Stale GPS       │
│ Cancellation reviews · Cases breaching · Payouts due today · Approvals  │
├──────────────────────────────────────────────────────────────────────────┤
│ KPIs (tiles with trend vs previous period)                             │
│ GMV · Commission revenue · Paid orders · Completion rate · Avg quotes  │
│ per request · Time to first quote · Active providers · New customers   │
├──────────────────────────────────────────────────────────────────────────┤
│ Funnel: drafts → submitted → quoted → accepted → paid → completed      │
│ Orders by service (stacked bars) · Orders by status                    │
│ Top cities / lanes · Provider supply by activity & city (heat table)   │
├──────────────────────────────────────────────────────────────────────────┤
│ Marketplace (Phase 3): GMV, POs, listings, return rate, top categories │
└──────────────────────────────────────────────────────────────────────────┘
```

## Queue cards

| Card | Definition | Click-through | Visible to |
|---|---|---|---|
| KYB pending | Verification cases `SUBMITTED`/`UNDER_REVIEW`, oldest age vs the 1-business-day SLA | D10 | KYB, Ops, Super admin |
| Zero-match / zero-quote | Requests with no match, or no quotes after 24 h | D03 filtered | Ops |
| Readiness overdue | Orders `CONFIRMED` > 24 h without provider readiness | D05 filtered | Ops |
| Awaiting acceptance > 72 h | Orders after POD without RC (D-10 context) | D05 filtered | Ops, Support |
| Stale GPS | Active trips without location > 30 min | D07 | Ops |
| Authorizations to verify | Customs authorizations set `ACTIVE` by brokers, not yet spot-checked | D08 | Ops |
| Cancellation reviews | `UNDER_REVIEW` count + oldest | D21 | Ops, Support, Finance |
| Cases breaching SLA | Open cases past `sla_due_at` | D20 | Support, Ops |
| Payouts due today | Settlements `SCHEDULED` with `payable_on ≤ today` not in a batch | D26 | Finance |
| Failed payouts | Settlements `FAILED` | D26 | Finance |
| Approvals waiting for me | Maker-checker items where I'm an eligible checker | D02 | Checkers |
| Licences expiring (30 d) | Licences with `expires_at` within 30 days | D12 | KYB |
| Product moderation | Products `PENDING_REVIEW` / flagged | D16 | Content, Ops |

Colour thresholds: green within SLA, amber within 20% of SLA, red past SLA. Counters update in realtime via `staff:ops`.

## KPI definitions (must match the finance and reporting modules)

| KPI | Definition |
|---|---|
| GMV (services) | Σ `total_amount` of orders with a `PAID` payment in the period (VAT included). Excludes refunded amounts in the "net GMV" variant |
| Commission revenue | Σ commission amounts on orders/POs completed in the period (ex-VAT) |
| Paid orders | Count of orders confirmed (paid) in the period |
| Completion rate | Completed ÷ (completed + cancelled) for orders closed in the period |
| Avg quotes per request | Σ quotes ÷ submitted requests (period of submission) |
| Time to first quote | Median minutes from `submitted_at` to the first quote |
| Zero-quote rate | Requests expired or cancelled with 0 quotes ÷ submitted |
| Active providers | Providers with ≥ 1 quote or job in the period, per activity |
| On-time rate | Orders delivered (POD) on or before the quoted ETA ÷ delivered |
| Cancellation rate | Cancelled orders ÷ paid orders (by who initiated) |
| New customers | Organizations with a first paid order in the period |
| Marketplace return rate | Returns resolved as accepted ÷ POs received |

All KPIs can be exported as CSV and carry a "data as of HH:MM" stamp (materialized views refresh every 15 min).

## Acceptance criteria
- [ ] Queue counts equal the filtered list counts on click-through.
- [ ] KPIs reconcile with finance reports for the same period (spot-check).
- [ ] Cards are hidden according to permissions, and the page works in ar and en.
