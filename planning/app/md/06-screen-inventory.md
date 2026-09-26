# Mobile App — Screen Inventory

All 110 V2 screens (canonical IDs), the kit screens that add functionality (`K-` IDs), and gap screens the designs don't cover. **WS** = workspace (C customer, S supplier, P provider, D driver, All). The API column lists the main endpoint(s). Full contracts are in the backend module docs.

## 1. V2 screens (110)

### Access and onboarding (8): [modules/01](modules/01-access-onboarding.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| A01 | Welcome to Logix | All | `GET /app-config` |
| A02 | Sign in | All | `POST /auth/otp/request` |
| A03 | Verify your phone | All | `POST /auth/otp/verify` |
| A04 | Your workspace | All | `GET /me/workspaces`, `POST /organizations` |
| A05 | Create an account | All | `POST /organizations`, `PUT …/business-profile`, addresses |
| A06 | Business verification | S/P/C-company | licences, bank accounts, `GET /document-requirements` |
| A07 | Terms and consent | All | `GET /terms/current`, `POST /consents` |
| A08 | Verification status | S/P/C-company | `GET /organizations/{id}/verification`, `…/submit` |

### Customer core (1 + shared 2): [modules/02](modules/02-customer-home-orders-completion.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| H01 | Home (Good morning, Ahmed) | C | `GET /orders/feed?limit=3`, drafts, `GET /me` |
| RC | Confirm receipt | C | `POST /orders/{id}/receipt-confirmation`, `POST /purchase-orders/{id}/receipt-confirmation` |
| DONE | Service completed | C | `POST /orders/{id}/rating`, `GET /orders/{id}/invoice`, `POST /service-requests/{id}/duplicate` |

### Shipping (13): [modules/03](modules/03-shipping.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| SH01 | How are you shipping? | C | `POST /service-requests`, `PATCH ?step=mode` |
| SH02 | Origin and destination | C | `PATCH ?step=route`, `GET /reference/ports` |
| SH03 | Sea freight cargo | C | `PATCH ?step=cargo` |
| SH04 | Air or express cargo | C | `PATCH ?step=cargo` |
| SH05 | International land freight | C | `PATCH ?step=cargo` |
| SH06 | Additional services | C | `PATCH ?step=services` |
| SH07 | Door-to-door details | C | `PATCH ?step=door_to_door`, addresses |
| SHR | Review shipping request | C | `GET /service-requests/{id}`, `POST …/submit` |
| SHQ | Available quotes | C | `GET /service-requests/{id}/quotes?sort=` |
| SHP | Accept quote and pay | C | `POST /quotes/{id}/accept`, `GET /payment-intents/{id}` |
| SHF | Order follow-up | C | `GET /orders/{id}` |
| SH08 | Shipment journey | C | `GET /orders/{id}/timeline` |
| SH09 | Shipment documents | C | `GET/POST /orders/{id}/documents` |

### Transport (10): [modules/04](modules/04-transport.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| TR01 | New transport request | C | `POST /service-requests`, `?step=scope_vehicle` |
| TR02 | Pickup and drop-off | C | `?step=locations`, maps autocomplete |
| TR03 | Load details | C | `?step=load` |
| TR04 | Car carrier request | C | `?step=car_carrier` |
| TRR | Review transport request | C | `…/submit` |
| TRQ | Available quotes | C | quotes |
| TRP | Accept quote and pay | C | accept + payment |
| TRF | Order follow-up | C | `GET /orders/{id}` |
| TR05 | Your vehicle is on the way | C | `GET /orders/{id}/tracking` + realtime |
| TR06 | Trip progress | C | `GET /orders/{id}/timeline` |

### Warehousing (11): [modules/05](modules/05-warehousing.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| WH01 | Book warehouse space | C | `?step=space` |
| WH02 | Goods and handling | C | `?step=goods` |
| WHR | Review warehousing request | C | `…/submit` |
| WHQ | Available quotes | C | quotes |
| WHP | Accept quote and pay | C | accept + payment |
| WHF | Order follow-up | C | `GET /orders/{id}` |
| WH03 | Warehouse intake booking | C | `GET /orders/{id}/intake-slots`, `…/confirm` |
| WH04 | Your stored inventory | C | `GET /orders/{id}/inventory` |
| WH05 | Request stock release | C | `POST /orders/{id}/release-requests` |
| WH06 | Release progress | C | `GET /release-requests/{id}` |
| WH07 | Storage reconciliation | C | `GET /orders/{id}/reconciliation`, `…/accept` |

### Customs (13): [modules/06](modules/06-customs.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| CU01 | Customs clearance request | C | `?step=movement` |
| CU02 | Import and transit details | C | `?step=details` |
| CU03 | Import / transit documents | C | documents on the request |
| CU04 | Export documents | C | documents on the request |
| CUR | Review customs clearance request | C | `…/submit` |
| CUQ | Available quotes | C | quotes |
| CUP | Accept quote and pay | C | accept + payment |
| CUF | Order follow-up | C | `GET /orders/{id}` |
| CU05 | Create broker authorization | C | `POST /orders/{id}/broker-authorizations` |
| CU06 | Authorization status | C | `GET …/broker-authorizations/current`, `…/refresh` |
| CU07 | Document review | C | `GET /orders/{id}/documents` (broker decisions) |
| CU08 | Clearance progress | C | `GET /orders/{id}/customs` |
| CU09 | Customs released | C | `POST /orders/{id}/confirm-clearance`, linked transport |

