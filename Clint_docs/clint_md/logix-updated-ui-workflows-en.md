# LOGIX / Mobile Experience V2 — Updated UI Workflows (English edition)

Source: `Clint_docs/LOGIX-Updated-UI-Workflows-EN.pdf` (38 pages)
Proposed design • Illustrative data and prices • 22 September 2026

> Note per user request: only the English edition was read; the Arabic version (`LOGIX-Updated-UI-Workflows-AR.pdf`) was intentionally skipped as it is a duplicate translation of this same content.

## Page 1 — Logix journeys, from sign-in to delivery

**Five services. One connected experience.**
Shipping • Transport • Warehousing • Customs • B2B marketplace

- 110 designed screens • 30 journey boards • access and provider workflows
- Includes screenshot and written changes: express, Door to Door, transit, broker authorization, insurance, origin/SABER certificates and other fields.
- A visual review PDF, not a working app or native Figma file. Key screens appear first, followed by detailed journeys. The appendix explains policies and implementation decisions. Based on the PRD, Logix identity and supplied edits.

## Page 2 — Journey index

| Left column | Right column |
|---|---|
| Sign in and choose a role | Customs 04: release and handover |
| Registration and approval | Marketplace 01: product discovery |
| Shipping 01: create a request | Marketplace 02: chat and checkout |
| Shipping 02: modes and add-ons | Marketplace 03: delivery and after-sales |
| Shipping: quote and confirmation | Supplier 01: create listings |
| Shipping 04: execution and completion | Supplier 02: fulfillment and payout |
| Transport 01: vehicle and route | Provider 01: opportunity to assignment |
| Transport: quote and confirmation | Freight provider 02: booking and execution |
| Transport 03: track and receive | Transport provider 02: dispatch and driver |
| Warehousing 01: request and inventory | Warehouse provider 02: inventory and release |
| Warehousing: quote and confirmation | Customs broker 02: documents to release |
| Warehousing 03: release and closure | Insurance: compare, request and policy |
| Customs 01: movement and documents | Cancellation and refunds |
| Customs clearance: quote and confirmation | Shared tools and system states |
| Customs 03: authorization and tracking | Supplier returns and service settlements |

## Page 3 — The key screens
Home, follow-up, customs and the business marketplace (quick view, not a sequential journey):
1. **H01 — Good morning, Ahmed** (home): Shipping, Transport, Warehousing, Customs clearance, B2B marketplace tiles. CTA: View my orders.
2. **SHF — Order follow-up**: Sea • Shanghai to Jeddah. Timeline: quote accepted → payment confirmed → next action (review documents/confirm execution) → service provider message → documents & actions. CTA: View live progress.
3. **CU08 — Clearance progress**: Customs declaration → document review → inspection and duties (in progress, separate from broker fees) → release (awaiting confirmation). CTA: View status details.
4. **M01 — Business marketplace**: Search products/suppliers; city/category chips (Riyadh, Equipment, Packaging, Other); product grid (shipping cartons 12 SAR, warehouse shelving 850 SAR, shipping pallets 65 SAR, handling equipment 420 SAR). CTA: Explore products.

## Page 4 — Sign in and choose a role
Shared access for all users.
1. **A01 — Welcome to Logix**: "Logistics, made clearer — Request, compare and track in one place." Service tiles: Shipping & transport, Storage & customs, Business marketplace. CTA: Sign in.
2. **A02 — Sign in**: Mobile number, one-time code, "New here? Create an account." CTA: Send code.
3. **A03 — Verify your phone**: 6-digit code, resend timer (00:45), wrong number/edit. CTA: Verify & sign in.
4. **A04 — Your workspace**: Choose role — Customer/buyer, Seller/supplier, Service provider (freight, transport, storage, customs). CTA: Open workspace.

Note: New users register; existing users enter their authorized workspace.

## Page 5 — Registration and approval
Individual or business account by role.
1. **A05 — Create an account**: Account type (individual/company), full name, email, address.
2. **A06 — Business verification**: Business name & registration doc, activity licence (based on selected service), VAT ID & address docs, business bank account (IBAN + proof).
3. **A07 — Terms and consent**: Role-specific terms summary (customer: cancellation/receipt; seller: 3.5% commission and returns; provider: freight/transport 10%, customs/storage 20%); agree checkbox.
4. **A08 — Verification status**: Commercial registration accepted; activity licence needs a clearer copy (resubmit); account status: quoting and publishing enabled after approval.

