# Web Dashboard — Open Decisions

Dashboard-specific decisions. Business decisions are in the [master log](../../backend/md/09-open-decisions.md).

| ID | Decision | Options | Recommendation | Owner | Blocks |
|---|---|---|---|---|---|
| D-W01 | Dashboard UI stack (= T-07) | Next.js + shadcn/ui / Refine + Ant Design / low-code | **Next.js + shadcn/ui + TanStack Table**. A low-code tool only temporarily, for read-only internal reports | Tech | Phase 0 |
| D-W02 | Business web portal for suppliers/providers | None / in dashboard app (`/portal`) / separate app | **Phase 4, inside the same Next.js app** under `/portal` with user OTP auth. Priority use cases: bulk product upload (CSV), quotes and jobs on desktop | Product | Phase 4 |
| D-W03 | Dashboard design | Designer-led Figma / adopt a component library theme | A light Figma pass (layout, key pages: queue, 360, finance batch) on the Logix tokens. Other pages follow the patterns | Design | Phase 0 |
| D-W04 | Staff access restriction | 2FA only / 2FA + IP allow-list / VPN | 2FA for all + IP allow-list for finance and super admin | Security | Phase 1 |
| D-W05 | Maker-checker thresholds | Values | Refund > 5,000 SAR; cancellation decision > 5,000 SAR; all payouts batches; all rule changes | Finance | Phase 2 |
| D-W06 | KYB document download policy | View only / download with watermark / free download | View in browser. Download with a watermark for KYB reviewers only, and audit-logged | Compliance | Phase 1 |
| D-W07 | Queue assignment model | Pull (assign to me) / auto round-robin | Pull in MVP, round-robin for cases once volume grows | Ops | Phase 2 |
| D-W08 | Support channel | In-app chat only / + WhatsApp Business / + phone | In-app chat (cases) in MVP. WhatsApp Business integration later, via the case conversation bridge | Ops | Phase 2 |
| D-W09 | Reporting tool | Built-in reports only / + Metabase on a replica | Built-in operational reports + Metabase (self-hosted, masked views) from Phase 2 for finance/ops analysis | Tech + Finance | Phase 2 |
| D-W10 | Dashboard languages | English only / Arabic + English | **Both** (staff may prefer Arabic, and the data is bilingual) | Product | Phase 0 |

## Master-log decisions that shape the dashboard
- **D-01/D-14** Cancellation review rules and fee distribution → cancellation review screens.
- **D-02/D-03/D-04** Commission base, invoicing model, funds flow → finance module (ledger accounts, invoice types, payout process).
- **D-07** Insurance operating model → insurance ops screens.
- **D-08/D-09** Authorization verification and manual Fasah updates → customs ops.
- **D-10** Auto-acceptance → "awaiting acceptance" queue and auto-accept log.
- **D-11/D-12** Settlement holds and warehousing billing → settlements.
- **D-16** Flagged messages → conversation flags page.
- **D-18** Matching rules → zero-match queue actions.
- **D-22** Terms legal approval → terms publication with a sign-off record.
