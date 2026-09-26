# Module 10 — Customs Clearance

## Purpose
Import, export and transit clearance through licensed customs brokers. It covers:
- the customs file and required documents,
- broker document review,
- broker authorization (mandate) tracking,
- declaration execution status (manual first, Fasah later),
- release notice and handover to transport.

## Screens served
- Customer: CU01 Customs clearance request, CU02 Import and transit details, CU03 Import/transit documents, CU04 Export documents, CUR/CUQ/CUP/CUF, CU05 Create broker authorization, CU06 Authorization status, CU07 Document review, CU08 Clearance progress, CU09 Customs released, then (linked) TR05 → RC → DONE. Kit: K-D01 Customs request, K-D02 Document vault, K-D03 Correct a document, K-D04 Customs progress.
- Provider (broker): PC1 Review customs file, PC2 Check broker authorization, PC3 Declaration execution, POD (release notice).

## Request details (CustomsRequestDetails)

| Step | Fields | Rules |
|---|---|---|
| CU01 | `movement` IMPORT/EXPORT/TRANSIT, `checkpointType` SEA/AIR/LAND/DRY_PORT, `checkpointId` (e.g. Jeddah Islamic Port / other), `cargoType` + `cargoQuantity` (Dry container • 1), `otherRequirements` | — |
| CU02 (import/transit) | `arrivalPortId`, `shipmentQuantity`, `transitDestination` (transit only), `exitCheckpointId` (required for transit), `notes` | *"Fields adapt to the selected movement"* |
| CU03 (import/transit docs) | B/L, commercial invoice, packing list, certificate of origin, SABER certificate (*as applicable to the product*), other (name + attachment) | Upload or scan |
| CU04 (export docs) | `departurePortId` + quantity, booking confirmation, commercial invoice, certificate of origin, other | — |
| Kit K-D01 extras | `billOfLadingNo` (e.g. BL-2026-08412), `hsCode`, `goodsDescription` | Format checks |

*"Import/transit use CU02 and CU03; export uses CU04. Final requirements depend on the shipment."*

## Entities

| Entity | Key fields |
|---|---|
| `BrokerAuthorization` | `order_id`, `customer_org_id`, `broker_org_id`, `authorizing_business` (legal name + CR snapshot), `scope` (order reference/operations), `valid_from`, `valid_to`, `status`, `official_reference?`, `evidence_file_id?`, `confirmed_by` + `confirmed_source` (BROKER/ADMIN/INTEGRATION), `confirmed_at` |
| `CustomsDeclaration` | `order_id`, `declaration_reference?` (e.g. CU-2048 sample), `manifest_reference?`, `status` (`NOT_STARTED`/`SUBMITTED`/`UNDER_INSPECTION`/`DUTIES_ASSESSED`/`DUTIES_PAID`/`RELEASED`/`HELD`), `duties_amount?` (**separate from broker fees**), `duties_paid_by` (CUSTOMER_DIRECT/BROKER_ON_BEHALF), `inspection_notes`, `last_update_source`, `last_update_at` |
| `ReleaseNotice` | `order_id`, `document_id`, `released_at`, `port_collection` (LINK_TRANSPORT/SELECT_CARRIER/SELF) |

## Flow

1. **Request → quotes → pay** (module 05). Only `CUSTOMS_BROKER` providers covering the checkpoint are matched.
2. **Broker file review (PC1):** movement and checkpoint (*review customer details*), documents (*accept or request changes per file*), origin & SABER (*review as applicable to the shipment*), other (*request another document with a reason*). The customer sees CU07: *Commercial invoice — Accepted; Certificate of origin — A clear stamp image is required; SABER — Under review where applicable; Other — Add a broker-requested document*, with "Replace certificate".
3. **Authorization (CU05 → CU06 / PC2):**
   - The customer reviews the selected broker (*Al Masar Customs • licence*), authorizing business, scope and validity (*Order LX-2048 • defined validity*), and approves (*"Creates a request; not yet an active mandate"*) → `REQUESTED`, consent `BROKER_AUTHORIZATION`.
   - CU06 timeline: *Request created — details saved → External action — complete official action if required → Authorization reference — awaiting confirmation → Status — inactive until an authorized confirmation*. "Refresh authorization" re-fetches (and later polls the integration).
   - Broker PC2: authorizing business (*view registration details*), authorization reference (*awaiting official confirmation*), scope & validity (*match the operation*), required action (*notify customer to complete activation*) → sets `PENDING_EXTERNAL_ACTION` or `ACTIVE` with the official reference + evidence.
   - **Guard:** the declaration steps in PC3 are blocked unless the authorization is `ACTIVE`. *"An in-app authorization request is not proof of Fasah activation. Show status and update source clearly."*
