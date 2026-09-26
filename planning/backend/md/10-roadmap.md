# Backend — Roadmap

Phases are shared with the app and dashboard (see [planning/README.md](../../README.md#5-delivery-phases-shared-by-all-tracks)).
Sizing is in **developer-weeks (dw)** and is indicative. It assumes 3 backend engineers familiar with NestJS, with design and decisions delivered on time. External approvals (gateway contract, SMS sender ID, Fasah) are outside these estimates.

## Phase 0 — Foundations (≈ 3 weeks calendar)

| Epic | Scope | dw | Depends on |
|---|---|---|---|
| B0.1 Repo and tooling | pnpm/Turborepo monorepo, NestJS skeleton, lint/format, commit hooks, CODEOWNERS | 2 | T-08 |
| B0.2 Local and cloud envs | Docker Compose stack, Terraform for dev/staging, CI pipeline, secrets | 3 | T-03, D-23 |
| B0.3 Common layer | Error model, i18n, money type, business-day calendar, reference generator, pagination, idempotency interceptor | 2 | — |
| B0.4 Persistence and events | Prisma setup, base schema, outbox + relay, BullMQ, audit log | 2 | T-02 |
| B0.5 Observability | pino, OTel, Sentry, health checks | 1 | — |
| B0.6 Reference data | Tables, seeds (cities, ports, checkpoints, vehicle/container/storage types, document types), read APIs with ETag | 2 | — |

**Exit:** a deployable hello-world in dev and staging, a green CI pipeline, seeded reference data, and D-02/D-03/D-04/D-05/D-23/T-01 decided.

## Phase 1 — Access and transaction core (≈ 10 weeks)

| Epic | Scope | dw |
|---|---|---|
| B1.1 Auth | OTP request/verify, SMS adapter, JWT and refresh rotation, sessions, rate limits | 3 |
| B1.2 Identity and orgs | Users, organizations, memberships, workspaces, org-context guard, CASL policies | 3 |
| B1.3 KYB and terms | Business profile, activities, licences, bank accounts, verification cases, terms versions, consent audit, admin review APIs | 4 |
| B1.4 Files (basic) | Pre-signed upload/download, antivirus scan, document entity (upload + attach) | 2 |
| B1.5 Requests | Draft/step/submit for all four services, per-service validation, linked requests | 5 |
| B1.6 Matching and opportunities | Matching rules, provider feed, request visibility (D-16), clarification Q&A | 3 |
| B1.7 Quotes | Submit/revise/withdraw, expiry jobs, customer comparison (sort/filter), commission preview | 3 |
| B1.8 Payments v1 | Gateway adapter, payment intents, hold/accept flow, webhooks, verify, failure handling | 4 |
| B1.9 Orders v1 | Order creation on payment, follow-up view, provider confirm readiness, allowedActions | 3 |
| B1.10 Notifications v1 | In-app notification center, push (FCM), SMS templates, realtime gateway | 3 |
| B1.11 Messaging v1 | Order and pre-award conversations, attachments, contact masking | 2 |
| B1.12 Admin APIs v1 | Staff auth + 2FA, RBAC, KYB queue, orgs, requests/orders monitor, reference data CRUD, feature flags | 4 |
| **Total** | | **≈ 39 dw** |

**Exit:** a customer can request any service, receive quotes and pay. The provider sees the confirmed order. Staff can verify businesses.

## Phase 2 — Execution and documents (≈ 10 weeks)

| Epic | Scope | dw |
|---|---|---|
| B2.1 Documents v2 | Required-document checklists per service/movement, review workflow, versions, rejection reasons | 3 |
| B2.2 Milestones and tracking | Templates per service, milestone API with source, timeline, realtime | 3 |
| B2.3 Shipping execution | Freight booking, B/L/AWB/container/seal references, D2D final leg link | 2 |
| B2.4 Transport execution | Fleet, drivers, assignment, driver API, GPS ingest and fan-out, trip issues, border stage | 4 |
| B2.5 Warehousing execution | Intake slots, stock intake and count, inventory balances, release requests, reconciliation | 4 |
| B2.6 Customs execution | Broker file review, authorization lifecycle, declaration updates, release notice, clearance confirmation, `ManualFasahAdapter` | 4 |
| B2.7 POD, RC, rating | Completion evidence, receipt confirmation, damage/shortage reports (24 h window), auto-acceptance (D-10), ratings | 3 |
| B2.8 Ledger and settlements | Double-entry ledger, commission rules, settlement scheduling (T+3 business days), holds | 4 |
| B2.9 Payouts | Payout batches, bank file export, mark paid (TRX), failures, statements (PDF) | 2 |
| B2.10 Invoicing | Invoice/credit note generation per D-03, PDF (Arabic), ZATCA integration or partner | 4 |
| B2.11 Cancellations and refunds | Rule engine, preview, review queue, partial refunds via gateway, ledger postings | 3 |
| B2.12 Cases | Case entity, SLA, assignment, conversation, linking | 2 |
| B2.13 Additional charges | Proposal/approval/payment of extras | 1 |
| B2.14 Insurance (ops MVP) | Insurers, requests, manual quotes, policy upload, claims | 2 |
| **Total** | | **≈ 41 dw** |

**Exit:** full service lifecycles for all four services, from request to provider payout, with cancellations, refunds and disputes.

## Phase 3 — Marketplace and supplier (≈ 8 weeks)

| Epic | Scope | dw |
|---|---|---|
| B3.1 Catalog | Categories, products, images (moderation), specs, stock, MOQ, publish/pause, favorites | 3 |
| B3.2 Search | FTS with Arabic normalization, filters (city, price, MOQ, availability, verified), sort | 2 |
| B3.3 Cart and checkout | Per-supplier carts, save for later, MOQ/stock validation, delivery pricing (D-15), PO creation, payment | 4 |
| B3.4 PO fulfilment | Supplier accept/prepare/readiness/handover, linked transport order creation | 3 |
| B3.5 Returns | Return requests, supplier decisions, escalation, return pickup, refunds/replacements | 3 |
| B3.6 Supplier settlements | Return-window hold (D-11), adjustments, statements | 2 |
| B3.7 Supplier dashboard APIs | KPIs (new orders, active listings, receivables) | 1 |
| B3.8 Marketplace admin APIs | Product moderation, category management, supplier oversight | 2 |
| **Total** | | **≈ 20 dw** |

## Phase 4 — Integrations and partnerships (≈ 8+ weeks, approval-dependent)

| Epic | Scope | dw |
|---|---|---|
| B4.1 Fasah integration | Per the client's 4 stages: scope → sandbox → security review → production | 6+ |
| B4.2 Wathq CR + National Address verification | Auto-verification in KYB | 2 |
| B4.3 Insurance partnership APIs | If partnerships are signed (D-07) | 3+ |
| B4.4 Business finance | Partner integration, eligibility (D-06) | 3+ |
| B4.5 Automated payouts | Bank or gateway payouts API | 2 |
| B4.6 Business web portal APIs | Bulk product upload (CSV), provider desktop views | 3 |
| B4.7 Scale and hardening | Read replicas, partitioning, search engine upgrade (T-06), perf tuning | 3 |

## Milestones

| Milestone | Target (from Phase 0 start) |
|---|---|
| M1: internal demo, request → quote → pay | Week 11 |
| M2: closed pilot (transport + shipping, selected providers) | Week 21 |
| M3: all services live behind flags | Week 24 |
| M4: marketplace live | Week 32 |
| M5: integrations (as approvals allow) | Week 40+ |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| D-03/D-04 undecided | Blocks payments and invoicing design | Escalate in Phase 0; design the ledger so both models are possible |
| Gateway contract/KYC delays | Blocks the Phase 1 exit | Start merchant onboarding in Phase 0; use sandbox meanwhile |
| SMS sender ID registration delay | Blocks OTP in production | Apply in Phase 0; test with allow-listed numbers |
| Fasah access not granted | Customs stays manual | Manual adapter with source labels (already planned) |
| Provider supply at launch | Requests with zero quotes | Phased launch per service/city (D-25); ops can view zero-quote requests |
| Scope creep from 110 screens | Delays | Freeze scope per phase; gaps go into the backlog |
