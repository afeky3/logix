# Module 06 — Orders and Execution Core

## Purpose
Service-agnostic order behaviour shared by all four services:
- follow-up views, provider readiness, milestones and timeline with source and timestamp,
- linked orders, additional charges,
- completion evidence (POD), receipt confirmation (RC), damage/shortage reports,
- completion, ratings, and the unified "My orders" feed.

Service-specific execution (freight booking, fleet/GPS, stock, customs declaration) plugs into this core. See modules 07–10.

## Screens served
- Customer: SHF/TRF/WHF/CUF (order follow-up), H01 recent activity, X01 My orders, SH08 Shipment journey, TR06 Trip progress, CU08 Clearance progress, RC Confirm receipt, DONE Service completed. Kit: K-O02 Order details, K-T01, K-T02, K-T03, K-T04 invoice, K-R01 Report issue.
- Provider: P04 Your quote is accepted, K-P08B, K-P09, PS3/PT3 milestone updates, POD Service completion evidence.
- Dashboard: order detail (timeline, parties, money, documents, links, cases), manual milestone override.

## Order detail contract (`GET /orders/{id}`)

```json
{
  "id": "…", "reference": "LX-260148", "serviceType": "TRANSPORT",
  "status": "IN_PROGRESS", "paymentStatus": "PAID", "settlementStatus": null,
  "summary": { "title": "Riyadh → Jeddah", "subtitle": "Trailer • 18 t • 24 pallets" },
  "parties": { "customer": {…}, "provider": { "name": "Al Masar", "rating": 4.8 } },
  "amounts": { "serviceFee": {…}, "charges": [...], "vat": {…}, "total": {…} },
  "nextAction": { "code": "REVIEW_DOCUMENTS", "actor": "CUSTOMER", "dueAt": null },
  "milestones": [{ "code": "CARGO_COLLECTED", "status": "DONE", "occurredAt": "…", "source": "DRIVER" }],
  "documentsSummary": { "required": 3, "accepted": 2, "changesRequested": 1 },
  "links": [{ "type": "CUSTOMS_FOR_SHIPMENT", "reference": "LX-260149", "status": "…" }],
  "tracking": { "live": true, "lastLocationAt": "…" },
  "allowedActions": ["VIEW_LIVE_PROGRESS","MESSAGE_PROVIDER","REQUEST_CANCELLATION"],
  "version": 12
}
```

The follow-up timeline in the client screens (SHF: *Quote accepted → Payment → Next action → Service provider → Documents & actions*) is rendered from `status`, `paymentStatus`, `nextAction`, `parties` and `documentsSummary`. `nextAction` is computed server-side (for example `REVIEW_DOCUMENTS`, `CONFIRM_RECEIPT`, `APPROVE_EXTRA_CHARGE`, `CREATE_BROKER_AUTHORIZATION`, `BOOK_INTAKE_SLOT`, `UPLOAD_MISSING_DOCUMENTS`).

## Provider readiness (P04 / K-P08B)
- After `order.confirmed`, the provider sees "Your quote is accepted — check payment before starting work" with start requirements (documents, authorization if needed).
- `POST /provider/orders/{id}/confirm-readiness` moves `CONFIRMED` → `SCHEDULED`. If the provider doesn't confirm within 12 h, a reminder is sent, and at 24 h ops is alerted.
- *"Execution starts after payment confirmation"*: execution endpoints return `409` unless the order is ≥ `SCHEDULED`.

