# Dashboard Module 08 — Insurance Operations (D23)

Backend: [insurance](../../../backend/md/modules/14-insurance.md). App: [IN1–IN4](../../../app/md/modules/11-insurance.md). The operating model depends on **D-07**. Until partnerships exist, staff mediate every step manually.

## Insurers catalog
- **Fields:** name (ar/en), coverage modes (sea / road / air / express), summary text (ar/en), terms document (PDF upload, versioned), contact (internal), status (active/inactive), display order, note flag *"Illustrative names, not contracted insurers"* (shown in IN1 while `contracted = false`).
- Only active insurers matching the shipment mode appear in IN1.

## Insurance requests queue
- **Columns:** request ID, order (LX-…), customer, insurer, mode, route, declared value, status, age, assigned staff, quote valid until.
- **Statuses:** Requested → Under insurer review → Quoted → Accepted → Paid → Issued (plus Declined / Expired / Cancelled).

**Request detail:**
- Shipment snapshot (route, commodity, dates, departure status: insurance must be issued before departure).
- Customer consent record (`INSURANCE_TERMS`, version, time).
- **Staff actions:**

| Step | Action | Captured data |
|---|---|---|
| Send to insurer | Mark "Under insurer review" (after emailing or submitting on the insurer portal) | Insurer reference (optional) |
| Record quote | Enter the quote → status Quoted → customer notified (IN3 shows premium) | Premium, deductible, coverage limits, exclusions summary, validity date, quote document upload |
| Record decline | Status Declined with reason → customer notified | Reason |
| Confirm payment | If paid directly to the insurer: attach proof → Paid. If collected in-app (licensed model only): automatic from payment | Payment proof |
| Issue policy | Upload the policy → Issued → the policy appears in order documents and IN3 | Policy number, coverage start/end, policy PDF |

- Expiry job: quotes past validity → Expired (customer notified). Staff can re-quote.

## Claims queue
- **Columns:** claim ID, policy number, order, customer, incident date, status, amount claimed, days open.
- **Detail:** customer submission (description, evidence), linked order evidence (POD, RC photos, damage case), and the policy document.
- **Actions:** Forward to insurer (→ With insurer), record insurer decision (approved amount or rejection reason, decision document) → Approved/Rejected, mark Paid (insurer paid the customer directly), close.
- *"Coverage and compensation decided by insurer"*: staff only record, and never decide coverage.

## Controls
- No commission or revenue recording on premiums (client note) unless D-07 changes it.
- The customer-facing wording "Insured/مؤمَّن" appears only after Issued (backend-enforced, verified in QA).
- An audit trail covers every step, including who uploaded policy documents.

## Metrics
Requests by mode and insurer, quote turnaround time, acceptance rate, issued policies, claims count and approval rate, average time to decision.

## Acceptance criteria
- [ ] Staff can complete request → quote → payment confirmation → issue → claim decision entirely from this module.
- [ ] The customer app reflects each status change within realtime latency.
- [ ] Policies cannot be issued for shipments that have already departed without a super-admin override (reason).
