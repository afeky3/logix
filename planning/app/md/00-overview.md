# Mobile App — Overview

## 1. What the app is
One mobile app (iOS and Android) for every external user of Logix, organized into **workspaces** by role:

| Workspace | Users | Core jobs |
|---|---|---|
| Customer | Individuals and companies | Request shipping/transport/warehousing/customs, compare quotes, pay, track, confirm receipt, buy from the marketplace, returns, cancellations, insurance |
| Supplier | Verified sellers | Listings, inventory, purchase orders, readiness, handover, returns, settlements |
| Provider | Freight forwarders, carriers, transport brokers, warehouses, customs brokers | Opportunities, quotes, execution per service, completion evidence, settlements |
| Driver | Drivers invited by a transport provider | Assigned jobs only, trip milestones, GPS, proof of delivery |

A user can hold several workspaces (for example a company that buys and sells) and switch between them (A04, X06 "Active role — switch authorized roles").

## 2. Source designs
- **V2 Updated UI Workflows (EN)**: 110 screens, 30 journey boards. **The functional source of truth** ([Clint_docs/clint_md/logix-updated-ui-workflows-en.md](../../../Clint_docs/clint_md/logix-updated-ui-workflows-en.md)).
- **Main Screens & User Flows**: 84-screen Arabic UI kit (hi-fi components, 5-tab navigation). Used as a **visual/component reference**. Its IDs are mapped with the `K-` prefix.
- **Icons Guide (V3 handoff)**: 48 icons, usage rules.
- A final Figma file is still expected (D-24). Both PDFs note they are *"a visual review PDF, not a working app or native Figma file"*.

## 3. Scope

| In scope | Later / out of scope |
|---|---|
| All 110 V2 screens + kit-only screens that fill functional gaps (compare table, payment method, report issue, document correction, invoice view) | Web portal for suppliers/providers (Phase 4, dashboard track) |
| Arabic (RTL, default) and English (LTR) | Other languages |
| Phone OTP sign-in, multi-workspace | Social/biometric login (biometric unlock is a Phase 2 nice-to-have) |
| Live tracking for road legs, milestone journeys for sea/air | In-app calling |
| Document upload and scan (camera), photo evidence, signature capture | OCR of documents |
| Payments via the gateway SDK / 3DS | Wallet/stored balance |
| Push notifications + in-app notification center + chat | Voice notes |
| Offline drafts and retry (X08) | Full offline mode |
| Gap screens listed in [06-screen-inventory.md §4](06-screen-inventory.md#4-gap-screens-not-in-the-client-designs-need-design) | — |

## 4. Principles
1. **Server-driven state:** the app renders what the API says (`status`, `nextAction`, `allowedActions`). Business rules are not duplicated on the client, except form validation from the shared zod schemas.
2. **One pattern per concept:** request steps, quote lists, accept & pay, follow-up timeline, RC, DONE and POD are shared components reused by all four services (the client designs already reuse them).
3. **Arabic-first:** RTL layouts designed first, with mirrored icons only where directional (back-ltr/back-rtl). Never mirror the plane, truck or logo.
4. **Trust and transparency:** show the source and timestamp on tracking updates, itemized money, "illustrative" labels until approved, and consent checkboxes that are never pre-selected.
5. **Forgiving forms:** drafts saved per step, values preserved when navigating back, inline errors, and preserved data on failure (X08).
6. **Accessibility:** 44×44 minimum touch targets (icons guide), dynamic type support, labels on icons, contrast AA.

## 5. Document map

| Doc | Content |
|---|---|
| [01-tech-stack.md](01-tech-stack.md) | Framework and libraries (decision T-01) |
| [02-architecture.md](02-architecture.md) | Project structure, data layer, auth/session, realtime, offline, errors |
| [03-navigation-workspaces.md](03-navigation-workspaces.md) | Workspaces, tab bars, navigation map, deep links |
| [04-design-system.md](04-design-system.md) | Tokens, typography, components, icons |
| [05-localization-rtl.md](05-localization-rtl.md) | i18n, RTL rules, numbers, dates, currency |
| [06-screen-inventory.md](06-screen-inventory.md) | All screens, IDs, kit mapping, gaps, API map |
| [modules/](modules/) | Screen-level specs per journey |
| [07-quality-release.md](07-quality-release.md) | Testing, analytics, crash reporting, store release, OTA |
| [08-open-decisions.md](08-open-decisions.md) | App-specific decisions (links to the master log) |
| [09-roadmap.md](09-roadmap.md) | App epics per phase |

## 6. Module specs

| # | Journey | Doc |
|---|---|---|
| 1 | Access and onboarding (A01–A08) | [modules/01-access-onboarding.md](modules/01-access-onboarding.md) |
| 2 | Customer home, orders, follow-up, RC, DONE | [modules/02-customer-home-orders-completion.md](modules/02-customer-home-orders-completion.md) |
| 3 | Shipping (SH01–SH09 + quote/pay) | [modules/03-shipping.md](modules/03-shipping.md) |
| 4 | Transport (TR01–TR06 + quote/pay) | [modules/04-transport.md](modules/04-transport.md) |
| 5 | Warehousing (WH01–WH07 + quote/pay) | [modules/05-warehousing.md](modules/05-warehousing.md) |
| 6 | Customs (CU01–CU09 + quote/pay) | [modules/06-customs.md](modules/06-customs.md) |
| 7 | Marketplace, buyer side (M01–M11) | [modules/07-marketplace-buyer.md](modules/07-marketplace-buyer.md) |
| 8 | Supplier (S01–S08, SR1–SR2) | [modules/08-supplier.md](modules/08-supplier.md) |
| 9 | Provider (P01–P04, PS, PT, PW, PC, POD, PAY) | [modules/09-provider.md](modules/09-provider.md) |
| 10 | Driver mode | [modules/10-driver.md](modules/10-driver.md) |
| 11 | Insurance (IN1–IN4) | [modules/11-insurance.md](modules/11-insurance.md) |
| 12 | Cancellation and support (X01–X04) | [modules/12-cancellation-support.md](modules/12-cancellation-support.md) |
| 13 | Shared tools and system states (X05–X08) | [modules/13-shared-system-states.md](modules/13-shared-system-states.md) |