Note: Business verification is conditional. Providers submit licences relevant to their own activities.

---

## Shipping journey

### Page 6 — Shipping 01: create a request (Customer, after sign-in)
1. **H01 — Good morning, Ahmed** (home)
2. **SH01 — How are you shipping?**: Shipping mode (sea/air/land), express shipping, door to door, trade direction (import/export).
3. **SH02 — Origin and destination**: Route map, departure port (Shanghai), arrival port (Jeddah Islamic Port), cargo ready date, other port/requirement.
4. **SH03 — Sea freight cargo**: Commodity, container type (dry/refrigerated/other), size (20ft/40ft/LCL), quantity & weight, LCL details.

Note: From SH01 — sea → SH03, air/express → SH04, land → SH05.

### Page 7 — Shipping 02: modes and add-ons (conditional on selection)
1. **SH04 — Air or express cargo**: Origin/destination, commodity, weight & packages, dimensions per package, handling/priority requirements.
2. **SH05 — International land freight**: Origin/destination country & city, commodity, quantity & weight, border/handling instructions.
3. **SH06 — Additional services**: Door to door, customs clearance link, cargo insurance compare, other requirements.
4. **SH07 — Door-to-door details**: Pickup/delivery address, contacts, pickup window, access/loading notes.

Note: SH04 and SH05 are alternatives; Door to Door opens SH07 before review.

### Page 8 — Shipping: quote and confirmation (Request → compare → pay → follow-up)
1. **SHR — Review shipping request**: Route/quantities/dates, documents, notes, accuracy confirmation checkbox.
2. **SHQ — Available quotes**: Al Masar (4.8) 13,800 SAR; Al Ofoq (4.6) different timeline; compare details; offer validity.
3. **SHP — Accept quote and pay**: Service fee 12,000 SAR + VAT 15% (1,800 SAR) = 13,800 SAR total; payment method (Mada/card); agree to quoted scope (cancellation policy link).
4. **SHF — Order follow-up**: Same timeline as page 3.

Note: Follow-up opens after acceptance, showing payment and required actions; execution is a separate state.

### Page 9 — Shipping 04: execution and completion (Tracking, documents, recipient acceptance)
1. **SH08 — Shipment journey**: Milestones — picked up, departed, estimated arrival, clearance & delivery (awaiting arrival).
2. **SH09 — Shipment documents**: Bill of lading (accepted), invoice & packing list (uploaded), origin/SABER certificates, other.
3. **RC — Confirm receipt**: Goods condition, receipt evidence (name/signature/photos), report shortage/damage within 24 hours, confirmation checkbox.
4. **DONE — Service completed**: Star rating, download invoice, open order-linked case, reuse request details for a new one.

Note: Sea and air use journey milestones; vehicle maps apply to road legs when data is available.

---

## Transport journey

### Page 10 — Transport 01: vehicle and route (Domestic or cross-border road transport)
1. **TR01 — New transport request**: Scope (domestic/cross-border), vehicle type (dry/reefer/light truck/lowbed), more vehicle types (curtain-side/car carrier/other).
2. **TR02 — Pickup and drop-off**: Map with both pins, pickup/drop-off location, contact person, transport date.
3. **TR03 — Load details** (general cargo except car carriers): Commodity, weight & unit, required quantity, loading/unloading (assistance/forklift/none), other.
4. **TR04 — Car carrier request**: Pickup/drop-off, number of vehicles, date, notes.

Note: TR03 is general cargo; car carriers use TR04 instead of commodity and weight fields.

### Page 11 — Transport: quote and confirmation (Request → compare → pay → follow-up)
1. **TRR — Review transport request**: Route/quantities/dates, documents, notes, accuracy checkbox.
2. **TRQ — Available quotes**: Al Masar (4.8) 2,760 SAR; Al Ofoq (4.6); compare/offer validity.
3. **TRP — Accept quote and pay**: Service fee 2,400 SAR + VAT 360 SAR = 2,760 SAR; payment method; agree to scope.
4. **TRF — Order follow-up**: Same timeline pattern.

