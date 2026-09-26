# App Module 13 — Shared Tools and System States (X05–X08)

*"These are independent screens, each opened from its own app context."* Backend: [messaging-notifications](../../../backend/md/modules/15-messaging-notifications.md), [auth-identity](../../../backend/md/modules/01-auth-identity.md), [API errors](../../../backend/md/05-api-conventions.md#5-errors).

## X05 — Notifications and messages
*Stay informed within your order.*
- Segmented: **Notifications** | **Messages**.
- Notification items (icon by type, title, body, relative time, unread dot):
  - *New quote — A quote arrived for your shipment*
  - *Document needs correction — Origin certificate • open order*
  - *Execution update — Shipment departed*
  - *Conversation — Message from your provider*
- Tap → deep link (and mark read). "Mark all as read". Filters by workspace when the user has several.
- Messages: the conversations inbox (G15) with context (order ref / product / case), last message, unread count and masked-contact hints.
- **CTA:** `Open notification` (for the selected item).
- Empty state: "You're all caught up".

## X06 — Account and settings
*Your profile and permissions.*
- *Active role — Switch authorized roles* → workspace switcher sheet (G20) listing org + workspace + status.
- *Profile & addresses — Edit saved information* → profile (name, email), addresses (G02), organization profile (G03, business).
- Business items (by workspace): bank accounts (G04), licences and documents (G05), activities and service areas (G06, provider), fleet/drivers/sites (provider), team (Phase 2+).
- *Language — English / Arabic* → restart prompt.
- Notification preferences (G17).
- *Security & privacy — Manage sessions and sign out*: sessions list (device, last active, "this device"), sign out other sessions, sign out, delete account request.
- Terms and privacy (G25: current versions, what you accepted and when).
- Help centre (G18), app version, and "What's new".
- **CTA:** `Save changes` (on edit screens).

## X07 — Action could not be completed
*Example: payment is not confirmed.*
A generic, parameterized error screen/sheet driven by `error.code`:

| Row | Example content |
|---|---|
| Transaction status | *Payment failed or confirmation missing* |
| Safe next action | *Check status before paying again* |
| Expired quote | *Request a fresh quote if needed* |
| Help | *Contact support with transaction reference* (reference copied automatically) |

**CTA:** `Check & retry` → re-fetch the status first (never blindly re-submit).

Error code → X07 variant mapping (initial):

| `error.code` | Title | Primary action |
|---|---|---|
| `PAYMENT_FAILED` / `PAYMENT_PENDING` | Payment not confirmed | Check status → retry payment |
| `QUOTE_EXPIRED` | This offer expired | Request a fresh quote |
| `INVALID_STATE_TRANSITION` | This order changed | Refresh order |
| `VERSION_CONFLICT` | Someone updated this | Reload and review |
| `STOCK_INSUFFICIENT` / `MOQ_NOT_MET` | Quantity unavailable | Adjust quantity |
| `VERIFICATION_REQUIRED` / `WORKSPACE_NOT_ACTIVE` | Verification needed | Open A08 |
| `ACTIVITY_NOT_APPROVED` | Activity not approved | Open activities |
| `MANDATE_NOT_ACTIVE` | Authorization not active | Open CU06 / PC2 |
| `RETURN_WINDOW_CLOSED` | Return window closed | Contact support |
| `UPSTREAM_UNAVAILABLE` | Service temporarily unavailable | Try again later |
| `ACCOUNT_SUSPENDED` | Account suspended | Contact support |
| Unknown | Something went wrong | Try again + support with request ID |

## X08 — Input and connection states
*Alternative states, not sequential steps.*

| State | Behaviour |
|---|---|
| *Expired verification code — Resend after cooldown* | OTP screen shows expiry + countdown to resend |
| *Missing field or invalid file — Inline error; preserve entered data* | Field-level errors from zod/server `details[]`, scroll to the first error, keep all inputs. File errors: type, size > 10 MB, infected/unreadable |
| *No results — Adjust filters or create a request* | Search/lists empty state with "Clear filters" and a contextual CTA (e.g. "Create a transport request") |
| *Offline — Save draft and retry* | Global offline banner, submit buttons show "Saved as draft — will retry", driver outbox counter, automatic retry on reconnect |

**CTA:** `Try again`.

## Other shared states
- **Loading:** skeletons matching the layout (not spinners) for lists and detail screens. Button spinners for mutations.
- **Empty states:** per list with an illustration from the handoff (product-box, product-shelving, product-truck, route-map) and a next-best action.
- **Force update (G19):** blocking screen with the store link. **Maintenance:** from `/app-config.maintenance` with a message and ETA.
- **Permission denied** (camera/location/notifications): explainer + "Open settings".
- **Session expired / revoked elsewhere:** a sheet "You were signed out" → A02.
- **Kill-switched feature:** banner "Temporarily unavailable" on the affected entry points.

## Acceptance criteria
- [ ] Every API error code maps to a defined state (unknown codes fall back safely and are logged).
- [ ] No user input is lost on validation errors, network loss or app restarts during wizards.
- [ ] Notification deep links open the right workspace and screen, including cross-workspace prompts.
- [ ] Sessions management and sign-out work, and language switch persists to the server.
