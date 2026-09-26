# Module 11 — Marketplace (B2B)

## Purpose
Classifieds-style product discovery in Logix branding, with **B2B purchasing and payment kept in-app**. It covers suppliers' listings, search, favorites, supplier profiles, supplier chat, carts, checkout, purchase orders, fulfilment through a linked transport order, receipt, returns and supplier settlements.

## Screens served
- Buyer: M01 Business marketplace, M02 Search results, M03 Product details, M04 Supplier profile, M05 Supplier conversation, M06 Your cart, M07 Delivery and payment, M08 Purchase confirmed, M09 Purchase tracking, RC, M10 Return or replacement, M11 Return tracking. Kit: K-M01–K-M06, K-M07/K-M08 supplier comparison & profiles, K-R01/K-R02.
- Supplier: S01 Supplier dashboard, S02 Photos and product details, S03 Pricing and inventory, S04 Preview and publish, S05 New purchase order, S06 Shipment readiness, S07 Handover to carrier, S08 Sales settlement, SR1 Review return request, SR2 Resolve return. Kit: K-S01–K-S07.
- Dashboard: categories, product moderation, supplier oversight, purchase orders, returns escalations.

## 1. Catalog

**Product** fields and rules:

| Field | Rule |
|---|---|
| `name`, `categoryId`, `description`, `specs` (key/value: size, material, use) | Required. Specs are shown as a list (e.g. "5-ply • made in Saudi Arabia") |
| `originCountry` | Required ("Saudi Arabia / other") |
| `condition` | `NEW` only at launch (*"Products must be new, original, compliant and not counterfeit"*) |
| `images[]` | 1–10 real photos (*"Upload multiple real photos"*); moderation before public CDN |
| `unit`, `packSize` (e.g. 100 pieces/pack), `leadTimeDays` (e.g. 2) | Required |
| `unitPrice` + `vatTreatment` (`EXCLUSIVE` default; *"state VAT treatment"*) | > 0 |
| `moq` (e.g. 100), `stockQty` (e.g. 5,000) | `moq` ≥ 1; stock ≥ 0 |
| `cityId` / pickup location | Used in the location filter and delivery pricing |
| `supplyNotes` | Optional |

- Publishing (S04) requires the `LISTING_ACCURACY` consent (*"Including intellectual property and quality"*) and shows the 3.5% commission per successful sale.
- *"Stock and listings can be edited later; prices on confirmed orders remain fixed."* PO items snapshot the price, VAT treatment and name.
- Auto `OUT_OF_STOCK` when `stockQty < moq`. Inventory filter chips (kit K-S02): all / active / low stock, with a configurable low-stock threshold.
- Moderation: optional pre-publication review (flag), plus reactive takedown with reason (`REMOVED`).

**Supplier profile (M04):** verification badge (*Business details verified*), location (Riyadh Industrial City), supply terms (*MOQ 100 • ready in 2 days*), rating (4.8/5), contact (*in-app chat and specification sharing*). Legal disclosure fields (CR, VAT number) come from KYB, per the e-commerce law.

## 2. Discovery and search

`GET /marketplace/products` parameters:
- `q`
- `categoryId`
- `cityId[]` (*Riyadh / Jeddah / all cities*)
- `priceMin` / `priceMax` (*100 – 5,000 SAR*)
- `inStock`
- `moqMax`
- `verifiedOnly`
- `sort`: `newest` | `price_asc` | `price_desc` | `verified_supplier` | `relevance`

- M01 home: search box, city/category chips (*Riyadh • Equipment • Packaging • Other*), product grid cards (image, favorite heart, name, price), CTA "Explore products".
- Result count shown (*"Packaging • 128 results"*).
- **Implementation (T-06):** PostgreSQL `tsvector` (simple config + custom Arabic normalization function) + `pg_trgm` for fuzzy matching. The search document includes name, category names (ar/en), specs values and supplier name. Reindex on `product.*` events.
- Favorites: `PUT/DELETE /marketplace/favorites/{productId}`, `GET /marketplace/favorites`.

## 3. Supplier conversation (M05)
- `POST /conversations { type: PRODUCT_INQUIRY, productId }` → a thread between the buyer org and the supplier org. Attachments allowed (*"Attach an image or file"*).
- Price negotiation outcome: *"Final agreed prices appear in the order."* MVP rule: the listed price applies. Negotiated pricing via a supplier-issued **custom offer** (a product-specific price for that buyer, valid N days) is a Phase 3+ option (to confirm). The chat never changes a price by itself.
- Off-platform contact is masked before the first paid PO between the parties (D-16).

## 4. Cart and checkout

- **Cart:** one cart per buyer org, grouped by supplier (M06 *"Order from Packaging Factory"*). Items: qty (≥ MOQ, *"Minimum 100 units"*), subtotal (e.g. *100 × 12 SAR = 1,200*), *Saved items: save for later or remove*.
- Validation at every change and again at checkout: stock, MOQ, price changes (the buyer is warned when a price changed since it was added) and supplier active.
- **Checkout quote:** `POST /checkout/quote { supplierId, addressId, shippingMethod }` returns:
  - products subtotal
  - shipping (D-15; e.g. 200)
  - additional fees (0)
  - customs (0 for local)
  - VAT (e.g. 210)
  - financing cost (0)
  - total (e.g. 1,610)

  *"The same order total persists through checkout"*: the quote has an ID and a 15-min TTL, and `POST /checkout` must reference it.
