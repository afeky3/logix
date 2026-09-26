# LOGIX / Design Handoff / V3 — Icons Guide (Arabic edition, English translation)

Source: `Clint_docs/04-LOGIX-Icons-Guide.pdf` (Arabic original, 5 pages) — translated/summarized to English.
UI/UX design & user experience package • proposed design data and prices, illustrative • design proposal for handoff • Logix • 24 September 2026

## Overview

Icon library delivered in the attached package as SVG and PNG, originally 24×24, for navigation, services, statuses, and used illustrations. 48 icons in total.

Design for review and implementation, not a working app or Figma file. Core screens and alternative states are identified by fixed IDs, referenceable via an original PDF index. Policies and uncounted integrations are explained in the appendix.

## Icon Library (48 icons)

### Legacy — transport, service & state icons (1–20/48)
- sea-freight (legacy)
- truck (legacy)
- air-freight (legacy)
- account (legacy)
- store (legacy)
- document (legacy)
- package (legacy)
- message (legacy)
- check (legacy)
- wallet (legacy)
- location (legacy)
- back-ltr (navigation)
- back-rtl (navigation)
- home (navigation)
- orders (navigation)
- search (extension)
- filter (extension)
- favorite (extension)
- star (extension)
- more (navigation)

### Extension icons (21–40/48)
- upload
- download
- camera
- close
- checkbox
- checkbox-checked
- warning
- info
- notification
- calendar
- clock
- lock
- edit
- refresh
- offline
- shield
- warehouse
- customs
- compare
- cart

### Extensions / Illustrations (41–48/48)
- arrow-left (extension)
- arrow-right (extension)
- battery (extension)
- signal (extension)
- product-box (illustration)
- product-shelving (illustration)
- product-truck (illustration)
- route-map (illustration)

## Icon Usage Rules

### Size and stroke
- Grid: 24 × 24 for icons, stroke weight 1.6, circular endpoints.
- Minimum touch area: 44 × 44, with a legible label.

### Arabic and English
- RTL points right; LTR "Back" points left.
- Do not mirror the plane, truck, or logo automatically.

### Colors and formats
- Base #e sizes at 96 and 192 px, transparent.
- Primary #29378 PNG (color-changeable), SVG, and #ec4f24.

### Existing assets and additions
- extension / navigation additions matching the package; legacy used from the previous Logix design.
- illustration = illustrative graphics extracted from Logix design, not product photos.

### Icons within screens
- Bottom bar uses account, message, orders, and home. Old text symbols like the star, heart, and square are represented by replaceable directional assets.

### Files and documentation
- manifest.json links the name to the category. Keep file names in code. The logo is an independent identity asset, not a transport icon.
