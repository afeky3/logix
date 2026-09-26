# Module 01 — Auth and Identity

## Purpose
Phone-based sign-in for all app users, sessions and devices, the user profile, and workspace discovery. Staff authentication is included for completeness (used by the dashboard).

## Screens served
App: A02 Sign in, A03 Verify your phone, A04 Your workspace, X06 Account & settings (sessions, language, sign out), X08 (expired code state). Kit: K-A04 Verify identity.
Dashboard: staff login, 2FA setup, staff profile.

## Entities
`User`, `Session`, `OtpChallenge` (Redis + audit row), `StaffUser`, `StaffSession`. See [03-domain-model.md](../03-domain-model.md#2-identity-and-access).

## Flows

### Sign in / sign up (single flow)
```mermaid
sequenceDiagram
  participant App
  participant API
  participant SMS
  App->>API: POST /auth/otp/request {phone, purpose}
  API->>API: normalize E.164 (+9665XXXXXXXX), rate-limit, create challenge
  API->>SMS: send "Your Logix code is 123456" (localized)
  API-->>App: {challengeId, expiresAt, resendAvailableAt}
  App->>API: POST /auth/otp/verify {challengeId, code, device}
  API->>API: verify hash, attempts, TTL; upsert user; create session
  API-->>App: {accessToken, refreshToken, user, isNewUser, workspaces[]}
```

- `isNewUser = true` → the app routes to A04 (choose role), then A05 (create account).
- An existing user with exactly one active workspace goes straight to that workspace's home. A user with several goes to A04.

### Workspaces discovery (A04)
`GET /me/workspaces` returns one entry per (organization, workspace) the user can enter:
```json
[{ "organizationId": "…", "organizationName": "Packaging Factory", "workspace": "SUPPLIER",
   "status": "ACTIVE", "role": "OWNER" },
 { "organizationId": "…", "organizationName": "Ahmed", "workspace": "CUSTOMER", "status": "ACTIVE" },
 { "organizationId": "…", "organizationName": "Al Masar Transport", "workspace": "DRIVER", "status": "ACTIVE" }]
```
A04 also offers "add a role" (customer / seller / provider), which starts organization and workspace creation in module 02.

### Refresh and rotation
`POST /auth/refresh {refreshToken}` issues a new pair. If an old refresh token is reused, the entire session family is revoked and a security notification goes to the user.

### Sign out
`POST /auth/logout` (current session), `DELETE /me/sessions/{id}` (remote), `POST /me/sessions/revoke-others`.

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/otp/request` | `{ phone, purpose: "SIGN_IN" \| "CHANGE_PHONE" }` → 202; same response time whether or not the user exists |
| POST | `/auth/otp/verify` | `{ challengeId, code, device: { id, platform, appVersion, pushToken? } }` |
| POST | `/auth/refresh` | Rotation |
| POST | `/auth/logout` | |
| GET / PATCH | `/me` | `fullName`, `email`, `locale` |
| GET | `/me/workspaces` | See above |
| GET | `/me/sessions` | List with device, last seen, current flag |
| DELETE | `/me/sessions/{id}` | Remote sign-out |
| POST | `/me/phone/change` | Two-step OTP (old + new) |
| POST | `/devices/push-token` | Update the FCM token for the current session |
| DELETE | `/me` | Account deletion request (PDPL). Soft-delete after checks (no open orders or balances) |

Admin (staff):

| Method | Path |
|---|---|
| POST | `/admin/auth/login` (email + password) → `{ mfaRequired, mfaToken }` |
| POST | `/admin/auth/mfa/verify` (TOTP) → tokens (refresh in an HttpOnly cookie) |
| POST | `/admin/auth/mfa/setup`, `/admin/auth/password/reset-request`, `/admin/auth/password/reset` |
| GET | `/admin/me` |

## Business rules
1. Phone numbers must be Saudi mobiles (`+9665XXXXXXXX`) at launch (D-26). Validate with `libphonenumber-js`.
2. OTP: 6 digits, TTL 5 min, resend after 45 s, max 5 sends per hour per phone, max 5 verify attempts. An expired code produces X08 "Expired verification code — resend after cooldown".
3. Test numbers (allow-listed in non-prod) use a fixed code and never hit the SMS provider.
4. The account locale defaults to the device locale at sign-up (`ar` if unsupported), and is changeable in X06. It drives push/SMS/email language.
5. A suspended user gets `403 ACCOUNT_SUSPENDED` with a support contact.
6. Deleting an account is blocked while there are open orders, unsettled balances or open cases. Financial records are retained (legal obligation) but unlinked from personal data where the law allows.

## Events
`user.registered`, `user.signed_in`, `session.revoked`, `user.phone_changed`, `user.deletion_requested`.

## Security
See [06-security-compliance.md §1](../06-security-compliance.md#1-authentication). OTP codes are never logged, and SMS provider responses are stored without the code.

## Acceptance criteria
- [ ] A new user can go from A02 to A04 in under 60 s on a good network.
- [ ] Rate limits and lockouts behave as specified, with correct X08 errors in ar/en.
- [ ] Refresh token reuse revokes the session family.
- [ ] Sessions list and remote sign-out work (X06).
- [ ] Staff login enforces 2FA, and there is no path to admin APIs without it.
