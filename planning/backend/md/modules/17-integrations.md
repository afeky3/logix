# Module 17 — External Integrations

All integrations live in `src/infrastructure/integrations/<name>/`. Each exposes a **port** (TypeScript interface) used by domain modules and one or more **adapters** (real, sandbox, fake). The adapter is selected per environment through config, so domain code never imports vendor SDKs.

Common rules:
- Credentials live only in the secret manager, never in the mobile app (*"Keep credentials server-side, never in the mobile app"*).
- Outbound calls have timeouts (default 10 s), retries with jitter for idempotent operations, circuit breakers (open after 5 consecutive failures, half-open after 60 s), and structured logs without secrets or PII.
- Inbound webhooks are stored raw in `integration_events`, verified, processed asynchronously and are replayable from the dashboard.
- Health is reported to `/admin/system/integrations` (last success, error rate, circuit state).
- Every integration has a manual fallback documented below.

## 1. Payment gateway (D-05)
- **Port:** `PaymentGateway`: `createPayment`, `retrievePayment`, `refund`, `verifyWebhook`, `listSettlements` (for reconciliation), `createApplePaySession?`.
- **Adapters:** `MoyasarAdapter` | `HyperPayAdapter` | `TapAdapter` (pick one), plus `FakeGatewayAdapter` (local/tests, with scripted outcomes: success, 3DS, fail, timeout, duplicate webhook).
- **Fallback:** if the gateway is down, new checkouts are disabled via a kill switch and banner. Pending payments are reconciled when it's back. Refunds are queued.

## 2. SMS (T-04)
- **Port:** `SmsSender`: `send(to, text, { senderId, category })`, `handleDeliveryReport`.
- **Adapters:** primary (e.g. Unifonic/Taqnyat/Msegat) + secondary provider for failover + `ConsoleSmsAdapter` (dev).
- **Rules:** registered sender ID ("Logix"), Arabic/English templates, OTP category prioritized, per-number caps.
- **Fallback:** failover to the secondary provider. If both are down, OTP sign-in shows "try again shortly" (X08), and ops is alerted.

## 3. Push (FCM)
- **Port:** `PushSender`: `sendToTokens`, `sendToTopic` (broadcast).
- **Adapter:** `firebase-admin`. APNs is delivered via FCM.
- **Fallback:** the in-app notification center is always written first, so push is best-effort.

## 4. Email
- **Port:** `EmailSender`, with SES/SendGrid and Mailpit (local) adapters. Templates are bilingual MJML → HTML.

## 5. Maps and geocoding (T-05)
- **Port:** `MapsService`: `geocode`, `reverseGeocode`, `placeAutocomplete` (proxied to protect the key and enforce caps), `routeEstimate(origin, destination)` → distance/duration/polyline.
- **Adapter:** Google Maps Platform (server key). The client map SDK key is restricted by bundle ID and API.
- **Caching:** route estimates for 24 h per rounded origin/destination pair. Autocomplete sessions use session tokens for billing.
- **Fallback:** manual address entry with a pin drop, and the route estimate is hidden ("estimate unavailable").

## 6. National Address (Saudi Post / SPL), Phase 2 optional
- **Port:** `NationalAddressService`: `lookupByShortAddress`, `validate(address)`.
- **Use:** autofill and validate the national address in A05/A06, SH07, TR02 and M07.
- **Fallback:** manual entry. KYB reviewers check the uploaded national address proof.

## 7. Wathq (commercial registration), Phase 4 optional
- **Port:** `CommercialRegistryService`: `getCrInfo(crNumber)` → legal name, status, expiry, activities, owners.
- **Use:** KYB auto-verification (mark the CR item "auto-verified"; mismatches go to a reviewer).
- **Fallback:** manual review of the uploaded CR.

## 8. ZATCA e-invoicing (Fatoora), depends on D-03
- **Port:** `EInvoicingService`: `onboardDevice` (CSID), `clearInvoice` (B2B standard), `reportInvoice` (B2C simplified), `getStatus`.
- **Implementation options:** build it directly (XML UBL 2.1, signing, QR TLV, hash chain) or use a certified e-invoicing middleware provider. A provider is recommended for speed and compliance updates.
- **Data:** stores ZATCA UUID, invoice hash, previous hash, QR payload, clearance status and warnings per invoice.
- **Fallback:** queue and retry. Invoices are not shared as final until cleared (B2B), per regulations.

## 9. Fasah (customs), D-09
Follows the client roadmap:

| Stage | Work | Exit criteria |
|---|---|---|
| 01 Confirm scope | Contracting party, services, data scope, permissions, authorization model; obtain official documentation | Signed scope + technical docs; no endpoint work before this |
| 02 Sandbox testing | Implement `FasahApiAdapter` for declaration status, clearance status, manifest exchange (within approved capabilities) | Sandbox test suite green; credentials server-side only |
| 03 Security and quality review | Permissions, audit logs, duplicate prevention, outage behaviour; review with the relevant party | Written approval (*local tests do not constitute Fasah approval*) |
| 04 Production activation | Production credentials, phased rollout by broker/checkpoint, error monitoring, status source shown to customers | Metrics stable; manual updates remain available |

- **Port:** `CustomsGateway`: `getAuthorizationStatus`, `getDeclarationStatus`, `getManifest`, (future) `submitDeclaration`.
- **Adapters:** `ManualCustomsGateway` (default; reads broker/admin manual entries) → `FasahApiAdapter`.
- **UI contract:** every status carries `source: BROKER | ADMIN | INTEGRATION` + `updatedAt`, so switching adapters needs no app change.

## 10. Insurance partners (D-07), Phase 4
- **Port:** `InsuranceProvider`: `quote`, `bind`, `getPolicy`, `submitClaim`, `getClaimStatus`.
- **Adapters:** `ManualInsuranceProvider` (ops via the dashboard) → partner APIs when contracted and licensed.

## 11. Business finance (D-06), Phase 4
- **Port:** `BusinessFinanceProvider`: `checkEligibility(org)`, `createFinancing(payable)`, `webhook`.
- Hidden behind a feature flag until a partner is contracted.

## 12. Antivirus
- ClamAV daemon (sidecar/service) via `clamd` TCP. Signatures update hourly.
- **Fallback:** if the scanner is unavailable, files stay `PENDING` (not usable) and an alert fires. The system never fails open.

## 13. Telematics / vehicle tracking (Phase 4 candidate)
- **Port:** `TelematicsProvider` for carriers with fleet trackers (or national vehicle tracking platforms, if access is granted), used instead of the driver app GPS. Positions are normalized into `tracking_points` with `source: INTEGRATION`.

## Integration test matrix

| Integration | Contract tests | Failure injection | Sandbox e2e |
|---|---|---|---|
| Payment | ✓ | timeout, 5xx, bad signature, duplicate and out-of-order webhooks | staging |
| SMS | ✓ | provider down → failover | staging (allow-listed numbers) |
| Push | ✓ | invalid token | dev |
| Maps | ✓ | quota exceeded | dev |
| ZATCA | ✓ | rejection with warnings | ZATCA sandbox (developer portal) |
| Fasah | ✓ (after stage 02) | outage | Fasah sandbox |
