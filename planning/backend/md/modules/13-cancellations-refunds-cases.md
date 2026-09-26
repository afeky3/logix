# Module 13 — Cancellations, Refunds, Cases and Disputes

## Purpose
- Let customers (and, in limited cases, providers and suppliers) cancel with a transparent financial impact.
- Resolve ambiguous rules through human review, and execute refunds.
- Manage all order-linked cases: damage/shortage reports, return escalations, payment issues, document issues and general support.

## Screens served
- Customer: X01 My orders, X02 Cancel service, X03 Cancellation under review, X04 Refund and support, K-O02 "Request cancellation", DONE "Open an order-linked case", RC "Report shortage or damage", K-R01 Report an issue, K-R02 Follow the claim.
- Provider/supplier: case notifications and responses, SR1 escalation.
- Dashboard: cancellation review queue, cases inbox, refund execution.

## 1. Cancellation policy engine

Input: `(subjectType, serviceType, orderStatus, latestMilestone, requestedBy, now)`. Output: `{ outcome: FEE_PERCENT | REQUIRES_REVIEW | NOT_ALLOWED, feePercent?, returnCosts?: bool, ruleId, explanationKey }`.

Supplied rules (client, X02 and terms):

| Stage | Fee |
|---|---|
| Before acceptance or dispatch | 0% |
| After acceptance, before arrival | 10% of service value |
| After arrival or customs start | 25% of service value |
| After pickup and transport start | 100% + return costs if possible |

Stage mapping *(until D-01 is decided)*:

| Service | Condition | Outcome |
|---|---|---|
| Any | Request not yet paid (no order, or `PENDING_PAYMENT`) | 0%, `AUTO` |
| Any | `CONFIRMED` (paid, provider not yet confirmed) | **Overlap 0% vs 10% → `REQUIRES_REVIEW`** (*"Supplied rules imply both 0% and 10%"*) |
| Transport, Shipping (road legs) | `SCHEDULED` … before `ARRIVED_AT_PICKUP` | 10%, `AUTO` |
| Transport, Shipping (road legs) | `ARRIVED_AT_PICKUP` | 25%, `AUTO` |
| Transport, Shipping | `CARGO_COLLECTED` / `PICKED_UP` / `DEPARTED` or later | 100% + return costs, `AUTO` (review if return costs are unknown) |
| Shipping sea/air (no pickup leg) | `BOOKING_CONFIRMED` … before `DEPARTED` | `REQUIRES_REVIEW` (carrier booking penalties vary) |
| Customs | `DECLARATION_SUBMITTED` or later ("customs start") | 25%, `AUTO` |
| Customs | `SCHEDULED` before declaration | 10%, `AUTO` |
| Warehousing | Any after `CONFIRMED` | `REQUIRES_REVIEW` (*"Define storage and non-vehicle service cancellation milestones"*) |
| Any | `AWAITING_ACCEPTANCE`, `COMPLETED` | `NOT_ALLOWED` → use a case instead |

- Rules are **data** (`cancellation_rules` table with effective dates), editable only by finance/product staff with maker-checker.
- *"Until resolved, use human review with no ambiguous automatic deductions."*

**Preview (X02):** `GET /orders/{id}/cancellation-preview` returns the rule table (for display), the matched stage, the expected charge (*"Shown after unambiguous stage resolution"*), or "requires review".

**Request:** `POST /orders/{id}/cancellation-requests { reasonCode, note }` → `CancellationRequest`:
- `AUTO` outcome → `AUTO_APPROVED` → refund of (paid − fee) + fee distribution (D-14) → order `CANCELLED`.
- `REQUIRES_REVIEW` → `UNDER_REVIEW`, the order goes to `CANCELLATION_REQUESTED`, the provider is notified to pause, and X03 shows *Order status: accepted, provider not dispatched • Review reason • Action: human review before any charge • Decision: notify customer of amount and reason*.

**Staff decision:** `POST /admin/cancellation-requests/{id}/decision { approve: bool, feeAmount, reason }` (maker-checker above a threshold) → refund.

