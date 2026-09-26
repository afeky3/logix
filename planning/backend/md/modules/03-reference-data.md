# Module 03 — Reference Data

## Purpose
Bilingual, admin-managed lookup data used by forms, matching, pricing and documents. Clients cache it by ETag, so changes don't need a new app release.

## Catalogs

| Catalog | Key fields | Used by |
|---|---|---|
| `countries` | ISO-2, `name_ar`, `name_en`, `phone_code` | Shipping origins/destinations, product origin |
| `regions` / `cities` | Region, city, `geo` (point), `is_active` | Transport, warehousing, marketplace location filter, service areas |
| `ports` | UN/LOCODE (e.g. `CNSHA`, `SAJED`), IATA for airports (`DXB`, `RUH`), `type`: `SEA`/`AIR`/`LAND_BORDER`/`DRY_PORT`, country | SH02, SH04, CU01, CU02, CU04 |
| `customs_checkpoints` | Port link, checkpoint type, supported movements | CU01 checkpoint picker, broker service areas |
| `vehicle_types` | `code`, names, `capacity_ton`, `is_reefer`, `is_car_carrier`, `is_light` | TR01 (dry, reefer, light truck, lowbed, curtain-side, car carrier, flatbed, trailer, other) |
| `container_types` | `20DC`, `40DC`, `40HC`, `20RF`, `40RF`, open-top, flat-rack, `LCL` | SH03 |
| `storage_types` | `DRY`, `CHILLED`, `FROZEN`, `OTHER` | WH01, PW1 |
| `handling_services` | `RECEIVING`, `LOADING`, `UNLOADING`, `SORTING`, `LABELING`, `PALLETIZING`, `OTHER` | WH02 |
| `commodity_categories` | Code, names, `requires_saber?`, `hazardous?` | Commodity pickers (SH03, TR03, WH02) |
| `product_categories` | Tree (equipment, packaging materials, raw materials, building materials…) | Marketplace |
| `units_of_measure` | `PIECE`, `BOX`, `CARTON`, `PALLET`, `KG`, `TON`, `CBM`, `SQM`, `CONTAINER` | Quantities everywhere |
| `document_types` | Code, names, `applies_to` (service/movement/KYB), `required_when` rules, `has_expiry`, `reviewer` (`STAFF`/`BROKER`/`PROVIDER`) | Checklists (A06, SH09, CU03, CU04, PS2) |
| `cancellation_reasons`, `return_reasons`, `issue_types`, `case_types` | Codes + names | X02, M10, PT3, R01 |
| `holidays` | Date, names | Business-day calendar (settlements) |
| `app_config` | Min app version, support phone/WhatsApp, feature flags, upload limits | `GET /app-config` |

`hs_codes`: Phase 1 accepts free text with format validation (6–12 digits). Phase 4 can load the Saudi tariff schedule for autocomplete.

## Document types (initial seed)

| Code | Applies to | Reviewer | Expiry |
|---|---|---|---|
| `COMMERCIAL_REGISTRATION` | KYB | Staff | Yes |
| `VAT_CERTIFICATE` | KYB | Staff | No |
| `NATIONAL_ADDRESS` | KYB | Staff | No |
| `BANK_PROOF` (IBAN letter) | KYB | Staff | No |
| `TGA_LICENSE` | KYB (transport) | Staff | Yes |
| `CUSTOMS_BROKER_LICENSE` | KYB (customs) | Staff | Yes |
| `INSURANCE_POLICY` | KYB, fleet | Staff | Yes |
| `VEHICLE_OPERATING_CARD` | Fleet | Staff | Yes |
| `DRIVER_LICENSE` | Fleet | Staff | Yes |
| `BILL_OF_LADING` | Shipping sea, customs import/transit | Broker/Provider | No |
| `AIR_WAYBILL` | Shipping air/express | Provider | No |
| `COMMERCIAL_INVOICE` | Shipping, customs | Broker | No |
| `PACKING_LIST` | Shipping, customs | Broker | No |
| `CERTIFICATE_OF_ORIGIN` | Customs, shipping (as applicable) | Broker | No |
| `SABER_CERTIFICATE` | Customs import (as applicable to the product) | Broker | No |
| `BOOKING_CONFIRMATION` | Customs export, freight booking | Broker/Provider | No |
| `BORDER_DOCUMENTS` | Land freight / cross-border transport | Provider | No |
| `RELEASE_NOTICE` | Customs completion (POD) | Customer (view) | No |
| `DELIVERY_NOTE` / `POD_PHOTO` / `SIGNATURE` | Completion evidence | — | No |
| `OTHER` (user-named) | Everywhere ("Add and name a document") | Contextual | Optional |

Required-when rules are simple expressions evaluated server-side, for example `service=CUSTOMS && movement in (IMPORT,TRANSIT)` → B/L, commercial invoice and packing list are required, and certificate of origin and SABER are "as applicable" (optional with a hint). *"Final requirements depend on the shipment."* The broker can add requirements per order (CU07 "Add a broker-requested document").

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/reference/{catalog}` | `?q=`, `?type=`, `?country=`; ETag + `Cache-Control: max-age=3600` |
| GET | `/reference/bundle` | All small catalogs in one response for app start (versioned hash) |
| GET | `/app-config` | Unauthenticated; min version, flags, support contacts |
| GET | `/document-requirements` | `?context=ORDER&serviceType=CUSTOMS&movement=IMPORT` → checklist |

Admin: full CRUD under `/admin/reference/{catalog}`, with soft-deactivation (never hard-delete a referenced item), CSV import/export for ports and cities, and an audit log on every change.

## Rules
- Every catalog item has `name_ar` and `name_en`. The API returns both, and clients choose by locale. Search matches both languages with Arabic normalization (alef forms, taa marbuta/haa, yaa/alef maqsura, diacritics removed).
- Deactivated items remain valid on historical records and disappear from pickers.
- The "Other" option exists in every picker the client designs show it for (commodity, vehicle, container, storage type, port), with a free-text field.

## Acceptance criteria
- [ ] The app loads the reference bundle once and revalidates with ETag.
- [ ] Admin edits appear in the app within the cache TTL without a release.
- [ ] Port and city search works in both languages with normalization.
