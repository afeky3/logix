# Dashboard Module 05 — Marketplace Administration (D16–D19)

Backend: [marketplace](../../../backend/md/modules/11-marketplace.md). App: [buyer](../../../app/md/modules/07-marketplace-buyer.md), [supplier](../../../app/md/modules/08-supplier.md).

## D17 — Categories
- A tree editor with drag and drop ordering, max depth 3, and bilingual names (ar/en required), slug, icon (from the handoff set or an uploaded illustration), active flag.
- Attributes per category (optional, Phase 3+): suggested spec keys (e.g. dimensions, material, ply), which helps sellers fill S02 consistently.
- Rules: a category cannot be deleted while products reference it (move products first). Deactivation hides it from buyers and blocks new listings in it.
- Audit on every change.

## D16 — Products moderation
**Queues:**
- *Pending review* (when pre-moderation is on via feature flag)
- *Flagged*: buyer reports, automated checks (prohibited keywords, suspicious prices, duplicate images across suppliers, contact info in descriptions)
- *Recently published* (post-moderation sampling)

**Table columns:** image, name, supplier, category, price, MOQ, stock, status, created/updated, flags.

**Product detail (admin view):** all fields, image gallery, specs, supplier (link to Org 360), sales stats, reports and history, audit.

**Actions:**

| Action | Effect |
|---|---|
| Approve | `PENDING_REVIEW` → `PUBLISHED` |
| Request changes | Returns to the supplier as `DRAFT` with a reason (template messages: "Use real product photos", "Price unit unclear", "Contact details not allowed in description") |
| Remove (takedown) | `REMOVED`, reason required; the supplier is notified; buyers' carts drop the item |
| Restore | Back to the prior state (reason) |
| Suspend supplier's listings | Bulk pause all of a supplier's products (links to Org 360 suspension) |

Prohibited and counterfeit items: supplier terms state *"Products must be new, original, compliant and not counterfeit. Sellers bear product quality, intellectual property and trademark responsibility."* The moderation checklist mirrors this.

## D18 — Purchase orders
- **List columns:** PO reference, buyer, supplier, items count, total, status, readiness due, linked transport order, delivered/received dates, return status, settlement status.
- **Queues:** readiness overdue, not accepted by supplier within 24 h, delivered but not received > 72 h, cancellation requested.
- **PO 360:** items (price snapshots), amounts (products, shipping, VAT, total, commission 3.5%), timeline (supplier events, carrier events, buyer RC), readiness evidence (photos, documents), handover evidence, linked transport order (link to D06), returns, messages, money (payment, refunds, settlement with return-window hold), audit.
- **Interventions:** nudge supplier or buyer, cancel PO with refund (maker-checker above threshold), extend readiness (with buyer notice), place/release settlement hold.

## D19 — Returns (escalations)
- **List:** RT reference, PO, buyer, supplier, reason, quantity, preferred resolution, status, age, escalated (yes/no).
- **Return detail:** buyer evidence vs listing (side by side: listing images and specs vs buyer photos), supplier decision and reasons, conversation, logistics (return pickup order), money impact preview.
- **Admin decision** (for `ESCALATED`):
  - *Uphold return*: supplier bears return logistics (non-conforming goods), with refund or replacement.
  - *Reject return*: reason, and the buyer is notified.
  - *Partial*: a partial refund amount (maker-checker above threshold).
- The decision triggers the refund (module 12), the settlement adjustment and notifications. It is recorded with the policy reference (*3 days after receipt under supplied policy*, D-21).

## Marketplace KPIs (also on D01/D40)
GMV, POs count, average order value, conversion (product views → purchases), active listings, sellers with sales, fulfilment time (placed → ready), on-time readiness %, return rate by reason, top categories and suppliers.

## Acceptance criteria
- [ ] Moderation actions notify suppliers with localized reason templates.
- [ ] Removing a product never alters existing PO item snapshots.
- [ ] Escalation decisions execute refunds and settlement adjustments consistently, with an audit trail.
- [ ] Category tree changes reflect in the app within the reference cache TTL.
