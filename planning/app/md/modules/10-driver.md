# App Module 10 — Driver Mode (PT2, PT3, driver POD)

Backend: [transport-fleet](../../../backend/md/modules/08-transport-fleet.md). Decision A-D03: driver mode lives inside the single app as the `DRIVER` workspace.

*"Drivers see assigned jobs only; brokers monitor assigned carriers. Customer RC precedes payout."*

## Onboarding
1. The provider invites the driver by phone (G08). The driver receives an SMS: "You've been added as a driver for Al Masar Transport. Download Logix".
2. The driver signs in with OTP (A02/A03) → A04 shows *Driver • Al Masar Transport* → driver home.
3. First-trip permission explainer (G24): why location is needed, when it is collected (only during active trips) and how to stop. Then the OS permission prompts (when-in-use, then background/"always" where required).
4. Drivers cannot create orgs or see prices, customers' payment data, or other jobs.

Tabs: **Jobs · Messages · Account**.

## Driver home / jobs (G23)
- **Current job card:** reference, route (*Riyadh → Jeddah*), next stop, status chip, big primary CTA for the next event ("Start trip to pickup", "Arrived at pickup", …).
- **Upcoming:** assigned jobs with date and time.
- **Done today:** completed jobs.
- Offline banner and pending-sync counter ("3 updates waiting to sync").

## PT2 — Driver assignment (job detail)
*TR-1048 • assigned job only.*
- Map with route and navigation hand-off ("Open in Google Maps / Apple Maps").
- *Pickup — Riyadh • view route* (address, gate, contact: call via masked relay or message the coordinator. No customer phone by default, A-D10).
- *Drop-off — Jeddah • recipient details*.
- *Load — 20 pallets • loading instructions*.
- *Contact — Message order coordinator* (TRIP conversation with the provider).
- **CTA:** `Arrived at pickup` (when heading to pickup) or `Start trip to pickup` if not started.

## PT3 — Loading and trip updates
*Record each operational milestone.*

| Step | Driver input | Evidence |
|---|---|---|
| Start to pickup | Tap | GPS starts |
| Arrived at pickup | Tap (location captured) | — |
| *Inspect & collect — Photos and unit count* | Unit count (numeric), photos (min 2) | Photos with capture time + location |
| *Start journey — Record departure time* | Tap (time defaults to now, editable ±30 min) | — |
| *Border crossing — International trips only* | Border point, documents photos | Required for cross-border before arrival |
| *Operational issue — Delay or access issue with reason* | Type (delay / access / breakdown / other), reason, estimated delay | Optional photo |
| Arrived at drop-off | Tap | — |

- **CTA:** `Update trip` (context label changes to the next event).
- Each event is written to the local outbox with `eventId` + `occurredAt` and synced when online, so events are never lost.
- Undo within 2 minutes for a mistaken tap (sends a correction event). After that, the driver contacts the coordinator.

## Driver POD — Service completion evidence
*Provider submits evidence first.*
- *Service reference — LX-2048*
- *Completion evidence — Photos / release notice / signature*: photos (min 1) + recipient signature on screen (SignaturePad) + recipient name.
- *Recipient & time — Record the actual handover* (auto now).
- *Next stage — Awaiting customer acceptance*.
- **CTA:** `Send evidence to customer` → `POST /driver/jobs/{id}/pod`. On success the job moves to "Done". Offline → queued with a clear "Will send when online" state (photos are uploaded first, then the POD).

## GPS behaviour (T-09, A-D06)
- Active from "Start to pickup" until POD. Stops automatically after POD or if the job is unassigned or cancelled.
- Foreground: a point every 15 s. Background: significant-change / distance filter 100 m, batched uploads every 30–60 s. On low battery (< 15%), the interval is reduced.
- A persistent notification on Android ("Logix is sharing your location for trip TR-1048") is required by the OS and good for transparency.
- If permission is denied: the trip continues with milestones only, and the customer sees "Live location unavailable". The coordinator is notified.
- Mock-location detection (Android): flagged to ops, not blocked.

## Messages
- TRIP conversation with the provider coordinator. The customer can see the driver in the order thread (A-D10) without phone numbers.
- Quick replies: "Arrived", "Stuck in traffic", "At the gate".

## Account (driver)
Profile, language, licence expiry (read-only, managed by the provider), sessions, sign out, help.

## Acceptance criteria
- [ ] A driver only ever sees assigned jobs and no financial data.
- [ ] All events and POD work offline and sync exactly once when back online.
- [ ] Background tracking behaves per platform policy and stops after POD.
- [ ] Cross-border jobs require the border event before arrival.
- [ ] The permission explainer is shown before OS prompts, and store review requirements are met (see [07-quality-release.md](../07-quality-release.md)).
