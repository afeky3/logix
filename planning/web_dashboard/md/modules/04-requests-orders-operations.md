# Dashboard Module 04 — Requests, Orders and Live Operations (D03–D09)

Backend: modules [05](../../../backend/md/modules/05-requests-quotes-matching.md), [06](../../../backend/md/modules/06-orders-execution-core.md), [07](../../../backend/md/modules/07-shipping-freight.md), [08](../../../backend/md/modules/08-transport-fleet.md), [09](../../../backend/md/modules/09-warehousing.md), [10](../../../backend/md/modules/10-customs.md).

## D03 — Requests list and queues
- **Columns:** reference (LX-…), service + mode, customer (masked individual / company name), route or summary, service date, status, matched providers, quotes count, time to first quote, expires at, flags.
- **Saved queues:**
  - **Zero-match**: no eligible providers. Actions: widen matching (e.g. notify adjacent regions, with a reason), contact the customer, mark "no supply", cancel with reason.
  - **Zero-quote after 24 h**: actions: nudge matched providers (push digest), extend expiry, contact the customer to adjust.
  - **Expiring soon with quotes but no acceptance**: action: remind the customer.
- **Filters:** service, status, city/lane, date range, customer type, has linked parent.

## D04 — Request detail
Request data per step (read-only render of all fields, including "other" texts and D2D details), documents (types and files), matched providers (notified/viewed/quoted/declined), Q&A thread (with masking flags), quotes (all fields **including** provider-private cost and margin, visible to staff only and marked as confidential), timeline, audit. Actions: extend expiry, cancel (reason), re-run matching.

## D05 — Orders list
- **Columns:** reference, service, customer, provider, status, payment status, next action (actor), current milestone + time since last update, ETA, total, settlement status, open cases, flags.
- **Saved queues:**
  - Readiness overdue (> 24 h after `CONFIRMED`)
  - No update in 24 h while `IN_PROGRESS`
  - Awaiting acceptance > 72 h
  - Disputed
  - Cancellation requested
  - Missing required documents
  - Additional charge pending > 48 h
- Filters and export like D03.

## D06 — Order 360
**Header:** reference, service/mode, status, payment and settlement badges, parties (links to Org 360), total, primary actions.

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Summary, amounts snapshot (fee, charges, VAT, total, commission rate/amount, net to provider), next action, linked orders, feature notes |
| Timeline | All milestones and status transitions with source badges and actor, including system/auto events (auto-acceptance, holds) |
| Execution | Service-specific: freight booking & references (B/L, containers, seals, AWB); trip assignment, driver, vehicle, GPS track replay with issues; storage contract, intake, inventory and movements, releases; customs authorization, declaration, duties, release notice |
| Documents | Checklist with statuses, versions, reviewer decisions |
| Money | Payment intents and gateway refs, refunds, additional charges, invoices, settlement (holds), ledger postings (finance only) |
| Messages | Order conversation (read-only by default; "Join as support" posts a system-labelled staff message) |
| Cases | Related cases and cancellation requests |
| Audit | Full audit trail |

**Interventions** (permission-gated, reason required, audited):

| Action | Effect | Control |
|---|---|---|
| Correct / add milestone | Adds or corrects with `source: ADMIN` (visible to the customer as "Logix support") | Ops |
| Update ETA | New estimate with source ADMIN | Ops |
| Nudge party | Push/SMS reminder (provider readiness, customer RC, missing documents) | Ops |
| Pause / resume auto-acceptance | Stops the D-10 timer (e.g. while investigating) | Ops |
| Place / release settlement hold | Settlement `ON_HOLD` with reason | Ops/Finance |
| Force-complete | Completes without RC (e.g. customer unreachable, evidence clear) | Maker-checker |
| Force-cancel | Cancels with a chosen fee/refund | Maker-checker |
| Reassign provider (exceptional) | Only before execution; requires customer consent (recorded) and a new agreement flow | Maker-checker |

## D07 — Live trips map
- A map of all active road trips (transport and road legs) with markers coloured by state (heading to pickup, loading, in transit, border, stale). Clustering at country zoom.
- Side list: reference, driver (masked), provider, last update age, ETA vs quoted ETA (late flag), open issues.
- Click a marker → trip card with the route, recent points, events, issues, and links to D06 and the conversation.
- Filters: provider, city/region, state, late only, stale only.
- Realtime updates via `staff:ops`. Location history replay for a selected trip (last 24 h).

## D08 — Customs operations
- **Authorizations table:** order, customer, broker, status, official reference, source, set by, verified (yes/no), validity. Actions: `Mark verified` (spot-check), `Revert to pending` (reason; the broker and customer are notified), view evidence.
- **Declarations table:** order, declaration ref, status, last update source and time, duties amount and payer, release notice. Action: manual status update with source `ADMIN` (used when the broker can't update or Fasah data is pending), with evidence upload.
- **Queue:** "Authorization pending external action > 48 h", "Declaration not updated in 48 h".
- Later: integration health for Fasah (Phase 4), with mismatch alerts between manual and integration statuses.

## D09 — Warehousing operations
- **Contracts table:** order, customer, provider site, dates, booked capacity, received/available/reserved, status, days to end.
- **Contract detail:** inventory items and locations, movement ledger (intake/release/adjustment with evidence), releases and their states, reconciliation status and additional charges.
- **Queues:** intake discrepancies not acknowledged, releases stuck > 24 h in `APPROVED`/`PICKING`, contracts ending in 7 days with stock, overstays.
- **Action:** admin stock adjustment (maker-checker, reason, evidence), which is visible to the customer as an adjustment with a note.

## Acceptance criteria
- [ ] Every intervention requires a reason, respects permissions and maker-checker, and appears in the customer-visible timeline with the correct source when applicable.
- [ ] Provider-private quote fields are visible to staff only, and are marked confidential.
- [ ] The live map shows stale and late trips correctly, and replays history.
- [ ] Queues match their definitions and support "assign to me".