Note: Follow-up opens after acceptance; execution is a separate state.

### Page 12 — Transport 03: track and receive (Track the vehicle, then inspect the load)
1. **TR05 — Your vehicle is on the way**: Map, driver & vehicle (Mohammed, truck 4821), current location, pickup arrival estimate (10:30), current stage.
2. **TR06 — Trip progress**: Arrived at pickup → cargo collected (photos/unit count) → in transit → delivery (awaiting driver proof and buyer acceptance).
3. **RC — Confirm receipt**: Same pattern as shipping.
4. **DONE — Service completed**: Same pattern.

Note: Cross-border jobs add a border-crossing stage and required documents before delivery.

---

## Warehousing journey

### Page 13 — Warehousing 01: request and inventory (WH01 → WH02 → quotes → WH03 → WH04)
1. **WH01 — Book warehouse space**: City, storage type (dry/chilled/frozen/other), start/end dates, space/capacity (pallet spaces).
2. **WH02 — Goods and handling**: Commodity, quantity & weight, temperature (if applicable), handling services (receiving/loading/sorting), other.
3. **WH03 — Warehouse intake booking** (after accepting storage quote): Warehouse, receiving slot, expected quantity, transport to warehouse (linked/self-delivery).
4. **WH04 — Your stored inventory**: Received (20 pallets), available (18), reserved for release (2), stock condition (intact, intake photos).

Note: The warehousing quote board connects WH02 to intake booking WH03.

### Page 14 — Warehousing: quote and confirmation (Request → compare → pay → follow-up)
1. **WHR — Review warehousing request**: 20 pallets, 30 days.
2. **WHQ — Available quotes**: Al Masar 3,450 SAR; Al Ofoq different terms.
3. **WHP — Accept quote and pay**: Service fee 3,000 + VAT 450 = 3,450 SAR.
4. **WHF — Order follow-up**: Same timeline pattern.

### Page 15 — Warehousing 03: release and closure (Partial or full stock release)
1. **WH05 — Request stock release**: Item, quantity (2 of 18 available pallets), release date, collection method (linked carrier/self), notes.
2. **WH06 — Release progress**: Request reviewed → approved → pick and prepare (in preparation) → carrier handover (awaiting pickup) → expected stock balance (16 pallets after release).
3. **WH07 — Storage reconciliation**: Storage period (30 days), agreed charges (3,450 SAR), additional services (require approval), remaining stock (zero for full closure).
4. **DONE — Service completed**: Rating, invoice, help, reuse request.

Note: Partial release returns to inventory; final closure requires no remaining stock.

---

## Customs journey

### Page 16 — Customs 01: movement and documents (Import, export and transit)
1. **CU01 — Customs clearance request**: Movement type (import/export/transit), checkpoint type (sea/air/land/dry port), checkpoint (Jeddah Islamic Port/other), cargo type & quantity.
2. **CU02 — Import and transit details**: Arrival port, shipment quantity, transit destination (transit only), exit checkpoint (required for transit), notes.
3. **CU03 — Import/transit documents**: Bill of lading, commercial invoice, packing list uploaded; certificate of origin; SABER certificate (as applicable); other.
4. **CU04 — Export documents**: Departure port & quantity, booking confirmation, commercial invoice, certificate of origin, other.

Note: Import/transit use CU02 and CU03; export uses CU04. Final requirements depend on the shipment.

### Page 17 — Customs clearance: quote and confirmation (Request → compare → pay → follow-up)
1. **CUR — Review customs clearance request**: Import • Jeddah port.
2. **CUQ — Available quotes**: Al Masar 1,150 SAR; Al Ofoq alternative.
3. **CUP — Accept quote and pay**: Service fee 1,000 + VAT 150 = 1,150 SAR.
4. **CUF — Order follow-up**: Same timeline pattern.