- **Shipping methods:** `SUPPLIER_DELIVERY` (supplier-set fee per city), `LOGIX_TRANSPORT` (rate card → linked transport order after readiness), `PICKUP`.
- **Payment methods:** card, mada, Apple Pay. `BUSINESS_FINANCE` is shown only for eligible companies (D-06).
- **Consent:** `PURCHASE_TERMS` (*"I accept purchase terms — view return policy"*).
- `POST /checkout { checkoutQuoteId, paymentMethod }` with `Idempotency-Key` → reserves stock (soft reservation 30 min) → creates `PurchaseOrder` (`PENDING_PAYMENT`) + payment intent. On payment success → `PLACED`, stock decremented, and the supplier is notified (S05). On failure or timeout → reservation released.
- Multi-supplier carts create one PO per supplier with separate payments. v1 limits checkout to one supplier at a time (simpler refunds and settlements).

## 5. Purchase order fulfilment

| Step | Actor | API | Buyer view (M09) |
|---|---|---|---|
| S05 New PO | Supplier | `POST /supplier/purchase-orders/{id}/accept` (or `/reject` with reason → full refund) | *Supplier confirmed — order accepted* |
| Start preparation | Supplier | `POST …/start-preparation` | *Preparing and packing* |
| S06 Readiness | Supplier | `POST …/readiness { preparedQty, packagingPhotoFileIds, salesDocumentFileIds (invoice & packing list), pickupSlot }` + checklist (*full quantity prepared, spec match inspected, safe packaging*) | *Ready for pickup* |
| Linked transport | System | For `LOGIX_TRANSPORT`: create `TransportRequest`/order (`PURCHASE_DELIVERY`) from the rate card, or route to ops | *Carrier reference appears after assignment* |
| S07 Handover | Supplier + carrier | `POST …/handover { linkedTransportOrderId, unitCount, photoFileIds, carrierSignatureFileId, pickedUpAt }` | *Shipping* |
| Delivery | Carrier (driver POD) | via module 08 | *Delivery — customer acceptance after inspection* |
| RC | Buyer | `POST /purchase-orders/{id}/receipt-confirmation` | Intact → rating; issue → M10 |

- Required readiness is `placedAt` + `leadTimeDays` business days (*"Within two business days"*). Late readiness notifies the buyer and ops. Sellers bear delay or cancellation costs caused by unreadiness (supplier terms).
- *"S08 starts after buyer acceptance, not carrier pickup."*

## 6. Returns (M10/M11, SR1/SR2)
- Create: `POST /purchase-orders/{id}/returns` with:
  - `reason` (`DEFECT` | `PRE_DELIVERY_DAMAGE` | `MISMATCH`)
  - `lines` (qty ≤ received, e.g. 10 units)
  - `evidenceFileIds` + description
  - `preferredResolution` (`REPLACEMENT` | `REFUND`)

  Guard: within the 3-day window after receipt (*"Displayed window: 3 days after receipt under supplied policy"*).
- *"The 24-hour damage report differs from the return window"*: a damage report on RC (≤ 24 h) opens a case, and a return request (≤ 3 days) opens `ReturnRequest`. Both can coexist and link.
- Supplier SR1: customer reason, evidence (*photos and listing comparison*), decision (*accept / request information / escalate*). SR2: return logistics (*seller pays for non-conforming goods*), returned quantity, agreed resolution (replacement or refund), account adjustment (*link adjustment to sales order*).
- Return pickup: a linked transport order (`RETURN_PICKUP`, cost borne per reason, D-21).
- Resolution: refund (partial, to the original method) or replacement (new PO at zero cost linked to the original). The settlement adjusts accordingly.
- Escalation → admin decision (dashboard), binding under the terms.

## 7. Supplier dashboard (S01)
`GET /supplier/dashboard` → `newOrders` (08), `activeListings` (24), `netReceivables` (11,580 SAR), `lowStockCount`, `pendingReturns`, quick actions.

## 8. Settlement (S08)
- Gross = PO item subtotal (excluding shipping collected for Logix transport, which settles to the carrier).
- Commission 3.5% (e.g. 42), commission VAT if applicable (D-02), net (e.g. 1,158).
- Transfer *within 3 business days to the business account*, held until the return window closes (D-11).
- *"Financial details: commission tax and fees shown separately."*

## API summary (supplier)
`CRUD /supplier/products`, `POST /supplier/products/{id}/publish|pause|duplicate`, `PATCH /supplier/products/{id}/stock`, `GET /supplier/purchase-orders?status=NEW|PREPARING|COMPLETED`, PO actions above, `GET /supplier/returns`, `POST /supplier/returns/{id}/decision|resolve`, `GET /supplier/settlements`, `GET /supplier/dashboard`.

## Events
`product.created`/`published`/`updated`/`paused`/`out_of_stock`/`removed`, `cart.price_changed`, `purchase_order.placed`/`accepted`/`rejected`/`ready`/`handed_over`/`delivered`/`received`/`completed`, `return.requested`/`decided`/`escalated`/`resolved`.

## Acceptance criteria
- [ ] MOQ and stock are enforced at add-to-cart, checkout quote and payment, and overselling is impossible under concurrency.
- [ ] The checkout total equals the payment amount and the PO total, byte for byte.
- [ ] A PO price never changes after confirmation, even if the listing changes.
- [ ] Return windows and the damage window are enforced separately. Settlements are held and adjusted correctly.
- [ ] Arabic and English search both return relevant results with normalization.
