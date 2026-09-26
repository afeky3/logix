# Web Dashboard — Tech Stack

## 1. Recommendation (T-07)

| Concern | Choice | Why | Alternatives |
|---|---|---|---|
| Framework | **Next.js 15 (App Router), TypeScript strict** | Mature, SSR for fast first load, route handlers for the auth cookie flow, same language as backend and app | Vite + React SPA (simpler hosting, no SSR); Refine (admin framework on top of React) |
| UI kit | **shadcn/ui** (Radix primitives) + Tailwind CSS | Accessible primitives, full design control to match Logix tokens, RTL via logical utilities (`ms-`, `me-`, `ps-`, `pe-`) and the `dir` attribute | Ant Design (strong tables and RTL, heavier look), MUI |
| Tables | **TanStack Table** + virtualized rows | Server-side pagination, column visibility, sorting, saved views | AG Grid (paid features) |
| Server state | TanStack Query | Caching, polling for queues, mutations with invalidation | SWR |
| Forms | react-hook-form + zod (`@logix/validation`) | Shared rules with the backend | — |
| API client | `@logix/api-client` (generated from OpenAPI) | Typed admin endpoints | — |
| Charts | Recharts or ECharts | KPIs and trends | Chart.js |
| Maps | Google Maps JS API (`@vis.gl/react-google-maps`) | Live trips map, service areas | Mapbox GL |
| Realtime | socket.io-client (staff room `staff:ops`) | Live queues and trips | — |
| i18n | next-intl (ar/en), `dir="rtl"` switching without reload | Bilingual console | i18next |
| Dates | date-fns + tz (Asia/Riyadh) | Consistent with other tracks | — |
| PDF / file viewer | react-pdf (pdf.js) + image zoom viewer | KYB documents, invoices | Native browser viewer |
| Auth | Backend staff auth (email + password + TOTP). Refresh token in an HttpOnly cookie set via a Next.js route handler | No tokens in localStorage | NextAuth (unnecessary layer) |
| Error tracking | Sentry (`@sentry/nextjs`) | Release-linked with backend | — |
| Testing | Vitest + Testing Library (unit/component), Playwright (e2e) | — | Cypress |
| Lint / format | Shared ESLint/Prettier configs | — | — |

## 2. Hosting
- Containerized Next.js (standalone output) behind the same CDN and WAF as the API, or a managed platform if data residency allows (D-23).
- Separate domain: `admin.logix.sa` (to confirm). Optional IP allow-list or VPN for finance and super-admin areas.
- CSP with nonces, `frame-ancestors 'none'`, strict referrer policy.

## 3. Why not a low-code admin (Retool, Appsmith, Forest Admin)?
- Complex, domain-specific workflows (maker-checker, KYB item decisions, payout batches, live maps) outgrow generic CRUD quickly.
- Data residency and PII controls are harder with SaaS tools.
- A low-code tool is acceptable **temporarily** for internal ad-hoc reports in Phase 1 if pressed for time, but only on read replicas with masked views.

## 4. Business web portal (D-W02, Phase 4)
If approved, it lives in the same Next.js app under a separate route group (`/portal`) with a different auth (user OTP, same as mobile), so the dashboard's design system and tables can be reused for bulk product management and provider desktop workflows.
