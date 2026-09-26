# Mobile App — Quality, Analytics and Release

## 1. Testing strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest | Formatters (money, dates, bidi isolation), zod form schemas, state/stores, allowedActions → CTA mapping |
| Component | React Native Testing Library | Design-system components in RTL and LTR; form screens (validation, conditional fields) |
| Integration | MSW (mock service worker) against generated API types | Feature flows with mocked API: request wizard, quotes, accept & pay (fake gateway), RC |
| E2E | **Maestro** on iOS simulator + Android emulator against staging (seeded accounts per role) | Critical journeys (below) in `ar` and `en` |
| Visual | Storybook (on-device) + screenshot tests for key screens in both directions | Regression of layout |
| Manual exploratory | Test charters per release | Real devices (low-end Android included), poor network, background/foreground |

### Critical e2e journeys (Maestro)
1. Sign in → choose customer → individual account → terms → home.
2. Transport request (TR01→TRR) → submit → (seeded quote) → accept → pay (sandbox) → follow-up.
3. Shipping sea with D2D → review → submit.
4. Customs import with document upload → broker requests a change → replace document.
5. Warehousing: inventory view → release request.
6. Marketplace: search → product → cart (MOQ) → checkout → PO tracking.
7. Supplier: create listing → publish. Accept PO → readiness.
8. Provider: opportunity → quote → (accepted) → milestones → POD.
9. Driver: job → events → POD with photos and signature (offline then online).
10. RC with damage → case created. Cancellation preview → request.
11. Language switch ar ↔ en. Workspace switch.

### Device matrix
- iOS: latest and latest−2, small (iPhone SE) and large screens.
- Android: Samsung (One UI), Xiaomi, and a low-end 3 GB RAM device, on Android 8, 11 and latest.
- Network: 3G throttled, offline toggling during uploads and payments.

## 2. Performance budgets
- Cold start to interactive home: < 2.5 s on a mid-range Android.
- Screen transition: 60 fps. Lists use FlashList and memoized rows.
- Bundle: JS < 6 MB. Images are lazy-loaded via CDN thumbnails.
- Map screens: marker updates without re-rendering the whole map.
- Battery (driver): GPS strategy per T-09. Measure drain on a 2-hour trip (< 10%/hour target, to validate).

## 3. Crash and error monitoring
- Sentry with release + dist tags from EAS, source maps uploaded, and user context (user id, workspace, org id; no PII).
- Crash-free sessions target ≥ 99.5% (MVP), ≥ 99.8% after Phase 3.
- Breadcrumbs for navigation and API errors (`error.code`, `requestId`) for support correlation.

## 4. Analytics (event catalog, first version)
Naming is `object_action` with properties. No PII in properties (use IDs).

| Event | Properties |
|---|---|
| `app_opened` | `workspace`, `locale` |
| `sign_in_started` / `otp_verified` / `otp_failed` | `reason` |
| `workspace_selected` | `workspace` |
| `onboarding_step_completed` | `step` (A05…A08), `accountKind` |
| `request_started` / `request_step_completed` / `request_submitted` | `serviceType`, `step`, `mode` |
| `quotes_viewed` / `quote_compared` / `quote_accepted` | `serviceType`, `quoteCount`, `sort` |
| `payment_started` / `payment_succeeded` / `payment_failed` | `method`, `payableType`, `errorCode` |
| `order_viewed` / `tracking_viewed` / `documents_viewed` | `serviceType`, `status` |
| `document_uploaded` / `document_replaced` | `documentType`, `source` (camera/file) |
| `receipt_confirmed` | `condition` |
| `rating_submitted` | `stars` |
| `cancellation_previewed` / `cancellation_requested` | `stage`, `outcome` |
| `product_searched` / `product_viewed` / `cart_item_added` / `checkout_started` / `purchase_completed` | `categoryId`, `resultsCount` |
| `listing_published` | `categoryId` |
| `opportunity_viewed` / `quote_submitted` | `activity` |
| `milestone_recorded` / `pod_submitted` | `code`, `source` |
| `language_changed` | `from`, `to` |

Funnels: onboarding completion, request → quote → pay, marketplace search → purchase, provider opportunity → quote → win.

## 5. Release process
- **Branching:** trunk-based. Release branches `release/x.y` are cut per phase increment.
- **Versioning:** semver `x.y.z` + build number from EAS. `runtimeVersion` policy for OTA compatibility.
- **Channels:** `development`, `staging` (TestFlight/Play internal), `production`.
- **OTA (EAS Update):** JS-only fixes to `production` with staged rollout (10% → 50% → 100%) and automatic rollback if the crash rate rises. Native changes require a store release.
- **Store submission:**
  - App Store: privacy nutrition labels (location for drivers, contact info, identifiers), background location justification for drivers (usage text in ar and en), Apple Pay entitlement, review demo accounts per role.
  - Google Play: data safety form, background location declaration + video, target API level compliance.
  - Store listings in Arabic and English with screenshots (RTL first).
- **Release checklist:** e2e green in both languages, crash-free rate on staging, analytics events verified, feature flags configured, min-version decided, store notes localized, rollback plan.

## 6. Accessibility
- Every interactive element has an accessibility label (ar/en). Icons-only buttons included.
- Minimum touch target 44×44 (icons guide). Focus order follows reading direction.
- Dynamic type up to 130% without truncating primary CTAs. Color is not the only status indicator (badges have text).
- Test with VoiceOver and TalkBack in Arabic on the critical journeys.
