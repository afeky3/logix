# Master Decisions Log

The single list of open decisions for the whole system. App- and dashboard-specific UI decisions live in their own tracks and link back here.

- **Source:** `Client` = flagged in the client PDFs; `New` = found during planning.
- **Blocks:** the phase that cannot start (or ship) without the decision.
- **Status:** all items are `OPEN` until the owner signs off. Record the outcome here and add an ADR.

## 1. Summary

| ID | Decision | Source | Owner | Blocks | Recommendation (short) |
|---|---|---|---|---|---|
| D-01 | Cancellation fee overlap and missing milestones | Client | Product + Legal | Phase 2 | Stage-based rules keyed to milestones; human review for ambiguous cases |
| D-02 | Commission and tax base | Client | Finance + Tax advisor | Phase 1 (quote preview) | Commission on pre-VAT service fee; VAT on commission; pass-through costs excluded |
| D-03 | Merchant of record and invoicing / ZATCA responsibility | New | Finance + Tax + Legal | Phase 1 | Decide agent vs principal model before building invoices |
| D-04 | Funds flow and payment licensing | New | Finance + Legal | Phase 1 | Use a gateway marketplace/split capability or a licensed partner |
| D-05 | Payment gateway and methods | New | Finance + Tech | Phase 1 | Shortlist Moyasar / HyperPay / Tap; mada + cards + Apple Pay at launch |
| D-06 | Business finance (B2B BNPL) | Client | Business | Phase 4 | Out of MVP; hide the option until a partner is contracted |
| D-07 | Insurance operating model and licensing | Client/New | Business + Legal | Phase 4 (ops MVP in Phase 2) | Ops-driven referral records only; no premium collection until licensed model confirmed |
| D-08 | Broker authorization confirmation authority | Client | Product + Ops | Phase 2 | Broker sets ACTIVE with official reference; ops spot-checks |
| D-09 | Fasah integration scope and access | Client | Business + Tech | Phase 4 | Manual status updates with clear source labels until approved |
| D-10 | Auto-acceptance after POD | New | Product + Legal | Phase 2 | Auto-accept 72 h after POD with 2 reminders, unless a report is open |
| D-11 | Supplier settlement vs return window | New | Finance + Product | Phase 3 | Hold settlement until the 3-day return window closes |
| D-12 | Warehousing billing and settlement cadence | New | Product + Finance | Phase 2 | Pay per contracted term upfront; settle monthly for terms > 30 days |
| D-13 | Shipping-land vs Transport cross-border overlap | New | Product | Phase 1 | Shipping-land = forwarder-managed freight; Transport = dedicated vehicle hire |
| D-14 | Cancellation fee split and refund timing | New | Finance + Legal | Phase 2 | Fee goes to provider minus commission; refunds within 14 days to original method |
| D-15 | Marketplace delivery pricing | New | Product | Phase 3 | Supplier-set delivery fee or pickup in v1; Logix instant rate later |
| D-16 | Pre-award data visibility and anti-circumvention | New | Product + Legal | Phase 1 | Hide customer identity and documents pre-award; mask contacts in messages |
| D-17 | Customer verification level | New | Product + Legal | Phase 1 | Individuals: phone + name (+ ID for customs); companies: KYB before first paid order |
| D-18 | Matching, request and quote validity rules | New | Product | Phase 1 | Notify all matching providers; request valid 7 days; quote default 48 h |
| D-19 | Multi-user organizations | New | Product | Phase 1 (data model) | Model supports teams; MVP UI = owner + drivers |
| D-20 | Transport broker subcontracting | New | Product | Phase 2 | MVP: broker enters external carrier details; platform subcontracting later |
| D-21 | Returns and damage-report specifics | Client | Product + Legal | Phase 3 | 24 h damage report on RC; 3-day return window; cost bearer per reason |
| D-22 | Final legal text of terms and privacy policy | Client | Legal | Launch | Versioned terms module; content approved before production |
| D-23 | Hosting region and data residency (PDPL) | New | Legal + Tech | Phase 0 | KSA-hosted region unless legal confirms otherwise |
| D-24 | Design source of truth and screen IDs | New | Product + Design | Phase 0 | V2 workflows = functional truth; final Figma = visual truth |
| D-25 | MVP launch scope | New | Business | Phase 1 | Build all four services; launch behind per-service flags |
| D-26 | Supported geographies and users | New | Business | Phase 1 | Saudi mobile numbers only; foreign origins allowed as locations |
| D-27 | Reference prefixes per service | New | Product | Phase 1 | Single `LX-` prefix for all service orders |
| D-28 | Ratings visibility and moderation | New | Product | Phase 2 | Stars public; comments moderated; two-way rating later |
| T-01 | Mobile framework | New | Tech | Phase 0 | React Native (Expo), shares TypeScript with backend and dashboard |
| T-02 | ORM | New | Tech | Phase 0 | Prisma |
| T-03 | Cloud provider | New | Tech + Finance | Phase 0 | Constrained by D-23 |
| T-04 | SMS provider | New | Tech | Phase 1 | Local provider with registered sender ID (Unifonic / Taqnyat / Msegat) |
| T-05 | Maps provider | New | Tech | Phase 1 | Google Maps Platform (Arabic coverage), with caching and caps |
| T-06 | Search engine | New | Tech | Phase 3 | Postgres FTS in v1; Meilisearch/OpenSearch when catalog > 50k items |
| T-07 | Dashboard UI stack | New | Tech | Phase 0 | Next.js + shadcn/ui + TanStack Table (RTL via logical properties) |
| T-08 | Monorepo tooling | New | Tech | Phase 0 | pnpm + Turborepo |
| T-09 | Driver GPS frequency and background tracking | New | Tech + Product | Phase 2 | 15 s while trip active, significant-change in background |

