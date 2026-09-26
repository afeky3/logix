# Module 14 — Cargo Insurance

## Purpose
An optional service linked to a shipment. The customer compares insurer options, requests a quote, pays the premium (per D-07), receives an issued policy, and can file a claim.

*"No insurer partnership, automatic issuance or commission is assumed."* The MVP is therefore **operations-driven**: Logix staff mediate between customer and insurer until partnerships or APIs exist.

## Screens served
- Customer: IN1 Cargo insurance providers, IN2 Coverage details, IN3 Insurance request and policy, IN4 Insurance claim request. Entry points: SH06 "Cargo insurance — compare insurers and coverage", SHF/SH08 "Documents & actions — order files, insurance and notes".
- Dashboard: insurers catalog, insurance request queue (quote entry, policy upload), claims support.

## Entities

| Entity | Key fields |
|---|---|
| `Insurer` | `name` (IN1 examples: *Insurer A*, *Insurer B*; illustrative, not contracted), `coverage_modes` (SEA/ROAD/AIR/EXPRESS), `summary_ar/en` (*Sea and road cargo coverage*), `terms_document_id`, `status`, `contact` (ops only) |
| `InsuranceRequest` | `order_id` (shipment), `insurer_id`, `declared_value` (e.g. 50,000 SAR), `route_snapshot`, `commodity_snapshot`, `status`, `premium?`, `deductible?`, `coverage_limits?`, `exclusions?`, `quote_document_id?`, `quote_valid_until?`, `consent_id` (`INSURANCE_TERMS`, *"Separate consent from transport terms"*) |
| `InsurancePolicy` | `request_id`, `policy_number`, `document_id`, `coverage_start`, `coverage_end`, `issued_at` |
| `InsuranceClaim` | `policy_id`, `incident_date`, `description`, `evidence_file_ids` (*photos, delivery record, invoice*), `status`, `insurer_decision?`, `amount_approved?`, `case_id?` |

## Flow

1. **IN1 Compare:** `GET /insurance/insurers?mode=SEA` lists active insurers with coverage summaries and compare options (*limits, exclusions, deductible*), plus the note *"Illustrative names, not contracted insurers"* until real partners exist.
2. **IN2 Coverage details:** declared cargo value (required, SAR), route and commodity (*from shipment request*, read-only), coverage and exclusions (*view insurer terms document*), deductible and premium (*as stated in the insurer quote*), and the consent checkbox (never pre-selected).
3. **Request:** `POST /insurance/requests { orderId, insurerId, declaredValue, consent }` → `REQUESTED` → a staff task in the dashboard.
4. **Staff obtain the quote** from the insurer offline, then enter the premium, deductible, limits and validity and upload the quote document → `QUOTED`. The customer is notified.
5. **IN3 tracking:** *Quote request: under insurer review → Premium approval: customer acceptance then payment → Policy issuance: no active coverage before confirmed issuance → Policy document: available after issuance*.
6. **Accept and pay:** `POST /insurance/requests/{id}/accept`. Payment route per D-07:
   - (a) the customer pays the insurer directly (the link or instructions are shown, and staff confirm payment), or
   - (b) the premium is collected in-app as a pass-through (`INSURANCE_PREMIUM` payable), only if a licensed arrangement is confirmed.
7. **Issue:** staff upload the policy (number, dates, document) → `ISSUED`. The policy appears in the order documents.
8. **IN4 Claim:** `POST /insurance/claims { policyId, incidentDate, description, evidenceFileIds }` → `SUBMITTED`. Staff forward it to the insurer → `WITH_INSURER`. *"Coverage and compensation decided by insurer."* Staff record the decision and the amount. The customer sees the status timeline.

## Rules
- Insurance can be requested only for shipments/orders that haven't departed (proposal: before `DEPARTED`/`CARGO_COLLECTED`), because coverage must start before transit.
- Coverage never shows as active before `ISSUED`. The UI and API must not use the word "insured" before then.
- No commission is booked on premiums (client note). If a licensed referral fee is agreed later, it becomes a new commission category.
- A damage case (module 13) on an insured shipment shows the policy and a shortcut to IN4, but the processes are separate. The provider liability case and the insurance claim may run in parallel.

## API

| Method | Path | Actor |
|---|---|---|
| GET | `/insurance/insurers?mode` | Customer |
| POST / GET | `/insurance/requests`, `/insurance/requests/{id}` | Customer |
| POST | `/insurance/requests/{id}/accept`, `/cancel` | Customer |
| GET | `/insurance/policies/{id}` | Customer |
| POST / GET | `/insurance/claims`, `/insurance/claims/{id}` | Customer |
| — | Admin: `/admin/insurers` CRUD, `/admin/insurance/requests` (queue, quote entry, mark paid, issue policy), `/admin/insurance/claims` (update status/decision) | Staff (ops) |

## Events
`insurance.requested`, `insurance.quoted`, `insurance.accepted`, `insurance.paid`, `insurance.issued`, `insurance.declined`, `insurance.expired`, `insurance_claim.submitted`/`updated`/`decided`.

## Acceptance criteria
- [ ] Insurance consent is recorded separately from transport terms.
- [ ] No coverage wording appears before policy issuance.
- [ ] Staff can complete a full request → quote → issue → claim cycle from the dashboard with a complete audit trail.
