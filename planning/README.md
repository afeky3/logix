# Logix — Planning Documentation

Master index for the Logix system plan. The plan is split into three tracks, each with its own `md/` folder:

| Track | Folder | What it covers |
|---|---|---|
| Backend | [backend/md](backend/md/00-overview.md) | NestJS API, domain model, state machines, finance, integrations, infra |
| Mobile app | [app/md](app/md/00-overview.md) | Customer, supplier, provider and driver workspaces (110 screens) |
| Web dashboard | [web_dashboard/md](web_dashboard/md/00-overview.md) | Internal admin / operations console (not covered by the client design) |

Source material: [Clint_docs/](../Clint_docs/) (original PDFs) and the English transcriptions in [Clint_docs/clint_md/](../Clint_docs/clint_md/).

---

## 1. System in one paragraph

Logix is a Saudi B2B/B2C logistics platform. **Five services, one connected experience**: Shipping (sea/air/land/express freight), Transport (domestic and cross-border road), Warehousing, Customs clearance, and a B2B Marketplace. Customers submit a request, verified service providers compete with quotes, the customer compares, accepts and pays in-app, the provider executes and submits completion evidence, the customer confirms receipt, and the provider is settled (minus commission) within 3 business days. Suppliers list products in the marketplace; buyers purchase in-app and the order is delivered through a linked transport order.

## 2. Actors

| Actor | Where | Summary |
|---|---|---|
| Customer / buyer (individual or company) | Mobile app | Requests services, buys products, pays, tracks, confirms receipt |
| Supplier / seller (business) | Mobile app (web portal later) | Lists products, fulfils purchase orders, gets settled |
| Service provider (business) | Mobile app (web portal later) | Freight, transport (fleet or broker), warehouse, customs broker. Quotes and executes |
| Driver (member of a transport provider) | Mobile app, driver mode | Sees assigned jobs only, records trip milestones, GPS, proof of delivery |
| Logix staff | Web dashboard | KYB review, operations, finance, disputes, configuration |

## 3. Tracks and reading order

1. [backend/md/00-overview.md](backend/md/00-overview.md) → [03-domain-model.md](backend/md/03-domain-model.md) → [04-state-machines.md](backend/md/04-state-machines.md). These are the source of truth for entity names, statuses and reference numbers used everywhere else. The full database schema (PostgreSQL DDL) is in [11-database-schema.md](backend/md/11-database-schema.md).
2. [app/md/06-screen-inventory.md](app/md/06-screen-inventory.md) is the list of all screens, mapped to backend endpoints.
3. [web_dashboard/md/04-information-architecture.md](web_dashboard/md/04-information-architecture.md) is the sitemap of the admin console.
4. [backend/md/09-open-decisions.md](backend/md/09-open-decisions.md) is the **master decisions log**. Anything marked *Blocking* must be decided before its phase starts.

## 4. Global conventions (apply to all tracks)

- **Language of docs and code:** English. **Product languages:** Arabic (RTL, default) and English (LTR).
- **Screen IDs:** the V2 "Updated UI Workflows" IDs (A01, SH03, TR05, WH07, CU09, M10, S08, P03, PS2, PT3, PW2, PC3, IN4, X07, RC, DONE, POD, PAY2…) are canonical. The older "Main Screens" UI-kit IDs are mapped in the screen inventory with a `K-` prefix (e.g. `K-L01`). The two PDFs reuse the same IDs for different screens, so the prefix is required.
- **Money:** integer halalas (1 SAR = 100 halalas), currency `SAR`, VAT 15% (configurable). No floats anywhere.
- **Time:** stored in UTC, displayed in `Asia/Riyadh`. Business days are Sunday–Thursday, and admin-managed public holidays are excluded.
- **Human-readable references:** `LX-` service request/order (same reference from request through order), `PO-` purchase order, `RT-` return, `CASE-` case, `TRX-` payout transfer, `INV-` invoice, `STL-` settlement statement, and `<order>-R<n>` for warehouse releases (for example `LX-260148-R2`).
- **Consent:** never pre-selected. Every consent records the role, terms version, timestamp and order reference.
- **Illustrative data:** all prices, names and ratings in the client PDFs are samples. Nothing in them is an approved rate or tax calculation.

## 5. Delivery phases (shared by all tracks)

The build order follows the client's own guidance: *access, permissions, requests, quotes and payment first; then execution and documents; then marketplace, returns and settlements; finally approved integrations and insurance partnerships.*

| Phase | Name | Outcome |
|---|---|---|
| 0 | Foundations | Monorepo, CI/CD, environments, design tokens, auth skeleton, reference data, blocking decisions signed off |
| 1 | Access and transaction core | Sign-in/OTP, workspaces, registration and KYB, terms and consent, requests for all four services, provider opportunities, quotes, compare, accept and pay, order follow-up, notifications, basic chat. Dashboard: KYB queue, order monitor, configuration |
| 2 | Execution and documents | Document vault and review, milestones and tracking, driver mode and GPS, POD, receipt confirmation, rating, invoices, cancellations and refunds, settlements and payouts. Dashboard: finance and cases |
| 3 | Marketplace and supplier | Listings, search, cart and checkout, purchase orders, supplier fulfilment, linked transport, returns, supplier settlements |
| 4 | Integrations and partnerships | Fasah (when approved), insurance partnerships, business finance, telematics, business web portal, hardening |

Per-track task breakdowns: [backend roadmap](backend/md/10-roadmap.md) · [app roadmap](app/md/09-roadmap.md) · [dashboard roadmap](web_dashboard/md/06-roadmap.md).

## 6. Proposed repository layout

```
logix/
├── apps/
│   ├── backend/          NestJS modular monolith
│   ├── mobile/           React Native (Expo) app, pending decision T-01
│   └── dashboard/        Next.js admin console
├── packages/
│   ├── api-client/       generated from the backend OpenAPI spec
│   ├── validation/       shared zod schemas (field rules used by app, dashboard, backend)
│   ├── i18n/             shared ar/en message catalogs for enums and statuses
│   ├── design-tokens/    colors, typography, spacing, icons manifest
│   └── config/           eslint, tsconfig, prettier presets
├── Clint_docs/           client PDFs + clint_md/ transcriptions
├── planning/
└── .github/workflows/
```

## 7. Status of this plan

- Version 1.0 was written from the client PDFs dated 22–24 September 2026.
- Everything not stated in the client PDFs is marked **Proposal** or **Assumption** and is tracked in the decisions log.
