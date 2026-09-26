# Backend — Tech Stack

Items marked **Decision** are tracked in [09-open-decisions.md](09-open-decisions.md). The rest are recommendations the team can adopt directly.

## 1. Core

| Concern | Choice | Why | Alternatives considered |
|---|---|---|---|
| Runtime | Node.js 22 LTS | Current LTS, native fetch, stable performance | Bun (ecosystem risk for NestJS) |
| Language | TypeScript (strict) | Shared types with app and dashboard | — |
| Framework | **NestJS 11** | Modules, DI, guards/interceptors, first-class OpenAPI, WebSockets, queues | Express/Fastify raw (more glue code), AdonisJS |
| HTTP adapter | Fastify adapter | Faster than Express, schema-friendly | Express adapter (fine if a library needs it) |
| Database | **PostgreSQL 16** | Relational integrity for money and lifecycles, JSONB for flexible service details, PostGIS for geo, FTS | MySQL (weaker JSON/geo), MongoDB (not suited to ledger) |
| ORM / migrations | **Prisma** (Decision T-02) | Type-safe client, migration workflow, interactive transactions | TypeORM (more Nest-native, weaker typing), Drizzle (SQL-first, newer) |
| Geo | PostGIS | Distance, service areas, route pins | Plain lat/lng columns (no spatial queries) |
| Cache / locks / rate limits | Redis 7 | OTP throttling, idempotency keys, latest GPS position, Socket.IO adapter | — |
| Jobs / queues | **BullMQ** (`@nestjs/bullmq`) | Delayed jobs (quote expiry, T+3 settlement), retries, cron | Temporal (overkill for MVP), pg-boss |
| Realtime | Socket.IO (`@nestjs/websockets`) with Redis adapter | Chat, tracking, live order updates, horizontal scaling | SSE (one-way only), raw WS |
| Object storage | S3-compatible (AWS S3 / R2 / MinIO locally) | Pre-signed uploads for documents and photos | — |
| Validation | `nestjs-zod` + zod schemas from `packages/validation` | One schema shared by app, dashboard and API | class-validator (duplicated rules) |
| API docs | OpenAPI 3.1 via `@nestjs/swagger` | Generated typed clients (`openapi-typescript` / orval) | — |
| AuthZ | CASL (attribute-based) + custom membership guard | Ownership and role rules per resource | Casbin |
| Config | `@nestjs/config` + zod-validated env | Fail fast on bad config | — |
| Logging | pino (`nestjs-pino`) JSON logs with trace IDs | Low overhead, structured | winston |
| Tracing / metrics | OpenTelemetry → Grafana stack or Datadog | Cross-module traces, queue latency | — |
| Errors | Sentry | Exceptions with release tags | — |
| PDF generation | HTML templates + Playwright (headless Chromium) in a worker | Arabic shaping/RTL renders correctly in a browser engine | pdfkit/pdfmake (poor Arabic shaping) |
| Search (marketplace) | PostgreSQL FTS + `pg_trgm` with Arabic normalization (MVP) → Meilisearch/OpenSearch (Decision T-06) | No extra infra in MVP | Algolia (cost, data residency) |
| Testing | Jest + Supertest + Testcontainers + k6 | See [08-testing-quality.md](08-testing-quality.md) | Vitest (fine too) |
| Package manager / monorepo | pnpm + Turborepo (Decision T-08) | Shared packages, fast CI caching | Nx |

## 2. External services

| Capability | Recommended | Notes | Decision |
|---|---|---|---|
| Payment gateway | Moyasar, HyperPay or Tap | Must support mada, Visa/Mastercard, Apple Pay (STC Pay optional), partial refunds, webhooks. Check marketplace/split features against D-04 | D-05 |
| SMS OTP | Unifonic, Taqnyat or Msegat | Local providers with registered sender IDs; delivery reports via webhook | T-04 |
| Push | Firebase Cloud Messaging (FCM, which also delivers to APNs) | Via `firebase-admin` | — |
| Email | Amazon SES / SendGrid | Invoices, statements, staff invites | — |
| Maps / geocoding / distance | Google Maps Platform | Arabic place names, Distance Matrix for route estimates | T-05 |
| National address | Saudi Post / SPL National Address API | Validate and autofill national addresses | Optional (Phase 2) |
| Commercial registration | Wathq (Ministry of Commerce) API | Auto-verify CR number and status during KYB | Optional (Phase 2) |
| E-invoicing | ZATCA Fatoora (Phase 2 integration: clearance/reporting) | Depends on who issues the invoices (D-03) | D-03 |
| Customs | Fasah (ZATCA) | Only after scope and access are confirmed. Manual updates until then | D-09 |
| Antivirus | ClamAV sidecar | Scan every upload before it becomes downloadable | — |
| Secrets | Cloud secret manager (AWS Secrets Manager / GCP Secret Manager / Vault) | Never in env files committed to git | — |

## 3. Key libraries (indicative)

- `@nestjs/*`: core, config, swagger, bullmq, websockets, schedule, terminus (health), throttler
- `prisma`, `@prisma/client`
- `zod`, `nestjs-zod`
- `@casl/ability`
- `ioredis`, `bullmq`, `socket.io`, `@socket.io/redis-adapter`
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- `firebase-admin`
- `libphonenumber-js` (E.164 normalization for Saudi mobiles)
- `ibantools` (SA IBAN validation)
- `date-fns` + `date-fns-tz` (Asia/Riyadh, business-day math)
- `nestjs-pino`, `@opentelemetry/sdk-node`, `@sentry/nestjs`
- `playwright` (PDF worker only)
- `argon2` (staff password hashing), `otplib` (staff TOTP 2FA)

## 4. Versions and upgrade policy

- Pin major versions and use Renovate for weekly minor/patch PRs.
- Node LTS upgrades once a year. PostgreSQL major upgrades once a year in a maintenance window.
- Prisma migrations are forward-only in production. Destructive changes use expand/contract across two releases.
