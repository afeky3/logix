# Backend — API Conventions

## 1. Surfaces

| Surface | Base path | Auth | Consumers |
|---|---|---|---|
| App API | `/api/v1/...` | User JWT + `X-Organization-Id` + `X-Workspace` | Mobile app (customer, supplier, provider, driver) |
| Provider/supplier/driver sub-trees | `/api/v1/provider/...`, `/api/v1/supplier/...`, `/api/v1/driver/...` | Same, workspace must match | Mobile app |
| Admin API | `/api/v1/admin/...` | Staff JWT (separate audience) + RBAC | Web dashboard |
| Webhooks | `/webhooks/{provider}` | Signature verification per provider | Gateway, SMS DLR, (Fasah if push) |
| Realtime | Socket.IO `/rt` | User or staff JWT on handshake | App, dashboard |
| Health | `/health/live`, `/health/ready` | None (internal network) | Orchestrator |

OpenAPI spec at `/api/docs` (non-prod) and exported in CI to `packages/api-client`.

## 2. Resource style

- Plural nouns, kebab-case: `/service-requests`, `/purchase-orders`, `/release-requests`.
- Actions that are state transitions use sub-resources with verbs: `POST /service-requests/{id}/submit`, `POST /quotes/{id}/accept`, `POST /provider/orders/{id}/confirm-readiness`. They are easier to audit and authorize than a generic `PATCH status`.
- IDs in URLs are UUIDs. Human references (`LX-260148`) are accepted by lookup endpoints: `GET /orders/by-reference/{ref}`.
- `PATCH` uses JSON merge semantics for drafts (multi-step forms save per step).

## 3. Headers

| Header | Direction | Purpose |
|---|---|---|
| `Authorization: Bearer <jwt>` | req | Access token (15 min) |
| `X-Organization-Id` | req | Active account (org) |
| `X-Workspace` | req | `CUSTOMER`/`SUPPLIER`/`PROVIDER`/`DRIVER` |
| `Accept-Language` | req | `ar` (default) or `en`, for server messages |
| `Idempotency-Key` | req | Required on money- or order-creating POSTs (UUID; stored 24 h) |
| `X-App-Version`, `X-Platform` | req | Min-version enforcement, analytics |
| `X-Request-Id` | both | Correlation ID (generated if absent) |
| `ETag` / `If-None-Match` | both | Reference data caching |
| `If-Match` | req | Optimistic concurrency on editable aggregates (quotes, products, drafts) |

## 4. Responses

Success responses return the resource (or `{ data, meta }` for lists). Every response includes `X-Request-Id`.

**Money** is always an object:

```json
{ "amount": 276000, "currency": "SAR", "formatted": "2,760.00 SAR" }
```

`amount` is in halalas. `formatted` is localized by `Accept-Language` for convenience, but clients may format themselves.

**Enums** are returned as codes (`"status": "AWAITING_ACCEPTANCE"`). Clients translate them from `packages/i18n`.

**Available actions**: detail endpoints return `allowedActions` (for example `["CONFIRM_RECEIPT","REPORT_ISSUE","REQUEST_CANCELLATION"]`) computed by the state machine and permissions. Clients render buttons from this list instead of re-implementing rules.

**Timestamps** are ISO-8601 UTC (`2026-10-14T06:00:00Z`). Dates without time (`cargo_ready_date`) are `YYYY-MM-DD` in Riyadh local.

## 5. Errors

```json
{
  "error": {
    "code": "QUOTE_EXPIRED",
    "message": "انتهت صلاحية هذا العرض. اطلب عرضًا جديدًا.",
    "details": [{ "field": "quoteId", "code": "EXPIRED" }],
    "requestId": "01J9…",
    "retryable": false
  }
}
```

