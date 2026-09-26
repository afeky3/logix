# Dashboard Module 02 — Verification (KYB) and Licences (D10–D12)

Backend: [organizations-kyb-terms](../../../backend/md/modules/02-organizations-kyb-terms.md). App counterpart: A06/A08 in [app module 01](../../../app/md/modules/01-access-onboarding.md).

## D10 — KYB queue
**Columns:**
- Submitted at (age, SLA colour)
- Organization (trade/legal name)
- Workspace (Customer-company / Supplier / Provider)
- Activities requested (chips)
- CR number
- City
- Items (accepted / pending / changes requested)
- Resubmission count
- Assigned reviewer
- Auto-check results (Phase 4: Wathq ✓/✗)

**Filters:** status (Submitted, Under review, Changes requested, Approved, Rejected), workspace, activity, city, assigned to me / unassigned, date.
**Actions:** `Assign to me`, open review. Bulk assign (lead only).

## D11 — Verification case review
Split layout: **documents viewer (left/start)** + **decision panel (right/end)**.

1. **Header:** org name, workspace, submitted at, previous cases (history), risk flags (duplicate CR/IBAN/phone across orgs, recently changed bank account).
2. **Business profile section:** legal name, trade name, CR number and expiry, VAT number, national address, contacts. Each field can be marked ✓ / ✗ with a reason.
3. **Items list** (one per `VerificationItem`):
   - Commercial registration (document + number + expiry)
   - Activity licence per activity (TGA, customs broker, warehouse…)
   - VAT certificate / national address proof
   - Bank account: IBAN (masked, reveal with reason), bank name, holder name vs legal name comparison (auto-highlight mismatch), bank proof document
   - Activities and service areas (provider): review that the areas match the licence scope
4. **Per-item decision:** `Accept` / `Request changes` (reason code + message shown to the user in the app, e.g. "A clearer copy is required") / `Reject` (rare; blocks the activity).
5. **Case decision:**
   - `Approve`: requires all required items accepted. Activates the workspace and approved activities.
   - `Request changes`: at least one item marked. The user sees the reasons in A08.
   - `Reject`: reason required. The user is told to contact support.
6. Internal notes (staff only) and the audit trail.

**Reason codes (initial):** `ILLEGIBLE_COPY`, `EXPIRED_DOCUMENT`, `NAME_MISMATCH`, `WRONG_DOCUMENT_TYPE`, `MISSING_PAGES`, `ACTIVITY_NOT_IN_CR`, `IBAN_HOLDER_MISMATCH`, `OTHER`. The app messages are localized per code with an optional free-text addition.

**Document viewer:** zoom, rotate, page navigation, open original in a new tab (audited), version history (previous rejected uploads with reasons), and a watermark on download (D-W06).

## D12 — Licences and expiry monitor
- **Table:** organization, licence type, number, expiry date (days left, colour), status, affected activities, last reminder sent.
- **Filters:** expiring in 7/30/60 days, expired, type, activity.
- **Actions:** send reminder now, open org, suspend an activity manually (reason), review a renewal upload (opens a mini-case in the D11 layout).
- **Automation visibility:** shows auto-suspensions performed by the system (source SYSTEM) with the date.

## Related: company customer verification
Company customers follow the same queue with workspace `CUSTOMER` (D-17). The queue can be filtered to prioritize companies that are blocked at payment ("verification required to pay"), which have higher urgency.

## Metrics on this module
Median review time, first-time-right rate (approved without changes), resubmission count distribution, rejections by reason. Shown on the queue header and in reports.

## Acceptance criteria
- [ ] A reviewer can complete a case without leaving D11 (view all documents, decide items, decide the case).
- [ ] Item-level reasons reach the app exactly as selected (localized).
- [ ] Approve is impossible while any required item isn't accepted.
- [ ] Reveals, downloads and decisions are audit-logged, with the reviewer identity.
- [ ] Licence expiries show correct day counts in Riyadh time.