### Page 18 — Customs 03: authorization and tracking (After selecting a broker and accepting a quote)
1. **CU05 — Create broker authorization**: Selected broker (Al Masar Customs), authorizing business, scope & validity (order LX-2048), approve authorization checkbox (creates a request, not yet an active mandate).
2. **CU06 — Authorization status**: Request created → external action (complete official action if required) → authorization reference (awaiting confirmation) → status (inactive until authorized confirmation).
3. **CU07 — Document review**: Commercial invoice (accepted), certificate of origin (clear stamp needed), SABER certificate (under review), other (broker-requested document).
4. **CU08 — Clearance progress**: Same pattern as page 3.

Note: An in-app authorization request is not proof of Fasah activation. Show status and update source clearly.

### Page 19 — Customs 04: release and handover (Release, then transport and receipt if needed)
1. **CU09 — Customs released**: Release notice, charges (broker fees and duties itemized separately), port collection (link transport or select a carrier), confirm clearance completion.
2. **TR05 — Your vehicle is on the way** (linked delivery order only).
3. **RC — Confirm receipt**.
4. **DONE — Service completed**.

Note: CU09 completes customs work; transport and receipt appear only for a linked delivery order.

---

## Marketplace journey

### Page 20 — Marketplace 01: product discovery (Visual browsing, filters and supplier profiles)
1. **M01 — Business marketplace**: Search, category chips, product grid.
2. **M02 — Search results**: Location, price range (100–5,000 SAR), MOQ & availability, sort by (newest/price/verified supplier).
3. **M03 — Reinforced shipping cartons**: Packaging Factory, Riyadh, verified. Unit price 12 SAR, minimum order 100 units, available stock 5,000, specifications & origin.
4. **M04 — Supplier profile**: Verification (business details verified), location, supply terms (MOQ 100, ready in 2 days), contact (in-app chat and spec sharing).

Note: Classifieds-style discovery in Logix branding, with B2B purchasing and payment kept in-app.

### Page 21 — Marketplace 02: chat and checkout (From supplier discussion to paid purchase)
1. **M05 — Supplier conversation**: Chat about availability/specs; final agreed prices appear in the order.
2. **M06 — Your cart**: Reinforced shipping cartons 100 × 12 SAR = 1,200 SAR subtotal; change quantity (minimum 100 units); saved items.
3. **M07 — Delivery and payment**: Delivery address, products & shipping (1,200 + 200 SAR), VAT 210 SAR, total 1,610 SAR, payment method, accept purchase terms (return policy).
4. **M08 — Purchase confirmed**: PO-1048, payment confirmed 1,610 SAR, preparation within two business days, delivery after supplier readiness, order follow-up.

Note: Chat is optional. Fees and VAT are illustrative; the same order total persists through checkout.

### Page 22 — Marketplace 03: delivery and after-sales (Normal receipt or an alternative return path)
1. **M09 — Purchase tracking**: Order accepted → ready for pickup → shipping (carrier reference after assignment) → delivery (customer acceptance after inspection).
2. **RC — Confirm receipt**: Goods condition, receipt evidence, report shortage/damage (24 hours), confirmation checkbox.
3. **M10 — Return or replacement**: Reason (defect/pre-delivery damage/mismatch), quantity, evidence, preferred resolution (replacement/refund), 3-day window under supplied policy.
4. **M11 — Return tracking**: Supplier review (mismatch accepted) → return cost (seller bears cost for non-conforming goods) → return pickup (schedule carrier collection) → resolution (replacement or refund).

Note: After RC, intact goods proceed to rating; issues open M10. The 24-hour damage report differs from the return window.

---

## Supplier journey

### Page 23 — Supplier 01: create listings (After business registration and approval)
1. **S01 — Supplier dashboard**: New orders (8), active listings (24), net receivables (11,580 SAR), quick actions.
2. **S02 — Photos and product details**: Product photos, name & category, description & specifications, country of origin.
3. **S03 — Pricing and inventory**: Unit price & tax (12 SAR, VAT treatment), minimum order (100 units), stock & unit (5,000 pieces), packaging & lead time (100/pack, 2 days), notes.
4. **S04 — Preview and publish**: Product condition, listing details review, confirm listing accuracy (IP/quality), sales commission 3.5%.

Note: Stock and listings can be edited later; prices on confirmed orders remain fixed.

