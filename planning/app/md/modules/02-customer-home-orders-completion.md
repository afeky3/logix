# App Module 02 — Customer Home, Orders, Shared Quote/Pay/Follow-up, RC and DONE

These are the shared building blocks used by every service journey (modules 03–06), so each service spec only describes its differences. Backend: [requests-quotes](../../../backend/md/modules/05-requests-quotes-matching.md), [orders-execution-core](../../../backend/md/modules/06-orders-execution-core.md), [payments](../../../backend/md/modules/12-payments-finance.md).

## H01 — Customer home
- **Header:** logo, bell with unread dot, workspace switcher.
- **Greeting:** *Good morning, Ahmed* (time-based: morning/afternoon/evening), *What do you need today?*
- **Service tiles** (feature-flag aware, D-25):
  - *Shipping — Sea, air, land and express* → SH01
  - *Transport — Within Saudi Arabia and abroad* → TR01
  - *Warehousing — Book space and manage inventory* → WH01
  - *Customs clearance — Import, export and transit* → CU01
  - *B2B marketplace — Explore products and suppliers* → Marketplace tab
- **Kit extras:**
  - Hero card *"Start your next request — From here, your business moves"* with *+ Request a new service*
  - Stats tiles: delivered (12), new offers (05), active requests (03)
  - Activity cards: *Shipment on the way — Jeddah → Riyadh • arriving today — In transit*, *Offers waiting — compare 3 offers for your latest request*
- **Drafts:** "Continue your request" cards (G01) when drafts exist.
- **CTA:** `View my orders` → X01.

## X01 — My orders (unified feed)
- Filter chip bar: *Choose service or marketplace* (All, Shipping, Transport, Warehousing, Customs, Purchases) + status filter (Active, Needs action, Completed, Cancelled).
- Item: reference + title (*Order LX-2048 — In progress • open follow-up*, *Order WH-105 — Active storage*, *Purchase PO-1048 — In preparation*), a status badge, and a "needs action" dot when `nextAction.actor = CUSTOMER`.
- Search by reference or city. Pull to refresh. Infinite scroll (cursor).
- Tap → the service follow-up screen (or M09 for purchases).

## Shared: request wizard frame
Used by SH/TR/WH/CU.
- Stepper (step x of n), screen title and subtitle, FieldRows, sticky CTA (step-specific label: *Set route*, *Cargo details*, *Add services*, *Review request*…).
- **Draft:** created on the first step (`POST /service-requests`). Each CTA → `PATCH ?step=`. The local MMKV copy is kept in sync.
- **Back** keeps values. **Exit** → "Save as draft?".
- **Review screen (SHR/TRR/WHR/CUR):**
  - *Request details — Review route, quantities and dates* (expandable summary per step with "Edit" links back to the step)
  - *Documents — View files or add another document*
  - *Other — Notes and special requirements*
  - Consent *☐ I confirm accurate information — including cargo and supporting documents*
  - CTA `Request quotes` → `POST …/submit` → success sheet "Request sent to matching providers" → quotes screen (empty waiting state)

## Shared: quotes list (SHQ/TRQ/WHQ/CUQ)
- Subtitle = service. Sort tabs (kit): *Cheapest / Fastest / Highest rated*.
- **QuoteCard:** *Al Masar • 4.8*, total (*13,800 SAR*), timeline (*delivery within a day*), jobs count (*86 trips*), validity countdown, badges.
- Rows below the cards (V2): *Compare details — Timeline, scope and final price* → QuoteCompare (K-Q02). *Offer validity — Until 28/09/2026*.
- Kit info card: *"Clear prices: illustrative prices include tax, and details are available inside each offer."*
- **Waiting state (Q00):** "Waiting for providers' offers", matched count ("Sent to 7 providers"), "You'll be notified", and an option to edit or cancel the request.
- **Realtime:** a new quote animates in. `quote.expired` greys a card out (*Expired — request a fresh quote*).
- CTA: `View selected quote` → QuoteDetail.

## Shared: QuoteDetail (K-Q03) and QuoteCompare (K-Q02)
- **QuoteDetail:** provider (name, rating, profile sheet), CostBreakdown (*Transport service 2,200.00 • Loading/unloading 200.00 • Illustrative VAT 15% 360.00 • Total 2,760.00 SAR*), execution date (*14 Oct • 09:00 — expected delivery next day*), scope and exclusions, notes, validity badge (*Offer valid*). Actions: `Provider details`, `Message provider` (masked pre-award chat), `Choose offer` → accept & pay.
- **QuoteCompare:** a table with up to 3 columns. Rows: total, delivery, rating, loading & unloading, offer validity. Footer: *"All details in front of you — review exclusions, insurance coverage, loading time and cancellation policy in the offer"*. CTA `Choose <provider> offer`.

