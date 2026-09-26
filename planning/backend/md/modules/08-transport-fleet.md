# Module 08 — Transport, Fleet, Drivers and GPS

## Purpose
Domestic and cross-border road transport with a dedicated vehicle. It covers fleet management for carriers, broker assignment of external carriers, the driver job flow, live GPS tracking, trip issues and border stages.

## Screens served
- Customer: TR01 New transport request, TR02 Pickup and drop-off, TR03 Load details, TR04 Car carrier request, TRR/TRQ/TRP/TRF, TR05 Your vehicle is on the way, TR06 Trip progress, RC, DONE. Kit: K-H02 (choose service), K-L01 Set the route, K-L02 Vehicle and cargo, K-L03 Schedule and extras, K-L04 Review, K-T01 Track.
- Provider: PT1 Assign vehicle and driver, K-P09 Execute the shipment, fleet and licences (K-P05 "Fleet & licences" tile).
- Driver: PT2 Driver assignment, PT3 Loading and trip updates, POD.
- Dashboard: live trips map, fleet documents expiry.

## Request details
`TransportRequestDetails`. Step rules:

| Step | Fields | Rules |
|---|---|---|
| TR01 | `scope` DOMESTIC/CROSS_BORDER, `vehicleTypeId` (dry, reefer, light truck, lowbed, curtain-side, car carrier, trailer, flatbed, other + description) | Cross-border → destination country ≠ SA |
| TR02 | `pickup` / `dropoff` (address or map pin, e.g. Riyadh Industrial City → Jeddah warehouses), `contacts` per stop, `transportDate` (+ optional time window) | Both pins required; date ≥ today; route estimate computed |
| TR03 (general cargo) | `commodity`, `weight` + unit (kg/ton), `quantity` + unit (pallets/units), `loadingAssistance` ASSISTANCE/FORKLIFT/NONE, `temperatureC` (reefer only), `specialHandling` | Weight ≤ vehicle capacity (warning, not a block) |
| TR04 (car carrier) | `vehiclesCount`, pickup/drop-off, date, notes | Replaces TR03 (*"car carriers use TR04 instead of commodity and weight fields"*) |
| Kit K-L03 extras | loading/unloading assistance, temporary storage/cross-docking, handling instructions | Stored as `extras` add-ons |

## Fleet (carrier providers)

**Vehicle**: `organization_id`, `plate_number` (Saudi format), `vehicle_type_id`, `capacity_ton`, `is_reefer`, `status` (`ACTIVE`|`INACTIVE`|`SUSPENDED`), documents: `VEHICLE_OPERATING_CARD` (expiry), insurance (expiry).

**Driver** (a membership with role `DRIVER`): `user_id`, `organization_id`, `license_number` (encrypted), `license_expiry`, `national_id` (encrypted), `status` (`INVITED`|`ACTIVE`|`SUSPENDED`), `is_approved` (by provider owner; staff can audit).

- Invite a driver by phone: `POST /provider/fleet/drivers { phone, name, licenseNumber, licenseExpiry, licenseFileId }`. The driver signs in with OTP and sees the driver workspace only.
- Expired vehicle or driver documents block assignment (`409 ASSET_DOCUMENT_EXPIRED`).

## Assignment (PT1)
`POST /provider/orders/{id}/assignment`, one of:
- **Own fleet:** `{ vehicleId, driverUserId }`. Guards: vehicle type matches the request (or is compatible), vehicle and driver are available (no overlapping active trip), and documents are valid.
- **Broker:** `{ externalCarrier: { companyName, crNumber?, driverName, driverPhone, plateNumber, vehicleTypeId } }` (D-20). The broker remains accountable. The driver can optionally be invited as a guest driver (limited to this trip).

Effects: `TripAssignment` is created, the milestone `DRIVER_ASSIGNED` is set, the customer sees *Driver & vehicle: Mohammed • truck 4821*, and the driver gets a push "New job assigned".

Reassignment is allowed before `CARGO_COLLECTED`. It is logged, and the customer is notified.

## Driver job flow (PT2 → PT3 → POD)

