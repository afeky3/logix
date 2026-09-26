# Web Dashboard — Overview

## 1. Why this track exists
The client designs cover the mobile experience only. The V2 PDF states *"A full web admin console is outside this file."* But the system cannot run without internal tooling. Many client rules explicitly require **human action**:

| Client rule | Needs in the dashboard |
|---|---|
| *"Business verification is conditional"*, A08 "A clearer copy is required" | KYB review queue with per-item decisions |
| *"Until resolved, use human review with no ambiguous automatic deductions"* (X03) | Cancellation review queue |
| *"Customer acceptance precedes payout"*, *"Within 3 business days"* | Settlements and payout batches |
| *"Escalate"* (SR1), *"Chat with support"* (X04) | Cases and disputes inbox |
| *"Manual updates … when integration is absent"* (Fasah) | Manual customs status and authorization verification |
| *"No insurer partnership … is assumed"* | Insurance operations (quotes, policies, claims) |
| *"Record role, terms version, consent time and order reference … final text approval is required"* | Terms versioning and consent audit |
| Commission 10% / 20% / 3.5%, illustrative VAT | Commission rules and financial reports |

This track defines that console. It must be designed from scratch (no client designs exist), following the Logix design tokens.

## 2. Users (personas)

| Persona | Primary jobs |
|---|---|
| Operations agent | Watch live requests/orders, fix stuck flows, zero-quote requests, manual milestone corrections, customs manual updates, insurance tasks |
| KYB reviewer | Review business documents and licences, approve or request changes, monitor expiries |
| Finance officer | Payments reconciliation, refunds, cancellation fees, settlements, payout batches, commission rules, invoices, VAT reports |
| Support agent | Cases, customer and provider conversations, cancellation reviews below threshold, returns escalations |
| Content manager | Reference data, categories, terms drafts, notification templates, FAQs, banners |
| Super admin | Staff, roles, feature flags, system settings |
| Auditor | Read-only access to everything including the audit log |

## 3. Scope

| Phase | Dashboard capabilities |
|---|---|
| 0 | Staff auth + 2FA, shell layout, RBAC skeleton, reference data CRUD |
| 1 | KYB queue, organizations and users, requests/orders monitor (read + basic actions), zero-match/zero-quote queues, terms and consents, feature flags, notification templates |
| 2 | Finance (payments, refunds, settlements, payout batches, commission rules, invoices), cancellation review, cases and disputes, order interventions, live trips map, customs manual ops, insurance ops, audit log UI |
| 3 | Marketplace admin (categories, product moderation, POs, returns escalations), supplier oversight |
| 4 | Reports and BI, integrations health, broadcasts, optional **business web portal** for suppliers and providers (D-W02) |

## 4. Principles
1. **Never bypass domain rules.** The dashboard calls admin endpoints that reuse the same state machines. Overrides are explicit actions with reason + audit (and maker-checker when financial).
2. **Queue-first design.** Every human task is a queue with filters, SLA timers, assignment and bulk actions where safe.
3. **Entity 360 views.** Organization, order, PO and case pages show everything linked (timeline, documents, money, messages, audit).
4. **PII by need.** Masked by default. Unmasking requires a reason and is logged.
5. **Bilingual.** The UI supports Arabic (RTL) and English. Staff choose their language. Data shows in its original language, with ar/en names for reference data side by side.
6. **Fast tables.** Server-side pagination, saved views, column chooser, CSV export (async).

## 5. Document map

| Doc | Content |
|---|---|
| [01-tech-stack.md](01-tech-stack.md) | Next.js stack (T-07) |
| [02-architecture.md](02-architecture.md) | App structure, auth, data fetching, tables and forms patterns, realtime, i18n |
| [03-roles-permissions.md](03-roles-permissions.md) | Staff roles × permissions matrix, maker-checker actions |
| [04-information-architecture.md](04-information-architecture.md) | Sitemap and navigation |
| [05-open-decisions.md](05-open-decisions.md) | Dashboard decisions |
| [06-roadmap.md](06-roadmap.md) | Epics per phase |
| [modules/01-home-kpis.md](modules/01-home-kpis.md) | Home and KPIs |
| [modules/02-verification-kyb.md](modules/02-verification-kyb.md) | Verification queue, licences |
| [modules/03-users-organizations.md](modules/03-users-organizations.md) | Organizations, users, members, fleet |
| [modules/04-requests-orders-operations.md](modules/04-requests-orders-operations.md) | Requests, orders, live ops, customs, warehousing |
| [modules/05-marketplace-admin.md](modules/05-marketplace-admin.md) | Categories, products, POs, returns |
| [modules/06-finance.md](modules/06-finance.md) | Payments, refunds, settlements, payouts, commissions, invoices |
| [modules/07-cases-disputes-support.md](modules/07-cases-disputes-support.md) | Cases, cancellations review, support inbox |
| [modules/08-insurance-ops.md](modules/08-insurance-ops.md) | Insurers, requests, policies, claims |
| [modules/09-configuration-content.md](modules/09-configuration-content.md) | Reference data, terms, templates, rules, flags, calendar |
| [modules/10-reports-analytics.md](modules/10-reports-analytics.md) | Reports and exports |
| [modules/11-audit-security-system.md](modules/11-audit-security-system.md) | Audit log, staff management, system health |
