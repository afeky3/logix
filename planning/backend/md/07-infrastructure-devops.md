# Backend — Infrastructure and DevOps

## 1. Hosting (proposal, pending D-23 data residency and T-03 cloud choice)

| Component | Managed service (example on AWS; equivalents on GCP/Azure/local KSA clouds) |
|---|---|
| Containers | ECS Fargate or Kubernetes (EKS/GKE), with `api` and `worker` services from one image |
| PostgreSQL + PostGIS | RDS/Cloud SQL, Multi-AZ, PITR 14 days, 1 read replica from Phase 2 |
| Redis | ElastiCache/Memorystore (cluster mode off in MVP, with a replica) |
| Object storage | S3/GCS with versioning and SSE-KMS, lifecycle to infrequent access after 90 days |
| CDN | CloudFront/Cloud CDN for public product images and the dashboard static assets |
| Secrets | Secrets Manager / Secret Manager |
| Email | SES (or SendGrid) |
| DNS / TLS | Route 53 / Cloud DNS + ACM-managed certificates |
| WAF | AWS WAF / Cloud Armor in front of the API and dashboard |

The region choice must satisfy PDPL data residency constraints (see D-23). Candidates are KSA-hosted regions from the major clouds or local providers, and the choice needs legal sign-off.

Infrastructure as code: **Terraform**, with one workspace per environment (`dev`, `staging`, `prod`). State lives in a remote backend with locking.

## 2. Environments

| Env | Deploy trigger | Data | External services |
|---|---|---|---|
| local | `docker compose up` | Seed scripts (reference data + demo accounts per role) | MinIO, Mailpit, fake SMS sink, gateway sandbox or mock |
| dev | Merge to `main` | Synthetic | Sandbox for gateway, SMS test numbers |
| staging | Release tag `vX.Y.Z-rc.N` | Synthetic or anonymized | Sandbox gateway, real SMS to allow-listed numbers |
| prod | Manual approval of the release tag | Real | Live |

Seed data includes cities, ports (CNSHA, SAJED, DXB, RUH…), vehicle types, container types, document types, product categories, terms v1, and demo orgs per role, so that every client journey can be demoed end to end.

## 3. CI/CD (GitHub Actions)

```
PR:    install (pnpm, cached) → lint → typecheck → unit tests → build
       → integration tests (Testcontainers: Postgres+PostGIS, Redis)
       → OpenAPI diff (fails on breaking changes without a flag)
       → Prisma migration check (drift + destructive-change guard)
       → security: CodeQL/Semgrep, gitleaks, dependency audit, Trivy on image
main:  build image → push → deploy dev → smoke tests → publish api-client package
tag:   deploy staging → e2e suite (API) → manual approval → deploy prod (rolling)
       → post-deploy smoke → auto-rollback on failed health checks
```

- Migrations run as a one-off task **before** the new version rolls out, and every migration must be backward compatible with the running version (expand/contract).
- Blue/green or rolling deploy with readiness probes (`/health/ready` checks DB, Redis and S3).
- Release notes are generated from conventional commits.

## 4. Observability

| Signal | Tooling | Key dashboards and alerts |
|---|---|---|
| Logs | pino JSON → Loki/CloudWatch/Datadog | Error rate by module, 5xx spikes |
| Traces | OpenTelemetry → Tempo/X-Ray/Datadog APM | p95 latency per endpoint, slow queries |
| Metrics | Prometheus/OTel metrics | Queue depth and job failures per queue, outbox lag, webhook processing lag |
| Errors | Sentry (backend + app + dashboard, linked by release) | New issue alerts |
| Uptime | External checks on `/health/live` and critical user journeys | Paging |

Business alerts (to the ops Slack/email channel):
- Payment success rate below 90% over 15 min
- Webhook backlog over 5 min
- Settlements due today not batched by 12:00 Riyadh
- OTP delivery failure rate above 5%
- Outbox lag above 60 s
- Dead-letter queue not empty

## 5. Backups and disaster recovery

| Item | Policy |
|---|---|
| PostgreSQL | Automated daily snapshots (35 days) + PITR (14 days) + monthly snapshot kept 1 year |
| Object storage | Versioning + cross-region replication for the private bucket (if residency allows) |
| Redis | Treated as a cache. Queues are recoverable from the DB outbox |
| Targets | RPO ≤ 15 min, RTO ≤ 4 h (proposal) |
| Drills | Quarterly restore test into an isolated environment |

## 6. Performance targets (initial SLOs)

| Metric | Target |
|---|---|
| API availability | 99.5% monthly (MVP), 99.9% after Phase 3 |
| p95 latency, read endpoints | < 300 ms |
| p95 latency, write endpoints | < 600 ms (excluding gateway round-trips) |
| Push notification delivery after event | < 10 s p95 |
| Tracking location fan-out to customer | < 5 s p95 |
| Settlement scheduling accuracy | 100% (payable_on computed with the business-day calendar) |

Capacity baseline for load testing, to be revised with a business forecast:
- 5k DAU
- 500 concurrent active trips sending GPS every 15 s
- 200 requests/min on the marketplace search

## 7. Cost controls

- Autoscaling floors of 2 API tasks and 1 worker task (prod).
- Staging is scaled down out of working hours.
- Maps API usage is capped with quotas, and route estimates are cached per origin/destination pair for 24 h.
- SMS spend alerts and per-number OTP caps.
- Image thumbnails are generated once and served from the CDN.
