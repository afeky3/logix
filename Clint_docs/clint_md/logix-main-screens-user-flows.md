# LOGIX — Main Screens & User Flows

Source: `Clint_docs/LOGIX-Main-Screens-User-Flows.pdf` (16 pages)
Arabic app UI + English flow labels. Selected main screens from the 84-screen Logix UI kit. Screen IDs match the full manual. Screens are design references; map positions, prices, names and statuses are sample data. Long screens are shown in full.

## Page 1 — One platform. Three connected user journeys.

**BUYER** (pages 3–11): Request/shop → Compare/select → Pay/track → Receive/review

**SUPPLIER** (pages 12–13): Create catalog → Receive orders → Prepare goods → Settle sales

**PROVIDER** (pages 14–16): Verify business → Quote on requests → Execute service → Settle fees

How to read: follow screen numbers left to right. Each page continues one journey; optional branches and role handoffs are explicitly marked. Shared access starts on page 2.

---

## Page 2 — Shared Entry: Start with the right role

1. **A01 / Welcome** — "Every move, connected." Entry screen with role cards: Shipping & transport (local/international), Storage & customs (specialist services), Business marketplace (products & verified suppliers). CTA: Sign in.
2. **A02 / Choose a role** — Buyer/service requester, Seller/supplier, Logistics service provider.
3. **A05 / Create account** — Individual/company toggle; full name, email, mobile number, business name/CR; accept privacy terms.
4. **A04 / Verify identity** — 6-digit OTP entry, resend code option.

Note: The role determines the workspace. Providers follow their dedicated verification journey (page 14). This is the intended UX sequence; account and OTP services still require implementation.

---

## Buyer / Service Requester Journey (pages 3–6)

### Page 3 — 01 Define the trip
1. **H01 / Buyer home** — Activity overview: shipments delivered, new offers, active requests; recent shipment/marketplace/offer cards; "Request a new service" CTA.
2. **H02 / Choose a service** — International shipping, domestic transport, customs clearance, storage, buy products (marketplace).
3. **L01 / Set the route** — Map with pickup/delivery pins, loading point, unloading point, distance.
4. **L02 / Vehicle and cargo** — Vehicle type (flatbed/curtain-side/trailer), cargo classification, total weight (kg/ton), unit count, temperature-controlled only.

Note: Core example is domestic road transport. International freight, customs and storage have separate branches later in the deck.

### Page 4 — 02 Request and compare
1. **L03 / Schedule and extras** — Loading date/time, loading/unloading assistance, cross-docking/temporary storage, handling instructions, cost basis explanation.
2. **L04 / Review the request** — Route summary, distance, selected services, data-accuracy declaration, edit request.
3. **Q01 / Receive offers** — Sort by cheapest/highest-rated/fastest; competing provider quotes with rating and delivery estimate.
4. **Q02 / Compare offers** — Comparison table: total, delivery day, rating, loading/unloading included, offer validity (24h/48h).

Note: After request submission, Q00 is the waiting state. The flow continues when providers submit offers. Optional add-ons are not mandatory consent.

### Page 5 — 03 Confirm and pay
1. **Q03 / Choose an offer** — Offer details: transport fee, loading/unloading, VAT 15%, total, execution date, provider details/message.
2. **B01 / Review booking** — Total cost, cancellation policy, data-accuracy & terms checkboxes.
3. **B02 / Payment method** — Bank card / corporate financing; payment data notice.
4. **B03 / Booking confirmed** — Confirmation with order ID, route, payment status, total paid, request details link.

Note: Payment success is shown only after gateway confirmation in production. B05 handles payment failure; E04 handles expired quotes.

### Page 6 — 04 Track, receive and close
1. **O02 / Order details** — Route, loading date, total, tracking, documents, request conversation, cancel request.
2. **T01 / Track the shipment** — Live map, expected arrival, milestones (loaded/on the way/delivered), driver/vehicle info.
3. **T02 / Confirm receipt** — Confirm unit count, cargo condition, recipient name, delivery notes, attach proof, report damage/shortage.
4. **T03 / Complete and rate** — Completion confirmation, star rating, notes, invoice, damage report link.