## 2. Details

### D-01 Cancellation fee overlap (Client)
The supplied rules are 0% before acceptance or dispatch; 10% after acceptance, before arrival; 25% after arrival or customs start; and 100% plus return costs after pickup/transport start. An order that is **accepted but not dispatched** matches both 0% and 10%. There are also no milestones for storage or other non-vehicle services.
**Proposal:**
- 0% while the request has no paid order.
- 0% after payment until the provider confirms readiness (`SCHEDULED`).
- 10% from `SCHEDULED` until `ARRIVED_AT_PICKUP` or equivalent.
- 25% from arrival/customs start (`ARRIVED_AT_PICKUP`, `DECLARATION_SUBMITTED`).
- 100% + return cost from `CARGO_COLLECTED`, `DEPARTED` or `PICKED_UP`.
- Warehousing: 0% before intake slot confirmation, 10% before goods received, then pro-rata for the elapsed term plus handling. This needs sign-off.

Until the policy owner approves, the engine returns `REQUIRES_REVIEW` for every ambiguous stage (the client's instruction).

### D-02 Commission and tax base (Client)
Questions to settle:
- Is commission computed on the pre-VAT service fee or on the total?
- Does it include government charges and pass-through costs (customs duties, port fees)?
- Is VAT charged on the commission to the provider or supplier?
- Rounding rules.

**Recommended default** (implemented behind config):
- Commission is charged on the pre-VAT service fee and taxable charges only.
- Duties and pass-throughs are excluded and itemized separately (CU09: *"Broker fees and duties itemized separately"*).
- VAT at 15% applies on the commission.
- Rounding is per line, half-up to the halala.

### D-03 Merchant of record and invoicing (New, high impact)
The client terms describe Logix as a *digital intermediary*, yet DONE screens offer "Download PDF invoice". Someone must issue ZATCA-compliant tax invoices. There are two options:
- **Agent model:** the provider or supplier issues the tax invoice for the service or goods (Logix can generate it on their behalf only if a compliant arrangement exists). Logix issues a commission invoice to the provider or supplier.
- **Principal model:** Logix invoices the customer for the full amount and receives invoices from providers.

This decision shapes the ledger accounts, VAT reporting, e-invoicing integration (Phase 2 clearance/reporting) and the payout statement. **It must be decided with a tax advisor before Phase 1 payment work.**

### D-04 Funds flow and licensing (New, high impact)
Customer money is collected in-app and paid out to providers T+3 business days after acceptance. Holding third-party funds may require a licensed arrangement. Options:
- (a) a gateway marketplace/split-payment product where funds settle to sub-merchants,
- (b) a licensed payment facilitator or escrow partner,
- (c) Logix as principal (ties to D-03).

Confirm with legal and the gateway before signing a contract.

### D-05 Payment gateway (New)
Selection criteria:
- mada + Visa/MC + Apple Pay (STC Pay optional)
- 3DS2 and tokenization
- partial refunds via API
- reliable webhooks with a retrieve API
- marketplace/split support (D-04)
- settlement reports API
- a React Native SDK or hosted/3DS web flow
- fees
- Arabic payment pages

Shortlist to evaluate: Moyasar, HyperPay, Tap Payments, PayTabs, Checkout.com.

### D-06 Business finance (Client)
The option shows only for eligible companies with an approved partner. It stays out of MVP. The `BUSINESS_FINANCE` payment method is kept in the enum and hidden by a feature flag.

### D-07 Insurance (Client/New)
There are no insurer partnerships, no automatic issuance and no assumed commission (client note). Comparing or distributing insurance may require licensing. **Proposal:** Phase 2 ships an ops-driven flow in which the customer submits a request, Logix staff obtain a quote from the insurer offline, and the policy is uploaded. Premiums are paid directly to the insurer unless a licensed arrangement is confirmed.

### D-08 Broker authorization (Client)
The in-app request is not proof of Fasah activation. Who may mark it `ACTIVE`: the broker with an official reference, with ops verification on a sample basis, or ops always? The recommendation is the broker plus a mandatory reference and uploaded evidence. Ops can revert, and the source label is shown to the customer.

### D-09 Fasah (Client)
Follow the client's four-stage roadmap (confirm scope → sandbox → security review → production). The adapter interface exists from Phase 2 with a `ManualFasahAdapter`, so the UI and data don't change when the integration lands.

### D-10 Auto-acceptance after POD (New)
Without a timeout, payouts can stay stuck when customers never confirm. **Proposal:** reminders at 24 h and 48 h, then auto-accept at 72 h after POD unless a damage/shortage report or a case is open. The auto-acceptance is recorded with source `SYSTEM`. This needs legal approval against the customer terms (*"Inspect before signing…"*).

### D-11 Supplier settlement vs return window (New)
The payout is due 3 business days after buyer receipt, and the return window is 3 days after receipt. Recommendation: settle only after the return window closes with no open return. If a return is open, hold the settlement and adjust the amount.

### D-12 Warehousing billing (New)
WH07 settles "at term end or after full stock release". Open points:
- upfront vs monthly billing
- overstay beyond the end date
- additional handling services, which *require approval before charging*
- partial-month pro-rating

Proposal: the contracted term is paid upfront for terms ≤ 30 days; longer terms are billed monthly; overstay is billed daily at the quoted rate after customer approval.

### D-13 Shipping-land vs Transport cross-border (New)
SH05 (international land freight) and TR01 (cross-border scope) overlap. Proposal:
- **Shipping → Land** = freight forwarding priced by weight/pallets, where the provider chooses the carrier (may be consolidated).
- **Transport** = a dedicated vehicle of a chosen type (FTL).

The UI copy on H01/SH01/TR01 explains the difference. Matching routes Shipping-land to `FREIGHT_LAND` and cross-border transport to `TRANSPORT_*` activities.

### D-14 Cancellation fee split and refund timing (New)
Who receives the retained fee: the provider (compensation) or Logix? Is commission taken from the fee? What is the refund SLA? Proposal: the fee compensates the provider minus the platform commission, and refunds go to the original payment method within 14 days (gateway limits apply).

### D-15 Marketplace delivery pricing (New)
M07 shows "Products & shipping 1,200 + 200 SAR" (shipping via Logix). Options:
- a supplier-set delivery fee per city,
- pickup only,
- an instant Logix transport rate card,
- an auto-created transport request with quotes, which is slow for checkout.

Recommendation: v1 uses a supplier-set fee or pickup; the linked transport order is created after readiness using a pre-agreed rate (rate card) managed in the dashboard.

### D-16 Pre-award visibility (New)
The client flows let providers view request files before quoting (P02 "View files and other requests"), which can expose commercial invoices to competitors. The terms also forbid routing customers off-platform. Proposal:
- Before award, providers see the route, cargo summary, dates and document **types** present, but not files or the customer name.
- Full details are visible after payment.
- Contact details in chat and quote notes are auto-masked before award.

### D-17 Customer verification (New)
A05 is for customers and A06 is for suppliers, providers and companies. Proposal:
- Individuals verify by phone OTP plus full name, and add a national ID/Iqama only when needed (customs authorization).
- Company customers complete KYB (CR + VAT + national address) before the first paid order, and can browse and request quotes while verification is pending.

### D-18 Matching and validity (New)
Proposal:
- Broadcast to all providers with a matching approved activity and service area.
- Maximum of 1 active quote per provider per request, revisable until accepted.
- Request validity is 7 days, and the default quote validity is 48 h (the provider can choose 24–168 h).
- The customer is notified on each new quote, digested after the third.

### D-19 Multi-user organizations (New)
The data model supports multiple members with roles from day one. MVP UI: the owner, plus drivers invited by phone. Team roles (manager/member) come later.

### D-20 Transport broker (New)
PT1 lets a broker "select a qualified carrier instead of own fleet". MVP: the broker records the external carrier, vehicle and driver details and remains accountable. Later, subcontracting goes to platform carriers with a nested settlement.

### D-21 Returns and damage specifics (Client)
The 24-hour damage report (on RC) and the 3-day return window are separate rules. Still to confirm:
- who pays return logistics for each reason (seller pays for non-conforming goods per the client terms),
- the inspection-on-return step,
- whether partial refunds are allowed.

### D-22 Legal texts (Client)
The texts in the client PDFs are summaries. Full customer, supplier, provider, purchase, insurance and privacy terms must be approved by legal before production. The consent audit stores the version.

### D-23 Data residency (New)
PDPL restricts cross-border transfers of personal data. Choose a KSA-hosted region or a legally approved alternative before provisioning production.

### D-24 Design source of truth (New)
The two client PDFs use conflicting screen IDs (for example M05, S02–S07 and P01–P04 refer to different screens) and different headers and navigation (4 vs 5 tabs). Proposal: V2 Updated Workflows (110 screens) is the functional truth, and the final Figma file (to be delivered) is the visual truth. Kit IDs are mapped with the `K-` prefix in the app screen inventory.

### D-25 MVP launch scope (New)
Building all four services shares ~80% of the machinery (request/quote/order). Launching them all at once multiplies ops and provider-supply risk. Recommendation: build all four, and launch transport + shipping first behind feature flags, then customs and warehousing once provider supply is onboarded.

### D-26 Geographies (New)
Saudi +966 mobile numbers only at launch. Foreign ports and cities are allowed as origins or destinations. Foreign providers are out of scope.

### D-27 Reference prefixes (New)
The client screens mix `LX-`, `WH-` and `TR-`. Recommendation: `LX-` for all service requests and orders, with the service shown next to it. If per-service prefixes are preferred, the generator already supports prefix-per-type.

### D-28 Ratings (New)
Customers rate providers and suppliers after completion. Stars aggregate publicly and comments are moderated. Providers rating customers is for internal risk only (later).

### T-01 … T-09 (Tech)
See [01-tech-stack.md](01-tech-stack.md), [app tech stack](../../app/md/01-tech-stack.md) and [dashboard tech stack](../../web_dashboard/md/01-tech-stack.md) for rationale and alternatives.
