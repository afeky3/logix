# Dashboard Module 03 — Organizations and Users (D13–D15)

Backend: [auth-identity](../../../backend/md/modules/01-auth-identity.md), [organizations-kyb-terms](../../../backend/md/modules/02-organizations-kyb-terms.md), [transport-fleet](../../../backend/md/modules/08-transport-fleet.md), [warehousing](../../../backend/md/modules/09-warehousing.md).

## D13 — Organizations list
**Columns:** name (legal/trade), kind (Individual/Business), workspaces (chips with status: Active / Pending / Suspended), activities, city, CR number, rating (providers/suppliers), orders count (90 d), open cases, created at, flags (duplicate IBAN/CR/phone, high cancellation rate).
**Filters:** workspace, status, activity, city, flagged, created range, has expired licences.
**Actions:** open 360, export.

## D14 — Organization 360
**Header:** name, kind, workspaces with status, verification badge, rating, key counts, and primary actions (permission-aware): `Suspend workspace` / `Reactivate` (reason), `Open KYB case`, `Message owner` (support thread), `Add internal note`.

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Business profile, national address, contacts, KPIs (orders, GMV, cancellation rate, on-time rate for providers, return rate for suppliers) |
| Members | Users with roles (owner, drivers…), status, last login. Actions: remove member (reason), revoke sessions |
| Verification | KYB cases history, items and decisions (links to D11) |
| Licences | Licences with expiry and documents |
| Bank accounts | Masked IBANs, verification status, change history (holds applied), reveal with reason |
| Activities & areas (provider) | Activities with status and service areas on a map/list. Suspend/reactivate an activity |
| Fleet (carrier) | Vehicles (plate, type, capacity, documents expiry), drivers (licence expiry, status, current trip) |
| Warehouse sites | Sites, capacity, storage types, active contracts |
| Requests / Orders | As customer and as provider, filterable, links to D06 |
| Marketplace (supplier) | Listings (status), POs, returns, rating |
| Finance | Settlements, payouts, refunds, holds |
| Cases | Cases opened by or against this org |
| Consents | Terms versions accepted (who, when, context) |
| Audit | All changes on this org and its sub-entities |

## D15 — Users list and user detail
**List columns:** name, phone (masked), email, locale, memberships (org + role + workspace), status, last login, created at.
**Search:** phone (exact E.164 match only, no partial search), name, email.

**User detail:**
- Profile, memberships, sessions/devices (platform, app version, last seen) → `Revoke session` / `Revoke all`.
- Status actions: `Suspend user` (reason; blocks login and all memberships) / `Reactivate`.
- Account deletion requests (PDPL): queue view with eligibility checks (open orders, balances, cases) and `Approve deletion` / `Reject with reason`. Deletion anonymizes personal data and retains financial records as required.
- Consent history and audit.

## Rules and safeguards
- Suspending a **provider workspace** blocks new matches and quotes. Running orders continue unless ops also reassigns or cancels them (a separate action with customer consideration). The dashboard shows running orders before confirming.
- Suspending a **supplier workspace** pauses all listings (status `PAUSED` with reason) and blocks new POs. Open POs need handling (listed).
- Suspending a **customer** blocks new requests and payments. Open orders continue.
- Every suspension notifies the org owner (template) unless "silent" is chosen for fraud investigations (super admin only).
- Merging duplicate organizations is not supported in MVP (manual handling via support).

## Acceptance criteria
- [ ] The Org 360 shows every linked entity with working links.
- [ ] Suspension effects match the rules above and are reversible, with an audit trail.
- [ ] PII is masked by default, and reveals are reasoned and logged.
- [ ] Session revocation takes effect within one access-token lifetime (≤ 15 min), and refresh is blocked immediately.
