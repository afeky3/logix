# Web Dashboard — Information Architecture

## 1. Sidebar (grouped; badges show queue counts)

```
Home
Approvals ●                      (maker-checker items awaiting me)
─ Operations
  Requests  ● zero-match / zero-quote
  Orders    ● readiness overdue / awaiting acceptance > 72h
  Live trips
  Customs   ● authorizations to verify
  Warehousing
─ Verification
  KYB queue ●
  Licences (expiring)
  Organizations
  Users
─ Marketplace
  Products  ● pending review / flagged
  Categories
  Purchase orders
  Returns   ● escalated
─ Support
  Cases     ● breaching SLA
  Cancellation reviews ●
  Conversations flags ●
  Insurance ●
─ Finance
  Payments
  Refunds
  Settlements
  Payout batches ●
  Invoices
  Commission rules
  Ledger & reconciliation
─ Content
  Reference data
  Terms & policies
  Notification templates
  FAQs & banners
  Broadcasts
─ Reports
─ Settings
  Rules (cancellation, returns, document requirements)
  Business calendar
  Feature flags & app config
  Staff & roles
─ Audit log
─ System (queues, webhooks, integrations)
```

Sections are hidden when the staff user lacks the read permission.

## 2. Page inventory

| # | Page | Route | Module doc |
|---|---|---|---|
| D01 | Home / KPIs | `/` | [01](modules/01-home-kpis.md) |
| D02 | Approvals inbox | `/approvals` | [11](modules/11-audit-security-system.md) |
| D03 | Requests list + queues | `/requests` | [04](modules/04-requests-orders-operations.md) |
| D04 | Request detail | `/requests/[id]` | 04 |
| D05 | Orders list | `/orders` | 04 |
| D06 | Order 360 | `/orders/[id]` | 04 |
| D07 | Live trips map | `/live` | 04 |
| D08 | Customs: authorizations & declarations | `/customs` | 04 |
| D09 | Warehousing: contracts & inventory | `/warehousing` | 04 |
| D10 | KYB queue | `/verification` | [02](modules/02-verification-kyb.md) |
| D11 | Verification case review | `/verification/[caseId]` | 02 |
| D12 | Licences expiry | `/verification/licences` | 02 |
| D13 | Organizations list | `/organizations` | [03](modules/03-users-organizations.md) |
| D14 | Organization 360 | `/organizations/[id]` | 03 |
| D15 | Users list / user detail | `/users`, `/users/[id]` | 03 |
| D16 | Products moderation | `/marketplace/products` | [05](modules/05-marketplace-admin.md) |
| D17 | Categories tree | `/marketplace/categories` | 05 |
| D18 | Purchase orders list / PO 360 | `/marketplace/purchase-orders[/id]` | 05 |
| D19 | Returns (escalations) | `/marketplace/returns[/id]` | 05 |
| D20 | Cases inbox / case detail | `/cases[/id]` | [07](modules/07-cases-disputes-support.md) |
| D21 | Cancellation reviews | `/cancellations[/id]` | 07 |
| D22 | Conversation flags | `/support/flags` | 07 |
| D23 | Insurance requests / claims / insurers | `/insurance/*` | [08](modules/08-insurance-ops.md) |
| D24 | Payments | `/finance/payments[/id]` | [06](modules/06-finance.md) |
| D25 | Refunds | `/finance/refunds` | 06 |
| D26 | Settlements | `/finance/settlements` | 06 |
| D27 | Payout batches / batch detail | `/finance/payouts[/id]` | 06 |
| D28 | Invoices & credit notes | `/finance/invoices` | 06 |
| D29 | Commission rules | `/finance/commissions` | 06 |
| D30 | Ledger & reconciliation | `/finance/ledger` | 06 |
| D31 | Reference data (per catalog) | `/content/reference/[catalog]` | [09](modules/09-configuration-content.md) |
| D32 | Terms & policies (versions, editor, preview) | `/content/terms` | 09 |
| D33 | Notification templates | `/content/templates` | 09 |
| D34 | FAQs, banners | `/content/faqs`, `/content/banners` | 09 |
| D35 | Broadcasts | `/content/broadcasts` | 09 |
| D36 | Rules (cancellation, returns, document requirements, thresholds) | `/settings/rules` | 09 |
| D37 | Business calendar | `/settings/calendar` | 09 |
| D38 | Feature flags & app config | `/settings/flags` | 09 |
| D39 | Staff & roles | `/settings/staff` | 11 |
| D40 | Reports | `/reports` | [10](modules/10-reports-analytics.md) |
| D41 | Audit log & consent search | `/audit` | 11 |
| D42 | System: queues/DLQ, webhooks, integrations | `/system` | 11 |
| D43 | Staff profile (language, 2FA, sessions) | `/me` | 11 |

## 3. Cross-links (360 navigation)
- **Order 360** ↔ customer org, provider org, request, quotes, payment(s), refunds, settlement, invoice(s), documents, cases, linked orders, conversations, audit.
- **Organization 360** ↔ members, workspaces, KYB cases, licences, bank accounts, activities and service areas, fleet/drivers/sites, requests, orders, POs, products, settlements, payouts, cases, consents, audit.
- **Case** ↔ subject (order/PO/return/payment), parties, refunds, settlement holds.
- **Payout batch** ↔ settlements ↔ orders/POs.

## 4. Global elements
- **Topbar:** global search (references, CR number, phone, names), realtime notification bell for staff (assignments, approvals, SLA breaches), language switch, staff menu.
- **Breadcrumbs** with entity references.
- **Entity header** pattern: reference + copy, status badge, service icon, parties, amounts, primary actions (permission-aware), "more" (secondary actions), last updated.
