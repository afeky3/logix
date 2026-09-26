# Module 07 — Shipping (Freight)

## Purpose
International and express freight: sea (FCL/LCL), air, express parcels and international land freight. It covers optional door-to-door, linked customs clearance and cargo insurance. Execution is performed by freight providers (forwarders, carriers, express companies).

## Screens served
- Customer: SH01 How are you shipping?, SH02 Origin and destination, SH03 Sea freight cargo, SH04 Air or express cargo, SH05 International land freight, SH06 Additional services, SH07 Door-to-door details, SHR/SHQ/SHP/SHF, SH08 Shipment journey, SH09 Shipment documents, RC, DONE. Kit: K-F01–K-F07.
- Provider: PS1 Book freight capacity, PS2 Execution documents, PS3 Update shipment milestones, POD.

## Request details
Entity `ShippingRequestDetails` ([03-domain-model.md §5](../03-domain-model.md#5-service-requests-and-quotes)). Field rules per step:

| Step | Fields | Validation |
|---|---|---|
| SH01 mode | `mode` SEA/AIR/LAND, `isExpress`, `isDoorToDoor`, `tradeDirection` IMPORT/EXPORT | Express only with AIR (or a dedicated EXPRESS parcel mode); LAND hides container fields |
| SH02 route | Sea: `originPortId`, `destinationPortId`. Air: airports. Land: origin/destination country + city. `cargoReadyDate`, `otherRequirements` | Ready date ≥ today; origin ≠ destination; for IMPORT the destination country must be SA and for EXPORT the origin country must be SA (proposal; confirm) |
| SH03 sea | `commodity` (+ "other"), `containerType` DRY/REEFER/OTHER, `containerSize` 20/40/LCL, `containerCount`, `weightKg`, LCL: `volumeCbm` + `packageCount` | FCL: count ≥ 1; LCL: volume > 0; reefer → temperature required |
| SH04 air/express | `originAirport`/`destinationAirport` (e.g. DXB → RUH), `commodity`, `weightKg`, `packageCount`, `packages[]` (L×W×H cm), `handlingRequirements` | Chargeable weight computed server-side (volumetric ÷ 6000) and shown as info |
| SH05 land | `originCountry+City`, `destinationCountry+City` (e.g. Riyadh → Dubai), `commodity`, `palletCount`, `weightKg`, `borderInstructions` | Different countries |
| SH06 services | `isDoorToDoor`, `wantsCustomsClearance`, `wantsInsurance`, `otherRequirements` | Insurance → opens module 14 flow after award (compare insurers) |
| SH07 D2D | `pickupAddressId` (warehouse & gate number), `deliveryAddressId` (national address + map pin), `contacts` (sender/recipient name, phone), `pickupWindow` (e.g. 09:00–12:00), `accessNotes` | Only when D2D; phone format; window start < end |

Routing: *"From SH01: sea to SH03, air/express to SH04, land to SH05"*. *"Door to Door opens SH07 before review."* Shipping-land vs Transport overlap: see D-13.

## Execution (freight provider)

### PS1 Book freight capacity
`PUT /provider/orders/{id}/freight-booking` with:
- `carrierType` (LINE/AIRLINE/ROAD_CARRIER), `carrierName`
- `vesselOrFlight?`, `voyage?`
- `capacityConfirmed` (bool), `etd`, `eta`
- `bookingReference`, `bookingConfirmationFileId`
- `handlingPartners?`, `notes`

Effect: records the booking, and the milestone `BOOKING_CONFIRMED` is set to DONE (source PROVIDER).

### PS2 Execution documents (by mode)
`PUT /provider/orders/{id}/freight-references` with:
- **Sea:** `billOfLadingNumber`, `containerNumbers[]` (ISO 6346 check digit validation), `sealNumbers[]`
- **Air/express:** `awbNumber` (11 digits, check digit), `parcelTrackingRef`
- **Land:** `vehiclePlate`, `driverName`, `borderDocumentsFileIds[]`

Plus documents through module 04 (B/L, AWB, invoice, packing list, origin/SABER "as applicable", other).

### PS3 Update shipment milestones
Milestones from the template: pickup (*Confirm cargo collection*), departure (*Actual departure time*), arrival (*Estimated or actual arrival*), final delivery (*Assign the door-to-door final leg*).
- *"Your updates appear in the customer view"*, shown in SH08 with timestamp and source.
- "Assign the door-to-door final leg": the provider either (a) performs it themselves (milestones `OUT_FOR_DELIVERY` → `DELIVERED`), or (b) triggers a linked transport request (`DELIVERY_LEG`) that the customer can approve. The latter is a proposal to confirm with product.
- *"Sea and air use journey milestones; vehicle maps apply to road legs when data is available."* A live map is only offered on legs with driver GPS (land or D2D legs via transport).

### POD
For D2D: photos, signature, recipient name. Port-to-port: the arrival notice/release document for the consignee. Then RC by the customer.

## Customer views
- **SHF follow-up** (module 06 contract).
- **SH08 Shipment journey:** header `LX-2048 • sea • updated 2 minutes ago`, milestone list (Picked up: cargo receipt recorded; Departed: departure confirmed; Estimated arrival 05/10/2026; Clearance & delivery: awaiting arrival).
- **SH09 Shipment documents:** checklist and statuses. "Upload document" for the customer's own files.

## Linked services
- `wantsCustomsClearance` → after the shipping order is confirmed, a linked customs request (`CUSTOMS_FOR_SHIPMENT`) is created pre-filled (movement = trade direction, port = destination/departure port, B/L when available). The customer reviews and submits it to get broker quotes (or the same provider quotes if it also holds `CUSTOMS_BROKER`).
- `wantsInsurance` → the insurance compare flow (IN1) is offered on SHF with the declared value prefilled.

## Validation helpers
- ISO 6346 container number check digit; IATA AWB mod-7 check digit; UN/LOCODE lookups.
- Chargeable weight for air: `max(actualKg, Σ(L×W×H)/6000)`. This is informational only; the provider's quote is authoritative.

## Events
`shipping.booking_confirmed`, `shipping.references_updated`, plus core order events.

## Acceptance criteria
- [ ] Each mode shows only its relevant fields, and switching mode clears incompatible fields after a confirmation.
- [ ] D2D requires SH07 before review, and the addresses flow into the order and the POD.
- [ ] Container, AWB and B/L references validate and appear on SH08/SH09.
- [ ] Linked customs and insurance appear on the shipment follow-up with their own statuses.
