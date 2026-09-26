# Web Dashboard — Architecture

## 1. Project structure (`apps/dashboard`)

```
apps/dashboard/
├── app/
│   ├── [locale]/                     # ar | en (next-intl); sets <html dir>
│   │   ├── (auth)/ login, mfa, reset-password, invite/[token]
│   │   └── (console)/
│   │       ├── layout.tsx            # shell: sidebar, topbar (search, notifications, staff menu), breadcrumb
│   │       ├── page.tsx              # Home / KPIs
│   │       ├── verification/  organizations/  users/
│   │       ├── requests/  orders/  live/  customs/  warehousing/
│   │       ├── marketplace/ (categories, products, purchase-orders, returns)
│   │       ├── finance/ (payments, refunds, settlements, payouts, commissions, invoices, ledger)
│   │       ├── cases/  cancellations/  insurance/
│   │       ├── content/ (reference-data, terms, templates, faqs, banners, broadcasts)
│   │       ├── settings/ (rules, calendar, feature-flags, app-config, staff, roles)
│   │       ├── reports/  audit/  system/
│   └── api/auth/ (route handlers: login, mfa, refresh, logout → set/clear HttpOnly cookie)
├── src/
│   ├── components/ (ui/ shadcn, data-table/, entity-header/, timeline/, money/, status-badge/,
│   │               document-viewer/, map/, maker-checker/, reason-dialog/, pii-field/)
│   ├── features/<area>/ (queries.ts, columns.tsx, filters.tsx, actions.tsx, detail/*)
│   ├── lib/ (api client, auth, permissions, i18n, formatters, export)
│   └── styles/ (tokens.css from @logix/design-tokens)
└── tests/ (e2e Playwright)
```

## 2. Authentication flow
1. `/login`: email + password → the backend returns `mfaRequired` + `mfaToken`.
2. `/mfa`: TOTP → the backend returns the access token (memory) + refresh token, which the Next.js route handler stores as an **HttpOnly, Secure, SameSite=Strict** cookie scoped to `/api/auth`.
3. The access token (15 min) is kept in memory (React context). A silent refresh runs via `/api/auth/refresh`.
4. Idle timeout 30 min (warning at 25), absolute session 8 h.
5. First login from an invite: set a password, then enrol TOTP (QR code) with backup codes.

## 3. Authorization in the UI
- `GET /admin/me` returns `permissions[]`. `<Can permission="finance.payouts.approve">` hides or disables actions, and route guards redirect to 403.
- The UI only hides what the backend enforces. Every action is re-checked server-side.
- **Maker-checker component:** actions that need approval create a *pending action* shown in "Approvals" with a diff/summary. A different staff user approves or rejects. The maker cannot approve their own action (enforced by the backend, and the UI hides the button).
- **Reason dialog:** every sensitive action (suspend org, reject KYB, correct milestone, unmask PII, force-complete, refund) requires a reason (min 10 chars) that is stored in the audit log.

## 4. Data patterns

| Pattern | Implementation |
|---|---|
| List pages | `DataTable` with server pagination (`page`, `pageSize`), multi-filters in the URL (shareable links), sort, column chooser, density, saved views (per staff via API), CSV export (async job → notification + download link) |
| Queues | Lists with SLA columns (time in queue, colour thresholds), "Assign to me", auto-refresh every 30 s + realtime nudges, keyboard navigation (J/K, Enter) |
| Detail pages ("360") | Header (reference, status badge, key facts, primary actions) + tabs: Overview, Timeline, Documents, Money, Messages, Linked, Cases, Audit |
| Forms | Sheet/drawer for quick edits, full page for complex ones (commission rules, terms). zod validation. Optimistic concurrency with `If-Match`/version (conflict → reload prompt) |
| Documents | In-app viewer (PDF/image zoom/rotate), version history, decision panel beside the viewer (accept / request changes + reason code) |
| Money | `Money` component (halalas → SAR, locale formatting). Breakdown tables identical to the app's |
| Timeline | Shared component showing source badges (Provider/Driver/Broker/Admin/Integration/System) and timestamps in Riyadh time |
| Search | Global search (topbar) by reference (LX-, PO-, RT-, CASE-, TRX-), phone (masked match), CR number, org name → jump to entity |

## 5. Realtime
- One socket per staff session. It joins `staff:ops` (+ queue-specific rooms).
- Events update queue counters in the sidebar (e.g. "KYB 12", "Cases 5 breaching"), invalidate open detail pages, and move markers on the live trips map.

## 6. i18n and RTL
- The locale is in the URL (`/ar/...`, `/en/...`), and staff preference is stored in their profile.
- `dir` switches on `<html>`. Tailwind logical utilities and Radix components support RTL.
- Tables: in RTL the column order is mirrored and numeric columns stay LTR-isolated and right-aligned consistently. Money and reference columns use the bidi-isolated components.
- Enum labels come from the shared `@logix/i18n` catalogs (same as the app).

## 7. Performance and UX budgets
- First load of the console shell < 2 s on office broadband. Table page loads < 1 s p95 (server-side).
- Keyboard shortcuts: `/` global search, `g o` orders, `g k` KYB, `g c` cases, `?` help.
- Every destructive or financial action gets a confirmation dialog summarizing the effect.

## 8. Security (front-end)
- No tokens in localStorage or sessionStorage. CSP with nonces. Sanitize any rich text (terms preview, templates) with DOMPurify.
- PII fields are masked with a "Reveal" button (reason required → audit → auto re-mask after 60 s).
- File previews use short-lived pre-signed URLs. Downloads are watermarked with staff email + time (for KYB documents, proposal).
- Session and device list for staff, and forced logout by super admin.
