# Mobile App — Open Decisions

App-specific decisions. Business and backend decisions are in the [master log](../../backend/md/09-open-decisions.md), and the ones that affect the app are listed at the bottom.

| ID | Decision | Options | Recommendation | Owner | Blocks |
|---|---|---|---|---|---|
| A-D01 | Customer tab bar: 4 tabs (V2) vs 5 tabs (kit, with Marketplace) | 4 / 5 | **5 tabs** (Home, My orders, Marketplace, Messages, Account): the marketplace is one of five services and a "key screen" | Product + Design | Phase 1 |
| A-D02 | Header style: dark navy (V2) vs white with bell (kit) | Dark / White | Decide in final Figma. Components support both via tokens | Design | Phase 0 |
| A-D03 | Single app with driver mode vs separate driver app | Single / Separate | **Single app**: drivers are members of provider orgs, the design shows PT2/PT3 in the same system, and there's one codebase and one store listing. Revisit if driver onboarding friction is high | Product | Phase 2 |
| A-D04 | Digits in Arabic UI | Western (0–9) / Arabic-Indic (٠–٩) | **Western digits**, as in the kit's Arabic UI and common in Saudi B2B apps | Product | Phase 0 |
| A-D05 | Document scanning: native scanner vs camera + manual crop | VisionKit/ML Kit scanner / custom | Native document scanner where available (iOS VisionKit, Android ML Kit Document Scanner), with fallback to camera + K-D03 editor | Tech | Phase 2 |
| A-D06 | Background location library for drivers | expo-location task / commercial SDK | Start with expo-location + task manager. Switch to a commercial SDK if reliability tests fail on Android OEMs | Tech | Phase 2 |
| A-D07 | Payment UI: gateway native SDK vs hosted 3DS page | SDK / WebView | Depends on the gateway (D-05). Prefer the native SDK for Apple Pay and mada UX | Tech | Phase 1 |
| A-D08 | Show illustrative labels ("Illustrative VAT 15%", "Illustrative route") | Keep / Remove at launch | Remove "illustrative" once tax (D-02) and live maps are confirmed. Keep "estimate" wording for ETAs and distances | Product + Legal | Launch |
| A-D09 | Quote comparison: separate compare screen (K-Q02) vs inline | Separate / Inline | Separate compare screen for 2–3 selected quotes, with inline sort tabs on the list | Design | Phase 1 |
| A-D10 | Customer ↔ driver messaging | Direct thread / via order thread | Via the order thread, with the driver as a participant after assignment. No phone numbers exposed (masked calling is Phase 4 if needed) | Product | Phase 2 |
| A-D11 | Biometric app unlock | Yes / No | Optional Phase 2 (quick unlock after OTP login) | Product | Phase 2 |
| A-D12 | Tablet support | Phone-only / adaptive | Phone-only v1 | Product | — |

## Master-log decisions that affect the app
- **D-01/D-14** Cancellation copy and preview (X02/X03).
- **D-02** Quote preview numbers (P03) and VAT labels.
- **D-05** Payment methods and SDK.
- **D-10** Auto-acceptance messaging on RC ("Will be confirmed automatically in 72 hours").
- **D-11/D-21** Return window display (M10) and settlement status (S08).
- **D-13** Service picker copy (Shipping-land vs Transport).
- **D-15** Delivery options at checkout (M07).
- **D-16** Masked contact info in chat and hidden customer identity in P02.
- **D-17** When company customers can pay (verification banner).
- **D-24** Design source of truth (final Figma).
- **D-25** Which services are visible at launch (feature flags on H01 tiles).
- **T-01** Framework.
- **T-05** Maps provider.
- **T-09** Driver GPS frequency.