### Page 24 — Supplier 02: fulfillment and payout (Confirmed order → prepare → handover → settle)
1. **S05 — New purchase order**: PO-1048, 100 cartons × 12 SAR, required readiness (2 business days), buyer address, confirmed price (cannot change after confirmation).
2. **S06 — Shipment readiness**: Prepared quantity, packaging photos, sales documents (invoice & packing list), pickup slot.
3. **S07 — Handover to carrier**: Linked transport order (TR-1048), carrier & driver, quantity & condition, collection proof (signature/pickup time).
4. **S08 — Sales settlement**: Sale value 1,200 SAR, 3.5% commission (42 SAR), net 1,158 SAR, transfer within 3 business days, financial details.

Note: S08 starts after buyer acceptance, not carrier pickup. Returns route back to supplier review and resolution.

---

## Provider journey

### Page 25 — Provider 01: opportunity to assignment (Shared by shipping, transport, storage and customs)
1. **P01 — Provider opportunities**: 8 new matching requests, 12 active jobs, receivables 23,400 SAR, filter (activity/city/date).
2. **P02 — Service request details**: Service & route, quantity & dates, documents & requirements, clarification/question.
3. **P03 — Prepare a quote**: Service fee, tax & charges (itemized), duration & quote validity, scope & exclusions, notes.
4. **P04 — Your quote is accepted**: Customer decision (accepted), payment status (confirmed), start requirements (documents/authorization), next step (open execution workspace).

Note: Each service opens its own execution workflow after acceptance. No unapproved charges are added.

### Page 26 — Freight provider 02: booking and execution (Sea, air, land, express shipping)
1. **PS1 — Book freight capacity**: Mode & carrier, capacity & schedule, booking reference & confirmation upload, other.
2. **PS2 — Execution documents**: Sea (B/L, container, seal), air/express (AWB, tracking), land (vehicle & border docs), other.
3. **PS3 — Update shipment milestones**: Pickup → departure → arrival (estimated/actual) → final delivery (assign door-to-door leg).
4. **POD — Service completion evidence**: Service reference (LX-2048), completion evidence (photos/notice/signature), recipient & time, next stage (awaiting customer acceptance).

Note: After POD, the customer confirms in RC, then settlement begins. Provider evidence does not replace customer acceptance.

### Page 27 — Transport provider 02: dispatch and driver (Own fleet or broker-assigned transport)
1. **PT1 — Assign vehicle and driver**: Vehicle (available/suitable), driver (approved), transport broker (select qualified carrier instead of own fleet), documents (operating card & insurance).
2. **PT2 — Driver assignment**: Map, pickup/drop-off, load (20 pallets & instructions), contact (message order coordinator).
3. **PT3 — Loading and trip updates**: Inspect & collect (photos/unit count) → start journey → border crossing (international only) → operational issue (delay/access, with reason).
4. **POD — Service completion evidence**: Same pattern as page 26.

Note: Drivers see assigned jobs only; brokers monitor assigned carriers. Customer RC precedes payout.

### Page 28 — Warehouse provider 02: inventory and release (Receive, count, store and release)
1. **PW1 — Capacity and intake slots**: Available/booked capacity (pallet spaces), storage environment (dry/temperature-controlled per contract), intake slot.
2. **PW2 — Receive and count goods**: Expected vs actual quantity, condition check (photos/notes/discrepancies), storage location (attach stock record).
3. **PW3 — Stock and release management**: Available stock, customer request (2 pallets by 15 October), picking (select units & location), collector (approved carrier & trip reference).
4. **POD — Service completion evidence**: Same pattern.

Note: Each movement updates the customer balance. Partial release does not close the storage contract.

### Page 29 — Customs broker 02: documents to release (Broker executes; customer sees progress)
1. **PC1 — Review customs file**: Movement & checkpoint, documents (accept or request changes per file), origin/SABER certificates, other.
2. **PC2 — Check broker authorization**: Authorizing business, authorization reference (awaiting confirmation), scope & validity, required action (notify customer to complete activation).
3. **PC3 — Declaration execution**: Declaration reference, manifest (link reference & files), inspection & duties (update status & attach evidence), update source (broker, date/time).
4. **POD — Service completion evidence**: Note — completion evidence here is the release notice; clearance acceptance differs from physical goods receipt.

