# Mobile App — Tech Stack

## 1. Framework decision (T-01)

**Recommendation: React Native with Expo (SDK 5x, New Architecture), TypeScript.**

| Criterion | React Native (Expo) | Flutter |
|---|---|---|
| Code sharing with NestJS backend and Next.js dashboard | **High**: shared TS types, zod schemas, API client, i18n catalogs | Low: separate Dart models, codegen from OpenAPI |
| RTL / Arabic | Good (`I18nManager`, logical styles). Direction switch needs an app reload | Excellent (built-in `Directionality`) |
| Maps, camera, document scanning, background location | Mature libraries (react-native-maps, VisionCamera, expo-location with background tasks) | Mature equivalents |
| Payment SDKs (Saudi gateways) | Most provide RN SDKs or hosted 3DS pages | Most provide Flutter SDKs |
| OTA updates | **Expo Updates / EAS Update** (fix JS bugs without a store release) | Limited (Shorebird) |
| Hiring pool (region) | Large | Large |
| Performance for this app (forms, lists, maps) | Sufficient | Sufficient |

Flutter is a valid choice if the team is already Flutter-first. The rest of this plan is written framework-agnostic at the screen level, and the library list below assumes React Native.

## 2. Libraries (React Native)

| Concern | Library | Notes |
|---|---|---|
| Runtime / tooling | Expo SDK, EAS Build, EAS Submit, EAS Update | Dev client for native modules |
| Navigation | Expo Router (file-based, on React Navigation) | Typed routes, deep links |
| Server state | TanStack Query | Caching, retries, optimistic updates, offline pause |
| Local state | Zustand | Session, active workspace, UI prefs |
| Persistent storage | MMKV (drafts, cache), expo-secure-store (tokens) | Encrypted MMKV for drafts containing PII |
| Forms | react-hook-form + zod (`@logix/validation`) | Same rules as the backend |
| API client | Generated from OpenAPI (`@logix/api-client`, openapi-fetch/orval) | Interceptors: auth, org/workspace headers, idempotency keys, locale |
| Realtime | socket.io-client | Order/tracking/chat rooms |
| i18n | i18next + react-i18next + ICU plurals | `ar` default |
| Styling | Tamagui, NativeWind, or Unistyles (pick one) with design tokens from `@logix/design-tokens` | Must support logical properties (start/end) |
| Icons | SVG icon set from the handoff (react-native-svg, generated components from `manifest.json`) | 48 icons |
| Maps | react-native-maps (Google provider on both platforms) | Route polyline, pins, live marker |
| Location (driver) | expo-location + expo-task-manager (background), or react-native-background-geolocation (commercial, more reliable) | T-09 |
| Camera / scanning | VisionCamera + document scanner plugin (edge detection, crop), expo-image-picker, expo-document-picker | K-D03 correction tools |
| Image processing | expo-image-manipulator (rotate, crop, compress before upload) | Keep under 10 MB |
| Signature | react-native-signature-canvas | POD/RC |
| Payments | Gateway RN SDK or 3DS WebView; Apple Pay via the gateway (expo-apple-pay or SDK) | Depends on D-05 |
| Push | expo-notifications (FCM/APNs) | Deep link handling |
| PDF viewing | react-native-pdf or the system viewer via file share | Invoices, statements, documents |
| Lists | FlashList | Orders, opportunities, products |
| Dates | date-fns + date-fns-tz (Asia/Riyadh) | Gregorian display |
| Numbers / money | Intl.NumberFormat with `en` digits in both locales (see localization doc) | |
| Error reporting | Sentry (`@sentry/react-native`) | Source maps via EAS |
| Analytics | PostHog, Firebase Analytics or Amplitude (pick one) | Event catalog in [07-quality-release.md](07-quality-release.md) |
| Feature flags | Server `/app-config` + PostHog/GrowthBook (optional) | Kill switches |
| Testing | Jest + React Native Testing Library; Maestro for e2e | See the quality doc |
| Lint / format | ESLint (shared config), Prettier, TypeScript strict | |

## 3. Platform targets
- iOS 15+ and Android 8.0+ (API 26+). Revisit with analytics after launch.
- Phones only, portrait. Tablets run the phone layout.
- Bundle IDs: `sa.logix.app` (prod), `sa.logix.app.staging` (proposal; confirm the company domain).

## 4. Build flavors

| Flavor | API | Payment | Distribution |
|---|---|---|---|
| development | local/dev | Fake/sandbox | Dev client |
| staging | staging | Gateway sandbox | TestFlight internal / Play internal testing |
| production | prod | Live | App Store / Google Play |