### Marketplace, buyer (11): [modules/07](modules/07-marketplace-buyer.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| M01 | Business marketplace | C | `GET /marketplace/products`, categories |
| M02 | Search results (filters) | C | `GET /marketplace/products?filters` |
| M03 | Product details | C | `GET /marketplace/products/{id}` |
| M04 | Supplier profile | C | `GET /marketplace/suppliers/{orgId}` |
| M05 | Supplier conversation | C | `POST /conversations` (PRODUCT_INQUIRY) |
| M06 | Your cart | C | `GET /cart`, cart items |
| M07 | Delivery and payment | C | `POST /checkout/quote`, `POST /checkout` |
| M08 | Purchase confirmed | C | `GET /purchase-orders/{id}` |
| M09 | Purchase tracking | C | `GET /purchase-orders/{id}` |
| M10 | Return or replacement | C | `POST /purchase-orders/{id}/returns` |
| M11 | Return tracking | C | `GET /returns/{id}` |

### Supplier (10): [modules/08](modules/08-supplier.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| S01 | Supplier dashboard | S | `GET /supplier/dashboard` |
| S02 | Photos and product details | S | `POST/PATCH /supplier/products` |
| S03 | Pricing and inventory | S | `PATCH /supplier/products/{id}` |
| S04 | Preview and publish | S | `POST /supplier/products/{id}/publish` |
| S05 | New purchase order | S | `POST /supplier/purchase-orders/{id}/accept` |
| S06 | Shipment readiness | S | `POST …/readiness` |
| S07 | Handover to carrier | S | `POST …/handover` |
| S08 | Sales settlement | S | `GET /supplier/settlements/{id}` |
| SR1 | Review return request | S | `POST /supplier/returns/{id}/decision` |
| SR2 | Resolve return | S | `POST /supplier/returns/{id}/resolve` |

### Provider (19): [modules/09](modules/09-provider.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| P01 | Provider opportunities | P | `GET /provider/opportunities`, `/provider/dashboard` |
| P02 | Service request details | P | `GET /provider/opportunities/{requestId}`, questions |
| P03 | Prepare a quote | P | `POST /provider/quotes/preview`, `POST /provider/quotes` |
| P04 | Your quote is accepted | P | `GET /provider/orders/{id}`, `…/confirm-readiness` |
| PS1 | Book freight capacity | P | `PUT /provider/orders/{id}/freight-booking` |
| PS2 | Execution documents | P | `PUT …/freight-references`, documents |
| PS3 | Update shipment milestones | P | `POST /provider/orders/{id}/milestones` |
| PT1 | Assign vehicle and driver | P | `POST /provider/orders/{id}/assignment` |
| PT2 | Driver assignment | D | `GET /driver/jobs/{id}` |
| PT3 | Loading and trip updates | D | `POST /driver/jobs/{id}/events`, `/issues` |
| PW1 | Capacity and intake slots | P | `POST /provider/orders/{id}/intake-slots` |
| PW2 | Receive and count goods | P | `POST /provider/orders/{id}/stock-intake` |
| PW3 | Stock and release management | P | release request actions |
| PC1 | Review customs file | P | `GET /provider/orders/{id}/customs-file`, doc review |
| PC2 | Check broker authorization | P | `PATCH /provider/broker-authorizations/{id}` |
| PC3 | Declaration execution | P | `PUT /provider/orders/{id}/declaration` |
| POD | Service completion evidence | P/D | `POST …/completion-evidence` / `POST /driver/jobs/{id}/pod` |
| PAY1 | Provider settlement | P | `GET /provider/settlements` |
| PAY2 | Payout completed | P | `GET /provider/payouts/{id}` |

### Insurance (4): [modules/11](modules/11-insurance.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| IN1 | Cargo insurance providers | C | `GET /insurance/insurers` |
| IN2 | Coverage details | C | `POST /insurance/requests` |
| IN3 | Insurance request and policy | C | `GET /insurance/requests/{id}` |
| IN4 | Insurance claim request | C | `POST /insurance/claims` |

### Cancellation and shared (8): [modules/12](modules/12-cancellation-support.md), [modules/13](modules/13-shared-system-states.md)
| ID | Screen | WS | Main API |
|---|---|---|---|
| X01 | My orders | C | `GET /orders/feed` |
| X02 | Cancel service | C | `GET /orders/{id}/cancellation-preview`, `POST …/cancellation-requests` |
| X03 | Cancellation under review | C | `GET /cancellation-requests/{id}` |
| X04 | Refund and support | C | `GET /cases/{id}`, conversation |
| X05 | Notifications and messages | All | `GET /notifications`, `GET /conversations` |
| X06 | Account and settings | All | `/me`, `/me/sessions`, workspaces |
| X07 | Action could not be completed | All | error-driven |
| X08 | Input and connection states | All | error-driven |