---

## Insurance, cancellation, shared states, settlements & policies

### Page 30 — Insurance: compare, request and policy (Optional service linked to a shipment)
1. **IN1 — Cargo insurance providers**: Insurer A (sea and road coverage), Insurer B (air and express coverage), compare options (limits, exclusions, deductible). Note: illustrative names, not contracted insurers.
2. **IN2 — Coverage details**: Declared cargo value (50,000 SAR), route & commodity, coverage & exclusions (view terms), deductible & premium, accept insurance terms (separate consent).
3. **IN3 — Insurance request and policy**: Quote request (under insurer review) → premium approval (customer acceptance then payment) → policy issuance (no active coverage before confirmed issuance) → policy document (available after issuance).
4. **IN4 — Insurance claim request** (optional post-issuance path): Policy & shipment, incident details, evidence (photos/delivery record/invoice), claim status (coverage and compensation decided by insurer).

Note: No insurer partnership, automatic issuance or commission is assumed.

### Page 31 — Cancellation and refunds (Alternative path from order details)
1. **X01 — My orders**: Filter by service or marketplace; list of orders (LX-2048 in progress, WH-105 active storage, PO-1048 in preparation).
2. **X02 — Cancel service**: Rates before acceptance/dispatch: 0% before acceptance or dispatch; 10% after acceptance, before arrival; 25% after arrival or customs start; 100% + return costs after pickup/transport start.
3. **X03 — Cancellation under review**: Order status, review reason (rules imply both 0% and 10%), action (human review before any charge), decision (notify customer of amount and reason).
4. **X04 — Refund and support**: Case reference (CASE-2048), approved amount, refund status (processing), support (chat with support).

Note: Free cancellation before dispatch conflicts with 10% after acceptance; the policy owner must resolve this before implementation.

### Page 32 — Shared tools and system states (Independent references available across journeys)
1. **X05 — Notifications and messages**: New quote, document needs correction, execution update, conversation.
2. **X06 — Account and settings**: Active role (switch authorized roles), profile & addresses, language (English/Arabic), security & privacy (manage sessions/sign out).
3. **X07 — Action could not be completed** (example: payment not confirmed): Transaction status, safe next action, expired quote (request a fresh one), help (contact support with transaction reference).
4. **X08 — Input and connection states**: Expired verification code (resend after cooldown), missing field/invalid file (inline error, preserve data), no results (adjust filters), offline (save draft and retry).

Note: These are independent screens, each opened from its own app context.

### Page 33 — Supplier returns and service settlements (Two independent paths: returns / payouts)
1. **SR1 — Review return request**: Customer reason (specification mismatch), evidence, decision (accept/request info/escalate), window (3 days after receipt under supplied policy).
2. **SR2 — Resolve return**: Return logistics (seller pays for non-conforming goods), returned quantity, agreed resolution, account adjustment (link to sales order).
3. **PAY1 — Provider settlement**: Freight & transport 10% commission; customs & storage 20% commission; settlement statement (gross, commission, tax, net); payout within 3 business days.
4. **PAY2 — Payout completed**: Beneficiary account, transfer reference (TRX-2048), transfer date, downloadable statement.

Note: SR1 → SR2 handles returns; PAY1 → PAY2 settles providers after customer acceptance.

---

## Appendix — Terms, roadmap and open decisions

### Page 34 — Customer terms
- **Account and documents**: Accurate identity/registration, legal capacity; accurate shipment and customs documents.
- **Cancellation**: Supplied rates — 0% before acceptance/dispatch; 10% after acceptance before arrival; 25% after arrival/customs start; 100% after pickup/transport start plus return cost where possible. Overlap shown in X03.
- **Receipt and reporting**: Attend delivery, inspect before signing, report shortage/damage within 24 hours.
- **Returns and missing documents**: Return manufacturing defects/non-conforming goods under store policy. Supplied terms prohibit refusing receipt due to missing customer customs documents.
- **Responsibility and disputes**: Logix is a digital intermediary; sellers own product quality, providers own transit safety; Saudi law and Jeddah commercial courts named (presentation of supplied policy, not legal validation).
- **Consent audit**: Record role, terms version, consent time, order reference. No preselected consent. Final text approval required before production.