| Driver action | API | Milestone / effect |
|---|---|---|
| Open the job | `GET /driver/jobs/{id}` | Sees pickup (Riyadh • view route), drop-off (Jeddah • recipient details), load (20 pallets • loading instructions), contact (message order coordinator). **No prices** |
| Start heading to pickup | `POST /driver/jobs/{id}/events {type: START_TO_PICKUP}` | `HEADING_TO_PICKUP`; GPS tracking starts |
| Arrived at pickup | `…{type: ARRIVED_AT_PICKUP}` | `ARRIVED_AT_PICKUP` (feeds the cancellation stage, 25%) |
| Inspect & collect | `…{type: CARGO_COLLECTED, unitCount, photoFileIds[]}` | `CARGO_COLLECTED` (100% cancellation stage) |
| Start journey | `…{type: DEPARTED}` | `IN_TRANSIT` (*Record departure time*) |
| Border crossing | `…{type: BORDER_CROSSED, borderPoint, documentsFileIds[]}` | Cross-border only |
| Operational issue | `POST /driver/jobs/{id}/issues {type: DELAY \| ACCESS \| BREAKDOWN \| OTHER, reason, etaImpactMin?}` | Customer and provider notified; shown on TR06 |
| Arrived at drop-off | `…{type: ARRIVED_AT_DROPOFF}` | |
| Proof of delivery | `POST /driver/jobs/{id}/pod {recipientName, signatureFileId, photoFileIds[], note}` | Creates the completion evidence (module 06) → `AWAITING_ACCEPTANCE` |

*"Drivers see assigned jobs only; brokers monitor assigned carriers. Customer RC precedes payout."*

Offline tolerance: driver events carry client `eventId` + `occurredAt`, and are accepted late (≤ 72 h) and deduplicated by `eventId`.

## GPS tracking

- **Ingest:** `POST /driver/jobs/{id}/locations` with a batch `[{lat,lng,accuracyM,speedKph,heading,recordedAt}]`, at most 1 batch per 10 s. It is accepted only while the trip is between `HEADING_TO_PICKUP` and `DELIVERED`.
- **Storage:** latest position in Redis (`trip:{id}:last`, TTL 24 h). History goes to `tracking_points` (partitioned monthly), downsampled to 1 point per 60 s after 7 days, and deleted or aggregated after 12 months (proposal).
- **Fan-out:** a Socket.IO event `tracking.location` goes to room `order:{id}`, throttled to 10 s. The dashboard live map subscribes to `staff:ops`.
- **Customer view (TR05):** map with route polyline, current location *"Updated one minute ago"*, pickup arrival *"Expected 10:30"*, current stage *"Driver heading to pickup"*. The ETA is recomputed via the maps API at most every 5 min per trip.
- **Stale signal:** no location for 10 min on an active trip → "Location not updated since HH:MM" + ops alert at 30 min.
- **Privacy:** location is collected only during active trips, and the driver sees a persistent tracking indicator.
- Map data is labelled "Illustrative route" in design; production shows the real route.

## Cross-border specifics
- Border stage milestone and documents (`BORDER_DOCUMENTS`) are required before `ARRIVED_AT_DROPOFF` when the scope is `CROSS_BORDER` (*"Cross-border jobs add a border-crossing stage and required documents before delivery"*).

## API summary (provider/driver)

| Method | Path |
|---|---|
| GET / POST / PATCH | `/provider/fleet/vehicles` |
| GET / POST / PATCH | `/provider/fleet/drivers` (invite, suspend) |
| POST | `/provider/orders/{id}/assignment` / DELETE (unassign before collection) |
| GET | `/provider/trips/live` (broker/carrier monitoring) |
| GET | `/driver/jobs?status=ACTIVE\|UPCOMING\|DONE` |
| GET | `/driver/jobs/{id}` |
| POST | `/driver/jobs/{id}/events`, `/locations`, `/issues`, `/pod` |
| GET | `/orders/{id}/tracking` (customer: last location, route, ETA, stage) |

## Events
`trip.assigned`, `trip.reassigned`, `trip.event_recorded`, `trip.issue_reported`, `trip.location_stale`, `vehicle.document_expiring`, `driver.license_expiring`.

## Acceptance criteria
- [ ] The car carrier flow skips commodity/weight and captures the vehicle count.
- [ ] Assignment is blocked for incompatible or expired assets, and brokers can assign external carriers.
- [ ] The driver app shows only assigned jobs without financial data, and events work offline and sync without duplicates.
- [ ] The customer map updates within 5 s of ingest (p95), and stale-location handling works.
- [ ] Cross-border trips cannot deliver without the border stage and documents.
