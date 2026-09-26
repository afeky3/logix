# Module 05 — Service Requests, Matching and Quotes

## Purpose
The shared engine behind all four logistics services: the customer builds a request (draft → submit), the platform matches eligible providers, providers submit quotes, and the customer compares and accepts one, which creates the order and the payment intent.

## Screens served
- Customer: SH01–SH07 + SHR/SHQ, TR01–TR04 + TRR/TRQ, WH01–WH02 + WHR/WHQ, CU01–CU04 + CUR/CUQ, the accept step of SHP/TRP/WHP/CUP. Kit: K-L01–K-L04, K-F01–K-F07, K-W01–K-W02, K-Q01 Receive offers, K-Q02 Compare offers, K-Q03 Choose an offer.
- Provider: P01 Provider opportunities, P02 Service request details, P03 Prepare a quote. Kit: K-P05, K-P06 Available requests, K-P07 Assess the request, K-P08 Prepare a quote, K-P08B Offers submitted.
- Dashboard: request monitor, zero-quote alerts, quote anomaly view.

## 1. Requests

### Lifecycle
See [04-state-machines.md §1](../04-state-machines.md#1-service-request-servicerequeststatus). The reference `LX-…` is allocated at **draft creation** and stays with the order.

### Step validation
Each service defines named steps. `PATCH /service-requests/{id}?step=<name>` validates only that step. `submit` validates everything and requires the accuracy consent (*"I confirm accurate information, including cargo and supporting documents"*).

| Service | Steps (V2 screens) | Key conditional rules |
|---|---|---|
| Shipping | `mode` (SH01) → `route` (SH02) → `cargo` (SH03 sea / SH04 air-express / SH05 land) → `services` (SH06) → `door_to_door` (SH07, only if D2D) → review (SHR) | Sea requires container type/size or LCL volume + package count. Air requires weight, packages and per-package dimensions. Land requires origin/destination country+city. D2D requires pickup/delivery addresses, contacts and pickup window. `wants_customs_clearance` creates a linked customs request on submit |
| Transport | `scope_vehicle` (TR01) → `locations` (TR02) → `load` (TR03) **or** `car_carrier` (TR04) → review (TRR) | Car carrier vehicle type → TR04 (vehicle count) replaces commodity/weight. Reefer → temperature required. Cross-border → border instructions and country fields |
| Warehousing | `space` (WH01) → `goods` (WH02) → review (WHR) | Chilled/frozen → temperature range required. `transport_to_warehouse = LINKED` → linked transport request after award |
| Customs | `movement` (CU01) → `details` (CU02 import/transit) → `documents` (CU03 import/transit **or** CU04 export) → review (CUR) | Transit → transit destination + exit checkpoint required. Export → departure port + booking confirmation. Documents may be uploaded now or later, with a "missing documents" warning on review |

"Other" free-text fields exist wherever the design shows them (*Other: Add a port or special requirement*, *Handling or priority requirements*, *Border and handling instructions*, *Temperature or special handling*, etc.) and are stored in `other_requirements` or per-step `extras`.

### Route estimate
For transport (and D2D legs), the server calls the maps provider (cached 24 h per pair) and stores `route_distance_km` and `route_duration_min`. They are shown as *illustrative* ("950 km • ~10 hours, illustrative distance and time; values update after route is set").

### Linked requests
`POST /orders/{orderId}/linked-requests { serviceType, linkType, prefill }` creates a new draft that is pre-filled from the parent and linked via `OrderLink`. Uses:
- customs for a shipment (SH06),
- transport to a warehouse (WH03),
- port collection after customs (CU09),
- delivery of a purchase (marketplace, created by the system).

## 2. Matching

### Eligibility (all must hold)
1. The provider org workspace is `ACTIVE`, and the provider is not suspended.
2. It has an approved `ProviderActivity` that matches the request:

| Request | Activity |
|---|---|
| Shipping sea | `FREIGHT_SEA` |
| Shipping air (non-express) | `FREIGHT_AIR` |
| Shipping express | `EXPRESS` (or `FREIGHT_AIR` if flagged express-capable) |
| Shipping land | `FREIGHT_LAND` |
| Transport | `TRANSPORT_CARRIER` or `TRANSPORT_BROKER` |
| Warehousing | `WAREHOUSE` |
| Customs | `CUSTOMS_BROKER` |

3. The service area covers the request: origin city/region (transport, warehousing), lane or origin/destination country (freight), checkpoint (customs).
4. Transport carriers need at least one active vehicle of the requested type (brokers are exempt).
5. The activity's required licences are valid (not expired).

### Fan-out
- On `request.submitted`, the matcher writes `RequestMatch` rows and sends notifications (push + in-app "New request matches your activity").
- If zero providers match, the request is flagged for ops (dashboard "zero-match" queue) and the customer sees *"We're finding providers for your request"*.
- If there are no quotes after 24 h, ops is alerted and the customer gets an optional nudge to adjust the request.

### Provider view (P01/P02, pre-award)
Before award, providers see:
- service, route (city-level for pickup/drop-off; full address after award), dates, cargo summary, vehicle type, quantities, special instructions,
- document types present,
- request expiry,
- a masked customer indicator ("Verified company in Riyadh").

They do **not** see the customer name, contacts or files (D-16).

Filters: activity, city, date range, service type. Sort: newest, service date. Counters for "Matching requests", "Active jobs" and "Receivables" (P01 tiles) come from the provider dashboard endpoint.

### Clarifications (P02 "Ask a question in the order")
- `RequestQuestion` threads per provider. The customer answers, and the answer is visible to all matched providers (fair competition), anonymized.
- Contact details are masked automatically. Masking events are logged for ops review.

## 3. Quotes

### Composition (P03 / K-P08)
Provider inputs:
- `serviceFee` (price before tax)
- optional itemized `charges[]` (for example loading/unloading, each `taxable` true/false)
- `etaDate` or `durationDays`
- `validUntil` (24–168 h, default 48 h)
- `scopeIncluded`
- `exclusions`
- `notes`
- private `internalCost` and `targetMargin` (planning aids, **never exposed**)

Server computes (using current commission rules, D-02):
- `vatAmount` = 15% of taxable lines (half-up per line)
- `totalAmount` = subtotal + VAT (what the customer pays)
- `commissionPreview` (e.g. 10% of the service fee = 240)
- `commissionVatPreview` (if applicable)
- `netToProviderPreview` (e.g. 2,160 "net before commission taxes")

These are shown to the provider before sending (P03 "Tax & charges itemized without hidden charges").

### Customer comparison (SHQ/TRQ/WHQ/CUQ, K-Q01/K-Q02)
`GET /service-requests/{id}/quotes?sort=price|rating|eta` returns, per quote:
- provider display name, rating (e.g. 4.8), completed-jobs count (e.g. "86 trips"),
- total, VAT, ETA, validity countdown,
- scope, exclusions,
- badges (cheapest, fastest, top rated).

`GET /service-requests/{id}/quotes/compare?ids=a,b` returns a normalized comparison matrix (total, delivery, rating, loading included, validity), which renders K-Q02.

Quote detail (K-Q03/SHP top part): line-item breakdown (service 2,200 + loading 200 + VAT 15% 360 = 2,760), execution date, provider details, "message provider" (pre-award masked thread).

### Accept (SHP/TRP/WHP/CUP "Accept & pay")
`POST /quotes/{id}/accept` with `Idempotency-Key` and consents `QUOTED_SCOPE` + cancellation policy acknowledgment.

Inside one transaction:
1. Lock the request and quote, and check the quote is `SUBMITTED` and valid.
2. quote → `ACCEPTED_PENDING_PAYMENT`, request → `AWAITING_PAYMENT`.
3. Create the order (`PENDING_PAYMENT`) with an amounts snapshot and commission snapshot.
4. Create the payment intent (module 12). The response includes the gateway client payload.
5. Schedule the hold timeout (30 min).

On `payment.succeeded`: order → `CONFIRMED`, quote → `ACCEPTED`, other quotes → `NOT_SELECTED` (providers notified "Not selected"), request → `CONVERTED`.
On failure or timeout: revert (see state machines). X07 shows "Payment failed or confirmation missing → Check status before paying again".

## API summary

Customer:

| Method | Path |
|---|---|
| POST | `/service-requests` `{ serviceType, parentOrderId?, linkType? }` |
| GET / PATCH | `/service-requests/{id}` (`?step=`) |
| POST | `/service-requests/{id}/submit` |
| POST | `/service-requests/{id}/cancel` |
| GET | `/service-requests?status&serviceType` |
| GET | `/service-requests/{id}/quotes`, `/quotes/{quoteId}`, `/service-requests/{id}/quotes/compare` |
| GET / POST | `/service-requests/{id}/questions` (answer) |
| POST | `/quotes/{id}/accept` |

Provider:

| Method | Path |
|---|---|
| GET | `/provider/opportunities?activity&city&from&to&serviceType` |
| GET | `/provider/opportunities/{requestId}` |
| POST | `/provider/opportunities/{requestId}/questions` |
| POST | `/provider/opportunities/{requestId}/decline` (optional reason; improves matching) |
| POST | `/provider/quotes` / PATCH `/provider/quotes/{id}` / POST `/provider/quotes/{id}/withdraw` |
| GET | `/provider/quotes?status` (K-P08B "Offers submitted": customer selected / awaiting response) |
| POST | `/provider/quotes/preview` (compute VAT/commission/net without saving) |

## Events
`request.draft_created`, `request.submitted`, `request.cancelled`, `request.expired`, `request.zero_match`, `request.matched` (per provider), `question.asked`/`answered`, `quote.submitted`/`revised`/`withdrawn`/`expired`/`accepted`/`not_selected`.

## Jobs
Quote expiry at `valid_until`; request expiry at `expires_at`; payment hold timeout (30 min); zero-quote alert (24 h); provider reminder for unanswered matches (12 h, digest).

## Acceptance criteria
- [ ] All four services can be drafted step by step, resumed on another device and submitted with full validation.
- [ ] Only eligible providers see a request. Suspended or expired-licence providers never do.
- [ ] Providers never see customer identity or files pre-award, and contact info is masked in Q&A.
- [ ] Quote totals match the fixtures. Private cost and margin never leave the provider scope.
- [ ] Double-tapping "Accept & pay" creates exactly one order and one intent.