| HTTP | Typical codes |
|---|---|
| 400 | `VALIDATION_FAILED` (with field details) |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` |
| 403 | `FORBIDDEN`, `WORKSPACE_NOT_ACTIVE`, `VERIFICATION_REQUIRED`, `ACTIVITY_NOT_APPROVED` |
| 404 | `NOT_FOUND` (also used instead of 403 when the resource's existence must not leak) |
| 409 | `INVALID_STATE_TRANSITION`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `QUOTE_EXPIRED`, `STOCK_INSUFFICIENT`, `MOQ_NOT_MET` |
| 422 | `BUSINESS_RULE_VIOLATION` (for example `MANDATE_NOT_ACTIVE`, `RETURN_WINDOW_CLOSED`) |
| 429 | `RATE_LIMITED` (with `Retry-After`) |
| 502/503 | `UPSTREAM_UNAVAILABLE` (gateway/SMS/Fasah), `retryable: true` |

Error codes are a stable, documented enum. Clients map them to X07/X08 system states.

## 6. Pagination, filtering, sorting

- **Feeds** (orders, opportunities, notifications, messages): cursor pagination, `?limit=20&cursor=…` → `meta: { nextCursor }`.
- **Admin tables**: offset pagination, `?page=1&pageSize=50` → `meta: { total, page, pageSize }`.
- Filters: `?status=IN_PROGRESS,AWAITING_ACCEPTANCE&serviceType=TRANSPORT&from=2026-10-01&to=2026-10-31`.
- Sort: `?sort=-createdAt` or `?sort=price` (whitelisted per endpoint). Quote sort keys: `price`, `rating`, `eta` (matches the "cheapest / fastest / highest rated" tabs).
- Search: `?q=` (trimmed, normalized; Arabic normalization server-side).

## 7. Idempotency

- Required for: `POST /quotes/{id}/accept`, `POST /payment-intents`, `POST /checkout`, `POST /orders/{id}/receipt-confirmation`, `POST /…/cancellation-requests`, refunds, payouts, and any admin money action.
- The server stores `(key, user, route, body hash) → response` for 24 h. A replay with the same body returns the stored response, and a different body returns `409 IDEMPOTENCY_CONFLICT`.

## 8. Drafts and multi-step forms

Request forms (SH01→SHR, TR01→TRR, WH01→WHR, CU01→CUR), KYB (A05→A07) and product listing (S02→S04) are saved server-side as drafts after each step:

- `POST /service-requests` → `{ id, status: "DRAFT" }`
- `PATCH /service-requests/{id}` with the step payload → validation runs **per step** (`?step=cargo`), and full validation runs at submit.
- This satisfies *"Preserve values when navigating back"* and the offline "save draft and retry" state (X08). The app also keeps a local draft copy.

## 9. Files in payloads

Payloads reference uploaded files by `fileId`. Never send base64. See [modules/04-files-documents.md](modules/04-files-documents.md).

## 10. Realtime events (payload contract)

```json
{ "type": "order.milestone", "orderId": "…", "reference": "LX-260148",
  "milestone": { "code": "DEPARTED", "occurredAt": "…", "source": "PROVIDER" },
  "version": 7 }
```

- Every realtime event includes the aggregate `version`. Clients ignore stale versions and re-fetch on a gap.
- `tracking.location`: `{ orderId, lat, lng, heading, speedKph, recordedAt }` is throttled to one event per 10 s per order for customers.

## 11. Webhooks (inbound)

- Verify signature/HMAC or IP allow-list per provider, then store the raw payload in `payment_events` / `integration_events`, respond 200 quickly, and process asynchronously in a job.
- Handlers are idempotent on the provider's event ID.
- Payment webhooks are always double-checked with a server-to-server "retrieve payment" call before marking `PAID`.

## 12. Versioning and compatibility

- URI major version (`/v1`). Additive changes (new fields, new enum values) are allowed without a version bump.
- **Clients must tolerate unknown enum values** and render a generic label.
- Breaking changes need `/v2` for the affected resources and at least 90 days of dual-running for mobile.
- Minimum supported app version comes from `GET /app-config` (feature flags, min version, support contacts). The app blocks with a force-update screen below the minimum.

## 13. Rate limits (defaults)

| Scope | Limit |
|---|---|
| OTP request | 1 per 45 s per phone; 5 per hour per phone; 20 per hour per IP |
| OTP verify | 5 attempts per challenge |
| Auth refresh | 30 per hour per session |
| General authenticated | 300 per minute per user |
| Driver location ingest | 1 batch per 10 s per trip |
| Admin | 600 per minute per staff |

## 14. Naming reference (selected endpoints)

Full lists are in each module doc. Summary:

```
POST   /auth/otp/request            POST /auth/otp/verify         POST /auth/refresh
GET    /me                          GET  /me/workspaces           GET  /me/sessions
POST   /organizations               POST /organizations/{id}/verification/submit
POST   /files/upload-url            POST /files/{id}/complete
POST   /service-requests            PATCH /service-requests/{id}  POST /service-requests/{id}/submit
GET    /service-requests/{id}/quotes?sort=price                   POST /quotes/{id}/accept
POST   /payment-intents             GET  /payment-intents/{id}
GET    /orders/feed                 GET  /orders/{id}             GET  /orders/{id}/timeline
POST   /orders/{id}/receipt-confirmation                          POST /orders/{id}/rating
GET    /orders/{id}/cancellation-preview                          POST /orders/{id}/cancellation-requests
GET    /provider/opportunities      POST /provider/quotes         POST /provider/orders/{id}/milestones
POST   /provider/orders/{id}/completion-evidence
GET    /driver/jobs                 POST /driver/jobs/{id}/locations
GET    /marketplace/products        POST /cart/items              POST /checkout
GET    /purchase-orders/{id}        POST /purchase-orders/{id}/returns
GET    /notifications               GET  /conversations/{id}/messages
```
