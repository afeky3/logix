# Module 09 — Warehousing

## Purpose
Book warehouse space, schedule intake, count and store goods, keep a live inventory balance per customer contract, handle partial and full stock releases, and reconcile at term end. Settlement follows reconciliation (D-12).

## Screens served
- Customer: WH01 Book warehouse space, WH02 Goods and handling, WHR/WHQ/WHP/WHF, WH03 Warehouse intake booking, WH04 Your stored inventory, WH05 Request stock release, WH06 Release progress, WH07 Storage reconciliation, DONE. Kit: K-W01 Storage needs, K-W02 Review storage.
- Provider: PW1 Capacity and intake slots, PW2 Receive and count goods, PW3 Stock and release management, POD.
- Dashboard: contracts, inventory audit, release approvals oversight.

## Entities

| Entity | Key fields |
|---|---|
| `WarehouseSite` | `organization_id`, `name`, `city_id`, `address`, `geo`, `storage_types[]`, `capacity_pallet_positions`, `temperature_ranges`, `status` |
| `StorageContract` | `order_id`, `site_id`, `storage_type`, `start_date`, `end_date`, `booked_capacity` (pallet positions/sqm), `status` (state machine §5), `agreed_amount`, `billing_mode` (D-12) |
| `IntakeSlot` | `contract_id`, `slot_at`, `expected_quantity`, `transport_mode` LINKED/SELF, `linked_order_id?`, `status` |
| `InventoryItem` | `contract_id`, `description` (e.g. Packaging materials), `uom` (PALLET), `location_code` (e.g. A-04), `condition` |
| `StockMovement` | `item_id`, `type` INTAKE/RELEASE/ADJUSTMENT/RETURN, `quantity` (+/−), `reason`, `evidence_file_ids[]`, `recorded_by`, `occurred_at`, `release_request_id?` |
| `ReleaseRequest` | `reference` (`LX-xxxx-R{n}`), `contract_id`, lines (`item_id`, `quantity`), `release_date`, `collection_method` LINKED_CARRIER/SELF, `collector` (carrier + trip ref or person name/ID), `status`, `notes` |
| `Reconciliation` | `contract_id`, `period`, `storage_days`, `agreed_charges`, `additional_charges[]` (approved only), `remaining_stock`, `status` (DRAFT/SUBMITTED/ACCEPTED/DISPUTED) |

**Balances** (derived, cached per item):
- `received` = Σ intake
- `available` = received − released − reserved
- `reserved` = quantities in approved but not yet handed-over releases

WH04 shows: *Received 20 pallets • Available 18 • Reserved for release 2 • Stock condition: intact, view intake photos*.

## Flow

```mermaid
sequenceDiagram
  participant C as Customer
  participant API
  participant W as Warehouse provider
  C->>API: WH01/WH02 request → quotes → accept & pay (WHP)
  API-->>W: order CONFIRMED
  W->>API: confirm readiness + propose intake slots (PW1)
  C->>API: WH03 confirm intake slot (+ linked transport or self-delivery)
  W->>API: PW2 receive & count (expected vs actual, condition, photos, location)
  API-->>C: WH04 inventory live (contract ACTIVE)
  C->>API: WH05 request release (qty ≤ available)
  W->>API: PW3 approve → picking → ready → handover to collector
  API-->>C: WH06 progress; balance updated
  Note over C,W: repeat releases (partial) …
  C->>API: final release → contract CLOSING
  W->>API: reconciliation (WH07) → submit
  C->>API: accept reconciliation → RECONCILED → DONE; settlement scheduled
```

## Rules
1. **Intake (PW1/WH03):** the provider publishes available capacity (e.g. *30 pallet spaces available, 20 booked*) and proposes slots. The customer confirms one (*01/10/2026 • 10:00*). `transport_mode = LINKED` creates or links a transport request (`TRANSPORT_TO_WAREHOUSE`).
2. **Receive and count (PW2):** record expected vs actual quantity, condition check (*photos, notes and discrepancies*) and storage location (*A-04 • attach stock record*).
   - Discrepancies (actual ≠ expected, or damage) notify the customer, who must acknowledge.
   - The customer can open a case.
   - The first counted intake sets the contract to `ACTIVE` and the milestone `GOODS_RECEIVED`.
3. **Release request (WH05):** item, quantity (*2 pallets of 18 available*), release date, collection method (linked carrier / self-collection), release and handover instructions. The server rejects quantities above `available`.
4. **Release execution (PW3/WH06):**
   - The provider approves, which reserves the quantity.
   - Picking: *select units and storage location*.
   - Collector check: *approved carrier and trip reference*, or the named person.
   - Handover with evidence.
   - WH06 shows *Request reviewed → Pick and prepare → Carrier handover → Expected stock balance: 16 available pallets after release*.
5. **Partial vs final:** *"Partial release returns to inventory; final closure requires no remaining stock."* *"Each movement updates the customer balance. Partial release does not close the storage contract."*
6. **Term end:** 7 days before `end_date`, the customer is notified with options: extend (extension quote/approval → additional charge), or release all. After `end_date` with stock remaining, overstay applies per D-12, and charges require approval.
7. **Reconciliation (WH07):** storage period (30 days), agreed charges (3,450 SAR), additional services (*require approval before charging*), remaining stock (*zero for full closure*). Customer acceptance = RC equivalent → order `COMPLETED` → settlement.
8. **POD for warehousing** is the final handover evidence plus the submitted reconciliation.

## API

Customer:

| Method | Path |
|---|---|
| GET | `/orders/{id}/storage` (contract, site, dates, status) |
| GET | `/orders/{id}/intake-slots` / POST `/orders/{id}/intake-slots/{slotId}/confirm` |
| GET | `/orders/{id}/inventory` (items, balances, photos) |
| POST | `/orders/{id}/release-requests` / GET `/release-requests/{id}` |
| POST | `/release-requests/{id}/cancel` (before picking) |
| GET | `/orders/{id}/reconciliation` / POST `…/accept` / POST `…/dispute` |

Provider:

| Method | Path |
|---|---|
| CRUD | `/provider/warehouse-sites` |
| POST | `/provider/orders/{id}/intake-slots` (propose) |
| POST | `/provider/orders/{id}/stock-intake` `{ slotId, lines:[{description, expectedQty, actualQty, condition, locationCode, photoFileIds}], discrepancyNote? }` |
| POST | `/provider/release-requests/{id}/approve \| reject \| picking \| ready \| handover` |
| POST | `/provider/orders/{id}/stock-adjustments` (with reason; customer notified) |
| POST | `/provider/orders/{id}/reconciliation` (submit) |

## Events
`storage.intake_slot_proposed`/`confirmed`, `storage.goods_received`, `storage.discrepancy_reported`, `storage.release_requested`/`approved`/`handed_over`, `storage.balance_changed`, `storage.term_ending`, `storage.reconciliation_submitted`/`accepted`.

## Acceptance criteria
- [ ] Balances always equal Σ movements, and concurrent releases cannot oversubscribe stock.
- [ ] Partial releases keep the contract active, and closure requires zero stock.
- [ ] Discrepancies at intake are visible to the customer with evidence.
- [ ] Reconciliation includes only customer-approved additional charges.