Note: Invoice at T04. A damage or shortage report branches to R01 before closing the delivery. Tracking and operational data shown here are illustrative.

---

## Buyer / International Freight — Branch A (page 7)

### Book international freight
1. **F01 / Mode and route** — Sea/air/road, import/export, origin/destination country, port of loading (POL), port of discharge (POD).
2. **F02 / Cargo and capacity** — Cargo type, container size (20ft/40ft/LCL), container type, quantity, total weight, HS code, description.
3. **F03 / Service add-ons** — Door-to-door delivery, express priority, customs clearance on arrival, temporary storage, readiness date, special requirements.
4. **F04 / Review and submit** — Route summary card, container/weight/readiness, what happens next explanation, data accuracy checkbox, submit for quotes.

Note: This example shows sea freight. Alternate details: F05 for air, F06 for cross-border road and F07 for LCL. Continue to offers on page 4, then booking on page 5.

---

## Buyer / Customs — Branch B (page 8)

### Complete customs documents
1. **D01 / Customs request** — Import/export toggle, checkpoint type, customs checkpoint, bill of lading number, HS code, goods description.
2. **D02 / Document vault** — Shipping policy (accepted), commercial invoice (under review), packing list (rejected), upload file/scan, enhance & scan document.
3. **D03 / Correct a document** — Rejection reason display, packing list preview, crop/rotate/enhance clarity tools, resubmit.
4. **D04 / Customs progress** — Timeline: request received → document review → customs filing → release & handover; document center, contact broker.

Note: Correction is conditional: rejected documents open D03, then return to D02. Accepted documents proceed to D04. This is not a compulsory rejection step.

---

## Buyer / Storage — Branch C (page 9)

### Request warehouse capacity
1. **W01 / Storage needs** — City, storage type (dry/chilled/other), unit count, entry/exit dates, storage requirements, need transport to warehouse checkbox.
2. **W02 / Review storage** — Storage summary (dry, Jeddah, 24 units), service terms, data-accuracy checkbox.
3. **Q01 / Compare proposals** — Provider offers sorted by cheapest/rating/fastest.
4. **B01 / Review booking** — Storage-specific cost total, cancellation policy, terms checkboxes.

Note: Q01 and B01 show reusable layout references with road-transport sample content. Production must bind them to the storage request, price and cancellation milestones.

---

## Buyer / Marketplace (pages 10–11)

### Page 10 — Buy products for your business
1. **M01 / Discover products** — Search bar, category filters (raw materials, equipment, packaging materials, all), supplier comparison card.
2. **M02 / Product details** — Product image, unit price, minimum order, available quantity, specifications, supplier file.
3. **M03 / Review the cart** — Item, unit count, product subtotal, shipping (determined next step), minimum order note.
4. **M04 / Delivery and checkout** — Delivery address, shipping method (via Logix), cost breakdown (products, shipping, fees, customs, VAT, financing), terms checkbox, confirm purchase.

Note: Supplier comparison and profiles are available in M07–M08. Commerce payment must retain the purchase total; the existing shared payment example uses a logistics amount.

### Page 11 — Fulfillment and optional returns
1. **M05 / Purchase confirmed** — Order accepted, next step notice, total, status (in preparation).
2. **M06 / Follow fulfillment** — Timeline: order confirmed/paid → in preparation → ready for pickup → shipping/delivery; product details, supplier message, request return.
3. **R01 / Report an issue** — Report type (visible damage), order number, issue details, attach photos, 24-hour reporting rule notice, data-accuracy checkbox.
4. **R02 / Follow the claim** — Report status timeline: received → seller/provider review → return/exchange coordination; attachments, report conversation.

Note: The claim branch is optional. A normal purchase proceeds from fulfillment to delivery confirmation. Return eligibility and timing require approved policy.

