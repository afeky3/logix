# Mobile App — Localization and RTL

## 1. Languages
- **Arabic (`ar`)**: default, RTL. **English (`en`)**: LTR.
- The initial language follows the device language (`ar` if the device isn't Arabic or English). It can be changed in X06 (*Language: English / Arabic*), is stored on the user profile (`locale`) and synced to the server for push/SMS/email.
- Changing language flips layout direction, which in React Native needs `I18nManager.forceRTL()` + a reload. Show a confirmation: "The app will restart to apply the language".

## 2. Message catalogs
- i18next namespaces per feature (`auth`, `shipping`, `orders`…) + `common` + `enums` (shared from `packages/i18n` with the dashboard, for statuses, milestone codes, document types and error codes).
- ICU MessageFormat for plurals and gender. Arabic has 6 plural forms (zero, one, two, few, many, other), e.g. "٣ عروض" vs "عرضان".
- **No string concatenation.** Use interpolation: `t('orders.subtitle', { mode, origin, destination })`.
- Keys are English-semantic (`shipping.cargo.containerType.label`). CI fails on missing `ar` or `en` keys and on unused keys (warning).
- Copy source: the client V2 English strings are the base for `en`. Arabic copy comes from the AR workflows PDF and the kit (the user asked us to read only the EN edition for the transcription; the AR PDF should still be used by the copywriter as the Arabic source).
- Unknown enum values from the API render a generic label (`enums.unknown`) and are logged.

## 3. RTL layout rules
1. Use logical properties only (`paddingStart`, `marginEnd`, `start`, `end`, `textAlign: 'auto'`). A lint rule bans `left`/`right` in styles.
2. Flex rows reverse automatically with `I18nManager`. Don't hand-reverse arrays for layout.
3. **Directional icons:** back uses `back-rtl`/`back-ltr`. Chevrons in list rows point toward the reading end. Progress arrows (the orange flow arrows) follow the reading direction.
4. **Never mirror** brand and vehicle icons (plane, truck, ship, logo), maps, charts' numeric axes, media controls, or phone and IBAN fields.
5. Timelines: the dot column sits on the start side (right in Arabic, left in English), as the kit shows.
6. Swipe gestures (e.g. swipe to delete a cart item) follow direction: the destructive action is revealed from the end side.
7. Mixed content (Arabic text with `LX-260148`, `SAR`, phone numbers, ports like `CNSHA`, HS codes) uses **Unicode bidi isolation** (`⁨…⁩` FSI/PDI) via `ReferenceText`/`MoneyText`, so it isn't reordered (*"Isolate number and code direction"*).
8. Text inputs: codes and IBAN are LTR (`writingDirection: 'ltr'`) even in Arabic. Names and addresses are auto.

## 4. Numbers, currency, dates

| Item | Rule (proposal, D-29 / A-D04) | Example ar | Example en |
|---|---|---|---|
| Digits | Western digits (0–9) in both languages, matching the kit's Arabic UI | 2,760.00 ر.س | 2,760.00 SAR |
| Currency | `ر.س` (ar), `SAR` (en), placed after the amount; 2 decimals in financial breakdowns, 0 decimals in product cards when whole | 12 ر.س | 12 SAR |
| Dates | Gregorian, `dd/MM/yyyy` (as designs: 28/09/2026); relative for recent ("updated 2 minutes ago" / "تحديث منذ دقيقتين") | 14 أكتوبر 2026 | 14 Oct 2026 |
| Time | 24-h in operations ("10:30"), with the locale AM/PM label where the designs show it (09:00 AM / ٠٩:٠٠ ص) | 09:00 ص | 09:00 AM |
| Time zone | All displayed in Asia/Riyadh regardless of device TZ (logistics context) with a "KSA time" hint where ambiguity matters | | |
| Weights / volumes | `kg`, `طن`, `CBM`, `م³` localized units | 18 طن | 18 t |
| Phone | Display `+966 5X XXX XXXX` LTR-isolated | | |
| Hijri | Not shown in v1 (not in designs) | | |

Formatting helpers are shared in `lib/money` and `lib/dates`. Unit tests cover both locales.

## 5. Server-rendered content
- Push, SMS, email, invoices and statements are rendered by the backend in the user's locale.
- Reference data comes with `name_ar`/`name_en`, and the app selects by current locale.
- User-generated content (product names, notes, chat) is shown as entered. `textAlign: 'auto'` detects direction per paragraph.

## 6. QA checklist (per screen)
- [ ] Renders correctly in both directions: alignment, icons, chevrons, timelines, stepper direction.
- [ ] Long German-length English and long Arabic strings don't truncate CTAs (test with pseudo-localization, +40% length).
- [ ] Mixed-direction strings (references, money, codes) display in the correct order.
- [ ] Plurals are correct in Arabic for 0, 1, 2, 3–10, 11–99 and 100+.
- [ ] Keyboard types: numeric for quantities, phone pad for phones, and email for email.
- [ ] Screen reader (VoiceOver/TalkBack) reads Arabic labels, and the reading order follows the visual order.