## Milestones
- The template per service/mode is created on confirmation ([04-state-machines.md §4](../04-state-machines.md#4-milestone-templates-per-service)).
- `POST /provider/orders/{id}/milestones { code, occurredAt, estimatedAt?, note?, evidenceFileIds?, location? }` (provider/broker), or via driver events (module 08).
- Rules:
  - Milestones must be recorded in sequence, but optional ones can be skipped with a reason.
  - `occurredAt` can't be in the future and can't be more than 72 h in the past without staff override.
  - Evidence photos are required for `CARGO_COLLECTED` (photos + unit count) and `GOODS_RECEIVED`.
- Every milestone stores its `source` and timestamp, and the customer UI shows them (*"Show status and update source clearly"*).
- `estimatedAt` updates (for example ETA 05/10/2026) are also versioned.
- Staff corrections go through `POST /admin/orders/{id}/milestones/{mid}/correct` with a reason, and the correction is shown as `source: ADMIN`.

## Additional charges ("no unapproved charges")
- Provider: `POST /provider/orders/{id}/additional-charges { description, amount, taxable }` → `PROPOSED`, and the customer is notified.
- Customer: `POST /orders/{id}/additional-charges/{cid}/approve` → payment intent → `PAID` | `/reject` (with reason).
- Charges become part of the order amounts only after `PAID`. Commission applies per D-02.

## Completion evidence (POD)
`POST /provider/orders/{id}/completion-evidence` with:
- `recipientName`, `handedOverAt`
- `photoFileIds[]` (min 1 for physical deliveries)
- `signatureFileId?`
- `releaseNoticeDocumentId?` (customs)
- `note`

Effects: order → `AWAITING_ACCEPTANCE`, the customer is notified to confirm receipt, reminders are scheduled (24 h, 48 h), and the auto-acceptance timer starts (72 h, D-10).
*"Provider evidence does not replace customer acceptance."*

## Receipt confirmation (RC)
`POST /orders/{id}/receipt-confirmation` with:
- `condition` (`INTACT` | `SHORTAGE` | `DAMAGE`)
- `unitCountConfirmed`
- `recipientName`, `signatureFileId?`, `photoFileIds[]`, `notes`
- `consent: RECEIPT_CONFIRMATION` (*"I confirm inspection and receipt — confirmation time is recorded"*)

- `INTACT` → order `COMPLETED`, settlement scheduled, rating prompt, invoice available.
- `SHORTAGE`/`DAMAGE` → order `DISPUTED`, a case of type `DAMAGE_REPORT` is created (module 13) and the settlement is held. The client rule is *"Record on delivery; report within 24 hours"*, so a follow-up report `POST /orders/{id}/damage-reports` is accepted up to 24 h after RC, even if RC was `INTACT`. After 24 h, only a general support case is possible.
- Warehousing: RC is replaced by reconciliation acceptance (WH07). Customs: by "Confirm clearance completion" (CU09).

## Completion and rating (DONE)
`POST /orders/{id}/rating { stars, comment? }` is allowed once per order, within 30 days of completion. The DONE screen also offers:
- "Download PDF invoice" (module 12),
- "Open an order-linked case" (module 13),
- "Reuse request details": `POST /service-requests/{id}/duplicate` creates a new draft with the same details and new dates.

## Unified "My orders" feed (X01, K-O02)
`GET /orders/feed?kind=SERVICE|PURCHASE&serviceType&status&q&cursor` merges service orders and purchase orders into one list item shape:
`{ kind, id, reference, title, statusCode, statusLabelKey, updatedAt, nextActionCode? }`.
Filter chips: *Choose service or marketplace*. Search by reference or route.

## Linked orders
`OrderLink` relations appear in both orders' details. A child order has its own lifecycle, payment and settlement. Parent completion does not wait for the child, but the parent timeline shows child milestones as read-only (e.g. customs clearance inside a shipping journey).

## API summary

| Method | Path | Actor |
|---|---|---|
| GET | `/orders/feed` | Customer |
| GET | `/orders/{id}` / `/orders/by-reference/{ref}` | Customer, provider (own), staff |
| GET | `/orders/{id}/timeline` | Customer, provider |
| POST | `/provider/orders/{id}/confirm-readiness` | Provider |
| POST | `/provider/orders/{id}/milestones` | Provider/broker |
| POST | `/provider/orders/{id}/completion-evidence` | Provider |
| POST | `/orders/{id}/receipt-confirmation` | Customer |
| POST | `/orders/{id}/damage-reports` | Customer (≤ 24 h) |
| POST | `/orders/{id}/rating` | Customer |
| POST | `/orders/{id}/additional-charges/{cid}/approve \| reject` | Customer |
| POST | `/provider/orders/{id}/additional-charges` | Provider |
| POST | `/orders/{id}/linked-requests` | Customer |
| GET | `/provider/orders?status&serviceType` | Provider ("Active jobs") |

## Events
`order.created`, `order.confirmed`, `order.scheduled`, `order.milestone_recorded`, `order.eta_updated`, `order.completion_submitted`, `order.receipt_confirmed`, `order.damage_reported`, `order.completed`, `order.auto_accepted`, `order.rated`, `additional_charge.proposed`/`approved`/`rejected`/`paid`.

## Acceptance criteria
- [ ] Follow-up screens for all services render from one contract, with `allowedActions` driving buttons.
- [ ] Every milestone shows its source and timestamp. Staff corrections are visible as admin-sourced.
- [ ] POD → RC → COMPLETED → settlement scheduled works for all services. A damage report holds the settlement.
- [ ] Extra charges cannot be added to the payable amount without customer approval and payment.