**Provider-initiated cancellation:** allowed before `CARGO_COLLECTED` with a reason. The customer gets a full refund, and the provider takes a reliability penalty (internal score). Repeated cancellations lead to review or suspension.

**Purchase orders:** the buyer can cancel free before supplier `ACCEPTED`. After that, review is needed. The supplier can reject before acceptance (full refund).

## 2. Refunds
Executed by module 12. The customer sees X04: *Case reference CASE-2048 • Approved amount: determined after case review • Refund status: processing • Support: chat with support*. Target SLA: initiate within 1 business day of decision. The bank posting time depends on the issuer.

## 3. Cases

**Case**: `reference` (`CASE-…`), `type`, `subject` (order/PO/return/payment/insurance), `opened_by` (user + org + workspace), `counterparty_org_id?`, `status`, `priority` (`LOW`/`NORMAL`/`HIGH`/`URGENT`), `assignee_staff_id?`, `sla_due_at`, `resolution_code?`, `resolution_note?`, `financial_outcome?` (refund amount, adjustment to settlement), `conversation_id`.

Case types:

| Type | Opened from | Default SLA (first response) |
|---|---|---|
| `DAMAGE_SHORTAGE` | RC (condition ≠ intact) or damage report ≤ 24 h | 4 business hours |
| `CANCELLATION_REVIEW` | X02 when review is required | 1 business day |
| `RETURN_ESCALATION` | SR1 "escalate" or buyer dispute | 1 business day |
| `PAYMENT_ISSUE` | X07 "Contact support with transaction reference" | 4 business hours |
| `DOCUMENT_ISSUE` | Order documents | 1 business day |
| `SERVICE_ISSUE` | DONE "Open an order-linked case", trip issues | 1 business day |
| `INSURANCE_CLAIM_SUPPORT` | IN4 (support only; the insurer decides) | 2 business days |
| `GENERAL_SUPPORT` | X04 "Chat with support", account | 1 business day |

- Participants: the opener, the counterparty (provider or supplier, when relevant) and staff. Internal staff notes are hidden from users.
- Evidence attachments are handled by module 04.
- Resolution can trigger: a refund, a settlement adjustment (reduce the provider payout for proven damage), a replacement PO, or a no-action closure with reason.
- Settlement hold: any open `DAMAGE_SHORTAGE` or `RETURN_ESCALATION` case puts the related settlement `ON_HOLD`.
- Responsibility per the terms: *"assign product quality to sellers and transit safety to providers"*. Staff use this as a decision guideline. Legal disputes are out of scope (Saudi law, Jeddah commercial courts).

## API

| Method | Path | Actor |
|---|---|---|
| GET | `/orders/{id}/cancellation-preview` | Customer |
| POST | `/orders/{id}/cancellation-requests`, `/purchase-orders/{id}/cancellation-requests` | Customer |
| GET | `/cancellation-requests/{id}` | Customer |
| POST | `/provider/orders/{id}/cancel` | Provider (with reason) |
| POST / GET | `/cases`, `/cases/{id}` | Any user (scoped) |
| POST | `/cases/{id}/messages` (via conversation), `/cases/{id}/attachments` | Participants |
| POST | `/cases/{id}/reopen` (≤ 7 days after resolve) | Opener |
| — | Admin: `/admin/cancellation-requests` (queue, decide), `/admin/cases` (inbox, assign, status, resolve, internal notes), `/admin/refunds` | Staff |

## Events
`cancellation.previewed`, `cancellation.requested`, `cancellation.auto_approved`, `cancellation.decided`, `refund.*`, `case.opened`/`assigned`/`status_changed`/`resolved`/`reopened`/`sla_breached`.

## Acceptance criteria
- [ ] The preview always matches the eventual automatic decision for the same state.
- [ ] Ambiguous stages never auto-deduct and always create a review item.
- [ ] Refund + retained fee = amount paid, and the ledger balances.
- [ ] Cases enforce participant visibility, SLAs are tracked and breaches alert staff.