4. **Declaration execution (PC3):** declaration reference (*enter the actual reference*), manifest (*link reference and available files*), inspection & duties (*update status and attach evidence*), update source (*Broker • date and time*). Mode: *"Manual updates or an approved active integration."*
   - CU08 (customer): *Customs declaration: sample reference CU-2048 → Document review: completed → Inspection and duties: in progress • separate from broker fees → Release: awaiting confirmation*.
5. **Release (POD):** the broker uploads the release notice. *"Completion evidence here is the release notice. Clearance acceptance differs from physical goods receipt."*
6. **CU09 Customs released (customer):**
   - Release notice (*view and download document*)
   - Charges (*broker fees and duties itemized separately*)
   - Port collection (*link transport or select a carrier*), which creates a linked transport request (`PORT_COLLECTION`)
   - Confirmation (*"Confirm clearance completion"*), the RC equivalent → order `COMPLETED` → settlement
   - *"CU09 completes customs work; transport and receipt appear only for a linked delivery order."*

## Duties and government charges
- Duties and VAT on imports are paid to customs (via SADAD/Fasah) by the importer or by the broker on the importer's behalf. They are **pass-through** amounts, not platform revenue, and never commissionable (D-02).
- MVP: recorded as information (amount + receipt document) on the declaration. If the broker pays on the customer's behalf, reimbursement is requested as an `AdditionalCharge` flagged `PASS_THROUGH` (VAT-exempt line, no commission). Confirm with the tax advisor.

## Fasah adapter (see module 17)
- `FasahAdapter` interface: `getAuthorizationStatus(ref)`, `getDeclarationStatus(ref)`, `getManifest(ref)`, `submitDeclaration(payload)` (future).
- `ManualFasahAdapter` (Phase 2) reads the latest manual update. `FasahApiAdapter` (Phase 4) is used only after scope confirmation and approval, with credentials server-side.
- Every status shown to the customer includes `source` (BROKER/INTEGRATION/ADMIN) and `updatedAt`.

## API

Customer:

| Method | Path |
|---|---|
| GET | `/orders/{id}/customs` (declaration, authorization, documents summary, charges) |
| POST | `/orders/{id}/broker-authorizations` (CU05) |
| GET | `/orders/{id}/broker-authorizations/current` / POST `…/{aid}/refresh` / POST `…/{aid}/revoke` |
| POST | `/orders/{id}/confirm-clearance` (CU09) |
| POST | `/orders/{id}/linked-requests` `{serviceType: TRANSPORT, linkType: PORT_COLLECTION}` |

Broker:

| Method | Path |
|---|---|
| GET | `/provider/orders/{id}/customs-file` (PC1) |
| POST | `/provider/orders/{id}/documents/{docId}/review` / `/document-requests` |
| PATCH | `/provider/broker-authorizations/{id}` `{ status, officialReference?, evidenceFileId?, note }` (PC2) |
| PUT | `/provider/orders/{id}/declaration` `{ declarationReference?, manifestReference?, status, dutiesAmount?, evidenceFileIds?, note }` (PC3) |
| POST | `/provider/orders/{id}/release-notice` `{ documentFileId, releasedAt }` |

## Events
`customs.document_reviewed`, `customs.authorization_requested`/`activated`/`expired`/`revoked`, `customs.declaration_updated`, `customs.released`, `customs.clearance_confirmed`.

## Acceptance criteria
- [ ] Fields and document checklists adapt correctly to import, export and transit.
- [ ] Declaration updates are impossible without an `ACTIVE` authorization (server-enforced).
- [ ] Every status on CU06/CU08 displays its source and timestamp.
- [ ] Broker fees and duties are always shown separately, and duties are never commissioned.
- [ ] Port collection creates a linked transport request pre-filled from the port and the customer's address.