### Page 35 — Seller and supplier terms
- **Products and specifications**: Accurate names/specs/origin/quantities/photos/units/prices; products new, original, compliant, not counterfeit. Sellers bear product quality/IP/trademark responsibility.
- **Price and commission**: Confirmed order prices fixed. 3.5% commission per sale; net payout within 3 business days after buyer receipt and conformity confirmation.
- **Preparation and readiness**: Pack safely, prepare by agreed time, send readiness notice in-app. Sellers bear delay/cancellation costs from unreadiness or shortages.
- **Returns and replacement**: Accept manufacturing defects/pre-delivery damage/mismatch within 3 days of receipt. Sellers bear financial/logistical return costs for non-conforming goods.
- **On-platform conduct**: No off-platform payment routing to evade commission; suspension/compensation rights reserved; Saudi regulations and Jeddah commercial courts named.
- **Consent audit**: Same pattern as customer terms.

### Page 36 — Service provider terms
- **Eligibility and licensing**: Valid registration and relevant activity licences (transport/brokerage/vehicle cards, or customs brokerage with VAT/address docs). Notify platform of amendments/renewal/suspension.
- **Execution**: Clear final price without unagreed extras; electronic shipping documents, vehicle tracking, timely Fasah clearance requested. Integration implementation depends on contracting and technical approval.
- **Safety and insurance**: Providers responsible from collection to delivery, must maintain required insurance. Platform is described as intermediary, excluding its liability for provider damage/loss/delay/violations.
- **Commission and payout**: SAR with clear VAT treatment. Freight & transport commission 10%; customs & storage 20%. Transfer to approved business account within 3 business days of completion and customer acceptance.
- **Confidentiality and conduct**: Use customer/shipment data only to perform the service; suspension/cancellation allowed for misleading information, poor service, or violations; Saudi law and Jeddah commercial courts named.
- **Consent audit**: Same pattern.

### Page 37 — Fasah integration and implementation roadmap
(Team appendix — proposed stages from supplied notes, not confirmation of API availability)
1. **Confirm scope**: Confirm contracting party, services, data scope, permissions, authorization. Obtain official documentation before specifying endpoints/authentication.
2. **Sandbox testing**: Once test access is supplied, test declaration, clearance-status, and manifest exchange within approved capabilities. Keep credentials server-side, never in the mobile app.
3. **Security and quality review**: Review integration with the relevant party — permissions, audit logs, duplicate prevention, outage behavior. Local tests do not constitute Fasah approval.
4. **Production activation**: After approval and production credentials — phased rollout, monitor errors, show status source to customers. Manual updates remain available when integration is absent.
5. **Application build order**: Build access, permissions, requests, quotes and payment first; then execution and documents; then marketplace, returns and settlements; finally approved integrations and insurance partnerships.
6. **Release acceptance criteria**: Test every service and role end to end in Arabic and English. Validate uploads, financial calculations, customer-data protection, payment failures, integration outages and refunds.

### Page 38 — Decisions to resolve before development
- **Cancellation fees**: Accepted-but-not-dispatched orders match both 0% and 10%. Define storage and non-vehicle service cancellation milestones. Until resolved, use human review with no ambiguous automatic deductions.
- **Commission and tax base**: Confirm whether commission includes VAT, government charges and pass-through costs, and how commission tax is treated. Screen amounts are illustrative, not approved tax calculations.
- **Authorization and insurance**: Authorization creation remains a request until official confirmation. Insurance requires a request, quote and insurer-issued policy with terms and limits; do not assume commission or immediate coverage.
- **Localization and direction**: Arabic is RTL, English is LTR. Isolate number and code direction. Preserve values when navigating back; show conditional fields and the source/timestamp of every tracking update.
- **Marketplace and finance**: Classifieds-style discovery leads to B2B purchase and platform settlement. Business finance appears only for eligible companies with an approved partner and terms; not guaranteed for every account.
- **Scope of this edition**: Includes core screens and requested journeys for both sides. Shared system states are references, not separate variants for every field. Names, orders and vector product images are illustrative. A full web admin console is outside this file.
