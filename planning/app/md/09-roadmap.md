# Mobile App — Roadmap

Aligned with the shared phases ([planning/README.md](../../README.md#5-delivery-phases-shared-by-all-tracks)) and the [backend roadmap](../../backend/md/10-roadmap.md).
Sizing is in **developer-weeks (dw)**, assuming 2–3 mobile engineers, final designs per phase delivered 2 weeks ahead, and backend endpoints available per phase. Indicative only.

## Phase 0 — Foundations (≈ 3 weeks)

| Epic | Scope | dw |
|---|---|---|
| A0.1 Project setup | Expo app in the monorepo, EAS profiles (dev/staging/prod), env config, CI (lint, typecheck, tests, EAS build on tags) | 2 |
| A0.2 Design system v1 | Tokens, fonts, icons from the handoff (SVG components + manifest), core components (FieldRow, buttons, header, tab bar, timeline, badges, banners, bottom sheet, states) in RTL and LTR with Storybook | 4 |
| A0.3 Foundations | API client generation, interceptors, TanStack Query setup, i18n (ar/en, RTL switch), money/date/bidi helpers, error mapping, Sentry, analytics wrapper, app-config and force update | 3 |

**Exit:** a skeleton app on TestFlight/Play internal in both languages, with the component catalog reviewed by design.

## Phase 1 — Access and transaction core (≈ 10 weeks)

| Epic | Screens | dw |
|---|---|---|
| A1.1 Auth | A01, A02, A03 (OTP autofill, resend timer), session and refresh, logout | 2 |
| A1.2 Workspaces and onboarding | A04, A05, A06 (document checklist + upload), A07 (terms + consent), A08 (status + resubmit), workspace switcher (G20), X06 basics | 4 |
| A1.3 Uploads | Upload pipeline, UploadZone, DocumentRow, camera/file picker | 2 |
| A1.4 Customer home and orders | H01 (tiles, drafts, recent activity), X01 My orders, follow-up screen shell (SHF/TRF/WHF/CUF) | 3 |
| A1.5 Request wizards | Shared wizard framework (steps, drafts, back-preserve, review) + Shipping SH01–SH07/SHR, Transport TR01–TR04/TRR (map pin + route estimate), Warehousing WH01–WH02/WHR, Customs CU01–CU04/CUR | 7 |
| A1.6 Quotes | SHQ/TRQ/WHQ/CUQ list + sort, QuoteDetail (K-Q03), QuoteCompare (K-Q02), realtime "quote received" | 2 |
| A1.7 Accept and pay | SHP/TRP/WHP/CUP, PaymentMethod (K-B02), gateway SDK/3DS, polling, success, X07 failure | 3 |
| A1.8 Provider v1 | P01 (opportunities, filters), P02 (details, Q&A), P03 (quote with preview), MyQuotes (K-P08B), P04 (accepted + confirm readiness) | 4 |
| A1.9 Notifications and chat v1 | Push setup and deep links, X05 notification center, conversations inbox + chat (text + attachments) | 3 |
| **Total** | | **≈ 30 dw** |

## Phase 2 — Execution and documents (≈ 10 weeks)

| Epic | Screens | dw |
|---|---|---|
| A2.1 Order execution views | SH08 journey, SH09 documents, TR05 live map, TR06 trip progress, CU05–CU09, WH03–WH07, timeline with source/timestamp | 5 |
| A2.2 Documents v2 | Checklist per service, broker decisions (CU07), DocumentCorrection (K-D03), replace flow, document viewer | 2 |
| A2.3 Provider execution | PS1–PS3, PT1 (+ fleet G07, drivers G08), PW1–PW3 (+ sites G09), PC1–PC3, POD, active jobs (G10) | 6 |
| A2.4 Driver mode | Driver home/jobs (G23), PT2, PT3 (offline event queue), background GPS + explainer (G24), POD with photos and signature | 4 |
| A2.5 Completion | RC (photos, signature, condition), IssueReport (K-R01), DONE (rating, invoice view K-T04, reuse request), additional charge approval (G21) | 2 |
| A2.6 Cancellations and cases | X02, X03, X04, CaseDetail/list (G16), help (G18) | 2 |
| A2.7 Finance views | PAY1, PAY2, receivables list (G13), bank accounts (G04), licences (G05), activities/service areas (G06) | 2 |
| A2.8 Insurance | IN1–IN4 | 1.5 |
| **Total** | | **≈ 24.5 dw** |

## Phase 3 — Marketplace and supplier (≈ 8 weeks)

| Epic | Screens | dw |
|---|---|---|
| A3.1 Buyer discovery | M01, M02 (filters, sort), M03, M04, favorites (G14) | 3 |
| A3.2 Buyer purchase | M05 chat, M06 cart (MOQ, save for later), M07 checkout (delivery options, breakdown, pay), M08, M09 | 3 |
| A3.3 Returns | M10, M11 | 1 |
| A3.4 Supplier | S01, products list (G11), S02–S04 (photos, specs, pricing, preview/publish), PO list (G12), S05–S07, S08, SR1–SR2 | 5 |
| **Total** | | **≈ 12 dw** |

## Phase 4 — Integrations and polish

| Epic | Scope | dw |
|---|---|---|
| A4.1 Fasah status surfaces | Integration source labels, refresh flows (UI mostly ready from Phase 2) | 1 |
| A4.2 Insurance partner flows | If partnerships exist | 2 |
| A4.3 Business finance | Eligibility and payment option | 2 |
| A4.4 Enhancements | Biometric unlock, certificate pinning, performance tuning, accessibility audit fixes | 3 |

## Dependencies and risks

| Risk | Mitigation |
|---|---|
| Final Figma not ready (D-24) | Build on design-system components; V2 flows are enough for functional build; visual pass per phase |
| Gateway SDK constraints (Apple Pay, mada) | Spike in Phase 0 with the shortlisted gateways |
| Background location rejected by store review | Clear justification, explainer screen, driver-only permission, demo video |
| RTL regressions | Screenshot tests in both directions in CI |
| Scope size (110 + gaps) | Shared components for wizard/quotes/pay/follow-up/RC/DONE cut per-service cost by ~50% |