## Shared: accept and pay (SHP/TRP/WHP/CUP → K-B02 → K-B03)
- **SHP body:**
  - *Service fee 12,000 SAR*
  - *Illustrative VAT 15% 1,800 SAR*
  - *Total 13,800 SAR*
  - *Payment method — Mada / card / available options* (opens K-B02)
  - Consent *☐ I agree to the quoted scope — View cancellation policy and charges* (opens the policy sheet with the rule table from X02)
  - Kit B01 adds a second consent: *I confirm data/documents accuracy and compliance*
- **K-B02 Payment method:** mada/bank card (first), Apple Pay (iOS), STC Pay (if enabled), corporate financing (only if eligible, D-06). Note: *"The payment is completed inside a secure payment gateway once linked; the app doesn't collect card data."*
- **Action:** `Accept & pay` → `POST /quotes/{id}/accept` (idempotency key) → gateway SDK/3DS → poll `GET /payment-intents/{id}` → success.
- **Success (K-B03):** *Booking confirmed — thank you, your request is ready to execute*, reference *LX-260148 — Jeddah → Riyadh • 14 October*, payment status *Paid — 2,760.00 SAR*, order details link, CTA `Track shipment` → follow-up (replaces the stack).
- **Failure:** X07 *Payment failed or confirmation missing — Check status before paying again*. Expired quote → *Request a fresh quote if needed*.

## Shared: order follow-up (SHF/TRF/WHF/CUF, K-O02)
- Subtitle: route/service summary (*Sea • Shanghai to Jeddah*, *Riyadh to Jeddah • trailer*, *20 pallets • 30 days*, *Import • Jeddah port*).
- **Timeline:**
  - *Quote accepted — Done • order LX-2048*
  - *Payment — Payment confirmed*
  - *Next action — Review documents and confirm execution* (from `nextAction`)
  - *Service provider — Message in the app*
  - *Documents & actions — Order files, insurance and notes* (accent dot = current)
- **Kit K-O02 cards:** route summary, loading date and total, Tracking (*last update minutes ago*), Documents (*bill of lading and delivery proof*), Request conversation, and `Request cancellation` (outline, only if allowed).
- **CTA:** `View live progress` → service journey (SH08/TR05-TR06/WH04/CU08).
- **Banners:** additional charge awaiting approval (G21), document needs correction, authorization action required, receipt confirmation pending.

## RC — Confirm receipt (shared)
*Inspect the goods before confirming.*
- **Goods condition:** *Intact / shortage or damage* (segmented). The kit adds checkboxes *☐ I confirm receiving the stated unit count* and *☐ I inspected the visible condition*.
- **Receipt evidence:** recipient name (prefilled), signature (SignaturePad), photos (PhotoGrid, required if not intact), notes.
- **Rule copy:** *Report shortage or damage — Record on delivery; report within 24 hours* (link to IssueReport K-R01).
- **Consent:** *☐ I confirm inspection and receipt — Confirmation time is recorded*.
- **Action:** `Confirm receipt` → `POST …/receipt-confirmation`. Intact → DONE. Shortage/damage → IssueReport prefilled → case created → a "We're reviewing" state.
- If D-10 is approved, a banner reads "If you don't respond, receipt will be confirmed automatically on <date>".

## DONE — Service completed (shared)
- Success check. *Thank you for using Logix*. Reference (*LX-260148 delivered*, kit).
- *Rate the service* (5 stars + optional note, kit "How was your experience?") → `POST /orders/{id}/rating`.
- *Invoice — Download PDF invoice* → InvoiceView (K-T04).
- *Need help? — Open an order-linked case* → case form.
- *New request — Reuse request details* → duplicate draft → wizard.
- CTA `Back to my orders`.

## IssueReport (K-R01) and CaseDetail (K-R02, G16)
- **IssueReport fields:** report type (visible damage / shortage / wrong item / other), order number (prefilled), issue details, attach photos and delivery document (required), notice *"Per the supplied text: shipment damage report within 24 hours; product return request within 3 days. The final wording is subject to review"*, and the confirmation checkbox. Action `Send report`.
- **CaseDetail:** status badge (*Under review*), timeline (*Report received 15 Oct 11:30 → Seller/provider review — awaiting response → Return or compensation coordination — after acceptance*), attachments (*2 photos • delivery document*), case conversation, CTA `Back to requests`.

## Acceptance criteria
- [ ] One implementation of the wizard, quotes, compare, accept & pay, follow-up, RC and DONE serves all four services through configuration.
- [ ] Payment success appears only after server confirmation, and a double tap never double-charges.
- [ ] Follow-up CTAs come only from `allowedActions`/`nextAction`.
- [ ] RC with damage always creates a case, and the 24-hour rule is visible.
