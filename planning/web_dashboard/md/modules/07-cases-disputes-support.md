# Dashboard Module 07 — Cases, Disputes, Cancellation Reviews and Support (D20–D22)

Backend: [cancellations-refunds-cases](../../../backend/md/modules/13-cancellations-refunds-cases.md), [messaging-notifications](../../../backend/md/modules/15-messaging-notifications.md). App: X02–X04, RC damage reports, K-R01/K-R02, SR1 escalations.

## D20 — Cases inbox
- **Views:** My cases, Unassigned, Breaching SLA, Waiting on customer/provider/supplier, All.
- **Columns:** CASE reference, type, subject (LX-/PO-/RT-/payment), opened by (org + workspace), counterparty, priority, status, SLA due (countdown, colour), assignee, last activity, financial exposure (order total or claimed amount).
- **Filters:** type, priority, status, service, date, assignee.
- **Actions:** assign to me / assign to (lead), bulk status (safe transitions only), merge duplicates (same subject and type; keeps both conversations linked).

## Case detail
Layout: **conversation (center)** + **context panel (end side)**.
- **Conversation:** thread with participants (opener, counterparty, staff). Toggle *Internal note* (staff-only, highlighted). Canned replies (bilingual templates). Attachments.
- **Context panel:**
  - Subject summary with a link (Order 360 / PO 360 / Return / Payment)
  - Timeline of the subject (milestones, POD, RC with photos, damage report within 24 h?)
  - Evidence gallery (POD vs RC photos side by side for damage cases)
  - Money: amounts paid, refunds so far, settlement status (hold indicator)
  - Insurance policy (if the shipment was insured) with a link to the claim
  - Related cases
- **Status controls:** In progress, Waiting on customer / provider / supplier (pauses the SLA), Resolve (requires a resolution code + note), Close.
- **Resolution outcomes (financial):**

| Outcome | Effect |
|---|---|
| No action | Close with reason |
| Refund to customer | Creates a refund (threshold → maker-checker) |
| Adjust provider/supplier settlement | Deduction line on the settlement (e.g. proven damage in transit, per *"transit safety to providers"*) |
| Replacement (marketplace) | Creates a replacement PO at zero cost |
| Compensation outside platform | Record only (e.g. an insurer paid via claim) |

- **Resolution codes:** `RESOLVED_REFUND`, `RESOLVED_ADJUSTMENT`, `RESOLVED_REPLACEMENT`, `RESOLVED_NO_FAULT`, `RESOLVED_INSURANCE`, `DUPLICATE`, `INVALID`, `WITHDRAWN`.
- Settlement holds are released automatically when the case resolves without adjustment, or updated with the adjustment amount.

## Damage and shortage playbook (built into the case template)
1. Check the RC time vs POD time. The report must be within 24 hours (*"Record on delivery; report within 24 hours"*).
2. Compare POD evidence (provider) vs RC evidence (customer).
3. Request the provider's statement (status → waiting on provider, 24 h SLA).
4. Decide on responsibility: transit (provider) vs product (supplier) vs none. Reference the terms: *"assign product quality to sellers and transit safety to providers"*.
5. Apply the outcome and notify the parties.

## D21 — Cancellation reviews
- **Queue:** `UNDER_REVIEW` cancellation requests, with the order stage, the engine's reason (e.g. *"Supplied rules imply both 0% and 10%"*), the requested-by party, the order total, time in queue.
- **Review panel:** the rule table with the matched rows highlighted, the milestones with timestamps and sources (did the provider dispatch?), provider costs claimed (the provider can submit a statement, e.g. booking penalties), and the customer's reason.
- **Decision form:** fee % or amount (0 … total), distribution per D-14 (provider compensation vs platform), refund amount (auto = paid − fee), reason text (shown to the customer in X03/X04). Above the threshold → maker-checker.
- The decision triggers the order cancellation, refund, ledger entries and notifications.
- Reporting: decisions by stage (to inform D-01 policy updates).

## D22 — Conversation flags (anti-circumvention)
- A list of messages where contact details were masked pre-award (D-16) or flagged by keywords (e.g. "pay outside", "WhatsApp me").
- Columns: conversation context, sender org, masked snippet, rule triggered, count per org (repeat offenders).
- Actions: dismiss, warn the org (template), escalate to suspension review (link to Org 360).
- Staff can view the unmasked original only with a reason (audited).

## Support inbox (general)
- `GENERAL_SUPPORT` and `PAYMENT_ISSUE` cases come from the app (X04 "Chat with support", X07 "Contact support with transaction reference").
- Payment issue template: auto-attach the payment intent status and gateway refs, and the "Re-verify with gateway" action inline.
- Help centre FAQ management is in content settings ([module 09](09-configuration-content.md)).

## SLAs (defaults, configurable)

| Case type | First response | Resolution target |
|---|---|---|
| Damage/shortage | 4 business hours | 3 business days |
| Payment issue | 4 business hours | 1 business day |
| Cancellation review | 1 business day | 2 business days |
| Return escalation | 1 business day | 3 business days |
| Others | 1 business day | 5 business days |

Business hours: Sunday–Thursday 09:00–18:00 Riyadh, excluding holidays (proposal).

## Acceptance criteria
- [ ] Every case shows its complete context without navigating away (evidence, money, timeline).
- [ ] Internal notes are never visible to app users.
- [ ] Financial outcomes create the correct refunds and adjustments and release holds.
- [ ] SLA timers pause in waiting states and resume correctly. Breaches alert assignees.