**Count:** 8 + 3 + 13 + 10 + 11 + 13 + 11 + 10 + 19 + 4 + 8 = **110** ✔

## 2. Kit screens that add functionality (implement as variants or additional screens)

| Kit ID | Screen | Implemented as |
|---|---|---|
| K-H01 | Buyer home with hero + stats | H01 variant (stats tiles, hero CTA, recent activity) |
| K-H02 | Choose a service | H01 service tiles / service picker sheet |
| K-L01–K-L04 | Transport wizard (route, vehicle & cargo, schedule & extras, review) | TR01–TR04/TRR (merge: segmented vehicle picker, temperature, schedule, extras) |
| K-Q01 | Receive offers (sort tabs) | SHQ/TRQ/WHQ/CUQ |
| **K-Q02** | **Compare offers table** | New shared screen `QuoteCompare` |
| **K-Q03** | **Offer details breakdown** | New shared screen `QuoteDetail` |
| K-B01 | Review booking & pay | SHP/TRP/WHP/CUP |
| **K-B02** | **Payment method selection** | New shared step `PaymentMethod` |
| K-B03 | Booking confirmed | Shared `PaymentSuccess` → follow-up |
| K-B05 / K-E04 | Payment failed / expired quote | X07 variants |
| K-O02 | Order details with actions | SHF/TRF/WHF/CUF |
| K-T01 | Track shipment (map + timeline) | TR05/TR06/SH08 |
| K-T02 / K-T03 | Confirm receipt / complete & rate | RC / DONE |
| **K-T04** | **Invoice view** | New shared screen `InvoiceView` |
| **K-R01 / K-R02** | **Report issue (damage/shortage) / follow the claim** | New shared screens `IssueReport` / `CaseDetail` |
| K-F01–K-F07 | International freight branch | SH01–SH07 |
| K-D01, K-D02, K-D04 | Customs request, document vault, progress | CU01–CU04, CU07, CU08 |
| **K-D03** | **Correct a document (crop/rotate/enhance)** | New shared screen `DocumentCorrection` |
| K-W01–K-W02 | Storage | WH01, WH02/WHR |
| K-M01–K-M06 | Marketplace | M01, M03, M06, M07, M08, M09 |
| K-M07–K-M08 | Supplier comparison and profiles | M04 + compare list (Phase 3+) |
| K-S01–K-S07 | Supplier | S01–S08 (+ K-S02 inventory list with status chips, **K-S07 consent** inside A07) |
| K-P01–K-P04 | Provider registration | A05–A08 (provider variant) |
| K-P05 | Operations home (tiles) | P01 |
| K-P06–K-P08 | Available requests / assess / prepare quote | P01–P03 |
| **K-P08B** | **Offers submitted list** | New provider screen `MyQuotes` |
| K-P09 | Execute the shipment | PT1/PS3 |
| K-P11 | Provider settlement | PAY1 |

## 3. Kit ↔ V2 ID collisions (do not reuse)
`M02–M08`, `S02–S07`, `P01–P04`, `A02/A04` mean different screens in the two PDFs. Code, analytics and tickets must use V2 IDs, and kit references always carry the `K-` prefix.

## 4. Gap screens (not in the client designs; need design)

| # | Screen | WS | Why |
|---|---|---|---|
| G01 | Drafts list / continue request | C | Drafts are saved per step |
| G02 | Addresses list + add/edit (national address + map pin) | C/S | Used in SH07, TR02, M07 |
| G03 | Organization profile + legal details | S/P/C-company | X06 "Profile & addresses" |
| G04 | Bank accounts | S/P | Payout account management and change hold |
| G05 | Licences and documents (expiry, renew) | S/P | Expiry reminders |
| G06 | Provider activities and service areas | P | Needed for matching |
| G07 | Fleet: vehicles list + add vehicle | P (carrier) | PT1 needs vehicles |
| G08 | Drivers list + invite driver | P (carrier) | PT1 needs drivers |
| G09 | Warehouse sites | P (warehouse) | PW1 needs sites |
| G10 | Provider active jobs list ("Operations") | P | Tab content |
| G11 | Supplier products list (search, filter chips) | S | K-S02 exists visually. Needs spec |
| G12 | Supplier PO list (new / preparing / completed) | S | K-S04 exists visually |
| G13 | Receivables and settlements list | S/P | Tab content |
| G14 | Favorites | C | Heart on product cards |
| G15 | Conversations inbox | All | Messages tab |
| G16 | Case detail + case list | All | X04, K-R02 |
| G17 | Notification preferences | All | X06 |
| G18 | Help centre / contact support | All | X07 "Contact support" |
| G19 | Force update / maintenance screen | All | App config |
| G20 | Workspace switcher sheet | All | X06 "Switch authorized roles" |
| G21 | Additional charge approval | C | "No unapproved charges" |
| G22 | Linked request prompt (customs/transport/insurance) | C | SH06, CU09, WH03 |
| G23 | Driver home / job list | D | Only PT2/PT3 exist |
| G24 | Location permission explainer | D | Background tracking |
| G25 | Terms full-text reader + version history | All | "Read full terms before accepting" |
