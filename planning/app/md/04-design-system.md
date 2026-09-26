# Mobile App — Design System

Tokens are published from `packages/design-tokens` (JSON → TS for mobile and CSS variables for the dashboard). Values marked **confirm** must be taken from the final Figma or SVG assets. The PDFs are review renders, and some values are truncated in the text layer.

## 1. Color tokens

| Token | Value | Usage | Source |
|---|---|---|---|
| `brand.navy` | ≈ `#0E0F33` (**confirm**) | App header (V2), deck header bar, dark hero cards | V2 renders |
| `brand.primary` | `#29378?` (**confirm**, last digit truncated in the icons guide text) | Primary buttons, links, active tab, icons | Icons guide "primary #29378…" |
| `brand.accent` | `#EC4F24` | Logo mark, progress/current step dot, arrows, favorite hearts, highlights | Icons guide |
| `surface.background` | ≈ `#F1F2F6` (**confirm**) | Screen background | Renders |
| `surface.card` | `#FFFFFF` | Cards, field rows | |
| `surface.field` | ≈ `#F4F5F9` (**confirm**) | Field-row background (label + value blocks) | V2 renders |
| `surface.selected` | ≈ `#ECEFFA` (**confirm**) | Quote cards, highlighted rows | V2 SHQ |
| `text.primary` | ≈ `#12132F` (**confirm**) | Titles, values | |
| `text.secondary` | ≈ `#6B7085` (**confirm**) | Labels, subtitles | |
| `status.success` | green (**confirm**) | Success check circle, "Accepted" badges | DONE, B03 |
| `status.warning` | amber (**confirm**) | Notices ("Action required", design-sample banner), "Low stock", "Under review" | Kit D04, S02 |
| `status.danger` | red (**confirm**) | "Rejected", errors | Kit D02 |
| `status.info` | primary-tint | Informational banners | |

Rules:
- Text on `brand.primary` buttons is white. Check AA contrast on all pairs once the hex values are confirmed.
- The accent orange is for emphasis (current timeline step, arrows, hearts), never for large text blocks.
- Dark mode is not in the designs. Tokens are structured for it, but it is out of scope for v1.

## 2. Typography
- The renders appear to use **IBM Plex Sans** (Latin) and **IBM Plex Sans Arabic** (Arabic) (**confirm** with design). Both are open-source (OFL) and can be bundled.
- Scale (proposal, 4-pt rhythm):

| Style | Size / line height | Weight | Usage |
|---|---|---|---|
| `display` | 28/36 | 600 | Hero cards ("Logistics, made clearer") |
| `title` | 22/30 | 500 | Screen titles ("Order follow-up") |
| `subtitle` | 14/20 | 400, secondary | Screen subtitle ("Sea • Shanghai to Jeddah") |
| `label` | 12/16 | 400, secondary | Field labels ("Departure port") |
| `body` | 15/22 | 400 | Values, paragraphs |
| `button` | 16/22 | 500 | CTAs |
| `caption` | 11/14 | 400 | Tab labels, footnotes |

- Arabic line height is at least 1.5× the font size. Don't letter-space Arabic.
- Support OS font scaling up to 130% without truncating CTAs (wrap to two lines).

## 3. Spacing, radius and elevation
- 4-pt base: `4, 8, 12, 16, 20, 24, 32`. Screen horizontal padding is 20.
- Radius: cards 12, field rows 10, buttons 10, chips 16 (pill), bottom sheets 20 (top only).
- Elevation: cards use subtle shadow or border (V2 uses flat cards on a gray background). Bottom CTA bar has a top divider.

## 4. Components (inventory from the client screens)