---

## Supplier / Seller Journey (pages 12–13)

### Page 12 — 01 Build the product catalog
1. **S01 / Supplier home** — Net receivables balance (11,580 SAR, illustrative), new orders (3 needing preparation), product catalog (24 products), documents.
2. **S03 / Product content** — Product images, name, description, classification, technical specs, country of origin, packaging data.
3. **S03B / Price and stock** — Supply price (SAR), tax display, unit of measure, available quantity, minimum order (MOQ), preparation lead time (days), accuracy confirmation.
4. **S02 / Manage inventory** — Search products, filter (all/active/low stock), product cards with status badges (active, low stock, unavailable).

Note: Supplier consent is recorded in S07 before operating. Product availability and MOQ must be validated again at checkout.

### Page 13 — 02 Fulfill orders and get paid
1. **S04 / Supply orders** — Tabs: new/in preparation/completed. Orders awaiting preparation with PO number, buyer, quantity, value.
2. **S05 / Prepare the goods** — Agreed handover date, checklist (quantity prepared, spec-match inspection, secure packaging for transport), available pickup date, loading instructions, message buyer.
3. **S06 / Sales settlement** — Calculated product value, 3.5% sales commission, net after commission, settlement timing (within 3 business days), bank account, transactions.

Note: Between readiness and settlement: transport is assigned, the buyer receives the goods and confirms conformity. Settlement follows those events; readiness alone does not release funds.

---

## Service Provider Journey (pages 14–16)

### Page 14 — 01 Register and qualify
1. **P01 / Business registration** — Business name, commercial registration, activity type (domestic transport dropdown), national address, tax registration number, contact number.
2. **P02 / Licenses and documents** — Commercial registration (valid), activity license (TGA for transport/ZATCA depending on activity), insurance policy, upload documents, license expiry date, IBAN.
3. **P03 / Review the terms** — Execution & responsibility, platform commission (10% shipping/transport, 20% customs/storage, per supplied text), settlement (3 business days after completion and delivery confirmation), terms acceptance checkbox.
4. **P04 / Verification status** — Timeline: business data submitted → license review (pending) → request activation (after approval); update documents link, preview provider profile.

Note: P03 returns to P02 to complete submission. Activation follows verification. Required documents depend on activity, not every license for every provider.

### Page 15 — 02 Find work and quote
1. **P05 / Operations home** — "8 requests awaiting your offer" banner; available requests, active operations (3 shipments), fleet & licenses, documents.
2. **P06 / Available requests** — Filter tabs: all/road transport/customs/storage. Request cards with route, cargo, date.
3. **P07 / Assess the request** — Map, vehicle type (trailer), cargo (18 ton), unit count (24), readiness date, customer instructions, shipment documents.
4. **P08 / Prepare a quote** — Internal execution cost, target margin, price before tax, commission (10%), net after tax deduction, total illustrative buyer-facing price, execution duration, offer validity (24h), notes.

Note: Internal cost and target margin remain private to the provider. Only the final customer-facing offer and its conditions are presented to the buyer.

### Page 16 — 03 Execute, deliver and settle
1. **P08B / Offer accepted** — Submitted offers list with statuses (customer selected / awaiting response), readiness confirmation button.
2. **P09 / Execute the shipment** — Assign vehicle/driver, driver name, execution stage (before departure), shipping document, quantity/condition verification, log event.
3. **T02 / Buyer confirms receipt** — Buyer-side handoff: confirm unit count, cargo condition, recipient name, delivery notes, attach proof, report damage/shortage.
4. **P11 / Provider settlement** — Tabs: transport 10% / customs 20% / storage 20%; calculated value, commission, net after tax, settlement timing (3 business days after completion & buyer confirmation), bank account, request awaiting confirmation.

Note: Execution starts after payment confirmation. T02 represents the buyer acceptance event, not a provider accepting its own delivery. Provider evidence capture must be kept distinct.
