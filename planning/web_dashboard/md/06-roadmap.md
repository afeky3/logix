# Web Dashboard — Roadmap

Aligned with the shared phases ([planning/README.md](../../README.md#5-delivery-phases-shared-by-all-tracks)). Sizing in **developer-weeks (dw)** assumes 1–2 frontend engineers, with backend admin endpoints delivered in the same phase. Indicative only.

## Phase 0 — Foundations (≈ 3 weeks)

| Epic | Scope | dw |
|---|---|---|
| W0.1 Setup | Next.js app in the monorepo, CI, Sentry, env config, deployment to dev/staging | 1 |
| W0.2 Shell and design | Layout (sidebar, topbar, breadcrumbs), tokens, shadcn theme, RTL/LTR switching, core components (DataTable, EntityHeader, StatusBadge, Money, Timeline, ReasonDialog, PiiField) | 3 |
| W0.3 Auth | Login, TOTP enrolment/verify, invite acceptance, password reset, idle timeout, `/me` permissions, route guards | 2 |

## Phase 1 — Access and transaction core (≈ 8 weeks)

| Epic | Pages | dw |
|---|---|---|
| W1.1 KYB | D10 queue, D11 case review (document viewer + item decisions), D12 licences | 3 |
| W1.2 Organizations and users | D13, D14 (overview, members, workspaces, KYB, licences, bank accounts, activities), D15 | 3 |
| W1.3 Requests and orders (read + basic actions) | D03, D04, D05, D06 (timeline, quotes, payment, documents, audit), zero-match/zero-quote queues | 4 |
| W1.4 Content v1 | D31 reference data, D32 terms (versions, publish with sign-off), D33 templates, consent search | 3 |
| W1.5 Settings v1 | D38 feature flags and app config, D39 staff and roles | 1.5 |
| W1.6 Home v1 | D01 queue counters and basic KPIs | 1 |
| **Total** | | **≈ 15.5 dw** |

## Phase 2 — Execution, finance and support (≈ 10 weeks)

| Epic | Pages | dw |
|---|---|---|
| W2.1 Order interventions | Milestone correction, force-complete/cancel (maker-checker), linked orders, additional charges view | 2 |
| W2.2 Live operations | D07 live trips map (realtime), stale GPS queue, readiness-overdue queue | 2 |
| W2.3 Customs and warehousing ops | D08 (authorization verify/revert, manual declaration updates), D09 (contracts, inventory, movements, stuck releases) | 2.5 |
| W2.4 Finance | D24 payments, D25 refunds, D26 settlements (holds), D27 payout batches (create → export → approve → mark paid), D28 invoices, D29 commission rules (maker-checker), D30 ledger and reconciliation | 6 |
| W2.5 Support | D20 cases (inbox, SLA, assignment, conversation, internal notes, resolution with financial outcome), D21 cancellation reviews, D22 conversation flags | 4 |
| W2.6 Insurance ops | D23 insurers, requests (quote entry, policy upload), claims | 2 |
| W2.7 Approvals and audit | D02 approvals inbox, D41 audit log, entity audit tabs | 2 |
| W2.8 Settings v2 | D36 rules (cancellation, returns, document requirements, thresholds), D37 business calendar | 1.5 |
| **Total** | | **≈ 22 dw** |

## Phase 3 — Marketplace (≈ 4 weeks)

| Epic | Pages | dw |
|---|---|---|
| W3.1 Catalog admin | D17 categories tree (bilingual, ordering, icons), D16 product moderation (queue, takedown with reason, flagged listings) | 2.5 |
| W3.2 Orders and returns | D18 PO list/360, D19 returns escalations (decision with refund/replacement) | 2 |
| W3.3 Marketplace KPIs | GMV, sellers, conversion, return rate on D01/D40 | 1 |
| **Total** | | **≈ 5.5 dw** |

## Phase 4 — Reports, integrations, portal

| Epic | Scope | dw |
|---|---|---|
| W4.1 Reports | D40 report catalog, scheduled exports, Metabase embedding (if D-W09) | 3 |
| W4.2 System | D42 queues/DLQ retry, webhooks replay, integrations health (Fasah, gateway, SMS, ZATCA) | 2 |
| W4.3 Broadcasts | D35 segmented push/in-app announcements with approval | 1.5 |
| W4.4 Business web portal (D-W02) | Supplier bulk listing (CSV import, validation report), provider quotes and jobs views | 6+ |

## Risks
| Risk | Mitigation |
|---|---|
| No client designs for the console | Pattern-first build (queue, 360, form) + a light Figma pass for key pages (D-W03) |
| Finance processes not defined (D-03/D-04) | Build payout batches generically (export format pluggable) and involve finance in Phase 1 reviews |
| Staff PII exposure | Masking, reveal with reason, audit, watermarking |