| Component | Description | Seen in |
|---|---|---|
| `AppHeader` | Back / logo / more (V2) or bell / logo / back (kit) | All |
| `ScreenTitle` | Title + subtitle | All |
| `FieldRow` | Label (small, secondary) + value or placeholder, tappable → opens an input, picker or sheet. **The main building block of the V2 designs** | SH02, TR03, A05… |
| `SegmentedControl` | 2–4 options (Sea/Air/Land, Individual/Company, Import/Export, Dry/Chilled/Frozen) | K-F01, K-A05, K-W01 |
| `Stepper` | 4-segment progress bar + "04/02" label | Kit wizards |
| `PrimaryButton` / `SecondaryButton` / `TextButton` | Full-width sticky CTA at the bottom; outline secondary (e.g. "Edit request") | All |
| `ConsentCheckbox` | Checkbox + label + optional "Read full terms" link. **Never pre-checked** | SHR, SHP, A07, RC, S04, IN2 |
| `Timeline` | Vertical dots + cards. Done = primary dot, current or next = accent dot, pending = gray. Each item: label, value, optional timestamp + source | SHF, SH08, TR06, CU06, CU08, WH06, M09, M11, X04 |
| `QuoteCard` | Provider name • rating, price, ETA/timeline, badges (cheapest/fastest/top rated), validity | SHQ, K-Q01 |
| `CompareTable` | Column per provider, rows: total, delivery, rating, loading, validity | K-Q02 |
| `CostBreakdown` | Line items + VAT + total, with a highlighted total row | SHP, K-Q03, K-B01, M07 |
| `MapCard` | Route polyline, origin/destination pins, live vehicle marker, "Illustrative route" caption until live | SH02, TR02, TR05, PT2 |
| `ProductCard` | Image, favorite heart (accent), name, price | M01 |
| `StatTile` | Number + label (12 delivered / 05 new offers / 03 active) | Kit H01, S01, P01 |
| `HeroCard` | Navy card with headline + CTA | Kit H01, A01, P05 |
| `StatusBadge` | Pill: accepted, under review, rejected, new, preparing, low stock, inactive, in transit… | Kit D02, S02, S04 |
| `DocumentRow` | File icon, name, file name • size, status badge, tap to view/replace | Kit D02, SH09 |
| `UploadZone` | Dashed box "Upload file or scan document • PDF, JPG, PNG • max 10 MB" + progress | Kit D02, CU03 |
| `ScanEditor` | Crop edges / rotate / enhance clarity + preview | Kit D03 |
| `SignaturePad` | Signature capture with clear/confirm | RC, POD |
| `PhotoGrid` | Evidence photos with add/remove and a minimum count | RC, POD, PW2, PT3 |
| `RatingStars` | 5-star input (accent outline) | DONE |
| `OtpInput` | 6 boxes, auto-fill from SMS (Android SMS Retriever / iOS one-time-code), resend timer | A03 |
| `Banner` | Info / warning / error / success, with optional action ("Action required: re-upload packing list") | Kit D04, R01 |
| `EmptyState` / `ErrorState` / `OfflineState` | Illustration + text + action | X07, X08 |
| `SuccessState` | Green check circle + title + summary card + CTA | DONE, B03, M08, CU09, P04, PAY2 |
| `BottomSheet` | Pickers, confirmations, filters | Global |
| `SearchBar` + `FilterChips` | Search products/requests, chips (Riyadh • Equipment • Packaging • Other) | M01, M02, P06 |
| `ListItemCard` | Icon + title + subtitle + trailing badge/chevron | Kit H01, H02, S01, P05 |
| `TabBar` | 3–5 tabs with badges | All |
| `MoneyText` | Formatted amount + currency (SAR / ر.س) with bidi isolation | Everywhere |
| `ReferenceText` | Order refs (LX-260148) with copy action and LTR isolation | Everywhere |

Each component ships with: RTL and LTR stories, loading skeleton, disabled state, accessibility labels and a unit snapshot.

## 5. Icons (from the handoff)
- 48 icons, 24×24 grid, 1.6 stroke, round caps. SVG (recolorable) + PNG at 96 and 192 px.
- Categories:
  - **legacy**: sea-freight, truck, air-freight, account, store, document, package, message, check, wallet, location
  - **navigation**: back-ltr, back-rtl, home, orders, more
  - **extension**: search, filter, favorite, star, upload, download, camera, close, checkbox, checkbox-checked, warning, info, notification, calendar, clock, lock, edit, refresh, offline, shield, warehouse, customs, compare, cart, arrow-left, arrow-right, battery, signal
  - **illustration**: product-box, product-shelving, product-truck, route-map
- `manifest.json` maps name → category. Keep file names in code (`Icon name="sea-freight"`).
- **Directional rules:** use `back-rtl`/`back-ltr` by locale. Never mirror sea-freight, truck, air-freight or the logo. Arrow icons are chosen by semantic direction (next/previous), not by raw left/right.
- Minimum touch area is 44×44 with a readable label (icons guide).
- Illustrations are *"illustrative graphics, not product photos"*. Product images in production come from supplier photos. Illustrations are fallbacks only.
- The logo is an independent identity asset, not a navigation icon.

## 6. Motion
- Standard durations: 150 ms (press), 250 ms (sheet), 350 ms (screen).
- Success states: a subtle check animation (Lottie).
- Live map marker: interpolate between GPS points.
- Respect the OS "reduce motion" setting.
