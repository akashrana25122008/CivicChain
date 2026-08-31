# CivicChain — Feature Status Audit

Phase 0 freeze & audit. Generated from direct source inspection
(`src/`), commit `994259a` (tag `working-ui-baseline`, branch `working-ui-baseline`).

## Status Legend

| Status   | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| WORKING  | Connected to a real source and actually performs its operation |
| PARTIAL  | Exists but incomplete or partially mocked                      |
| MOCK     | Visually works; underlying business data/result is simulated   |
| MISSING  | Expected capability does not currently exist                   |
| UNKNOWN  | Source inspection insufficient to determine status             |

## Phase 12 Update (this revision — Real-Time Civic Map)

The civic map now renders **real located reports** end-to-end, and the last
hardcoded map surfaces were removed.

- **Civic Map workspace (`/map`)** — PARTIAL → **WORKING** (already real) plus a
  new **density heatmap layer**: a Maplibre `heatmap` layer over the same
  `/api/map` located issues, toggled against the status markers with a
  Markers↔Heatmap control and a shared GeoJSON source synced to the points.
  (`src/components/map/CivicMapInner.tsx`, `CivicMap.tsx`.)
- **Public landing map (`CivicIntelligenceMapSection`)** — MOCK → **WORKING**.
  The section now pulls real located issues + aggregate counts from the new
  anonymous, read-only **`GET /api/map/public`** (bounded, sanitized — no
  personal data: publicId/title/category/status/coordinates/timestamps). The
  "LIVE ISSUES" list, the selectable detail panel, and the animated stat cards
  (active / in-progress / resolved / located) are all real. The
  `PROTOTYPE DATA — NOT REAL-TIME MONITORING` footer disclaimer was replaced
  with `LIVE DATA — LOCATED REPORTS FROM THE CIVICCHAIN DATABASE`.
- **3D Civic Globe (`src/components/3d/CivicGlobe.tsx`)** — the hardcoded
  `MOCK_ISSUES` array (fabricated Mumbai markers) is **removed**. The globe is
  now fully data-driven: it accepts an `issues` prop (via the new
  `toIssueMarker()` adapter from the `/api/map/public` shape) and renders empty
  by default — no fabricated incidents remain.
- **Summary table updates** — `Live incident map data` MOCK → **WORKING**;
  `Heatmaps` MISSING → **PARTIAL** (density layer present; severity/priority-
  weighted + H3 tile layers still future).

Verification: `tsc --noEmit` clean; eslint clean; `next build` exit 0 (58
pages incl. `/api/map/public`); 62/62 unit tests pass; live Postgres smoke test
(27 located issues, real status distribution + centroid).

## Phase 13 Update (this revision — Event-Driven, Multi-Channel Notifications)

The notification system is now a single, event-driven, channel-aware dispatcher
rather than a bare in-app insert. In-app delivery is fully real and DB-backed;
email is real (delivered when SMTP is configured, and honestly non-delivered
otherwise); push is recorded but honestly flagged UNSUPPORTED (no provider).

- **In-app notifications** — PARTIAL → **WORKING**. `notifyUser()` is the one
  entry point: it resolves the recipient's persisted preferences, and for each
  enabled requested channel either persists the in-app `Notification` row
  (`IN_APP`), attempts email delivery (`EMAIL`), or records an honest
  UNSUPPORTED push result (`PUSH`). All existing event sources (status
  transitions, resolution, escalation engine, SLA/promise formation, evidence,
  department actions, community votes) already route through it, so they gained
  multi-channel behaviour without changing their call sites.
- **Notification preferences** — MISSING → **WORKING**. New
  `NotificationPreference` model (unique per `(userId, channel)`, default-on)
  with `GET/PUT /api/notifications/preferences`. The Settings → Notifications
  card is now a **real, persisted** panel (in-app / email / push toggles) —
  previously it was static mock toggles. Prefs are always keyed off the session
  user, never the browser.
- **Idempotency** — new `Notification.dedupeKey` (unique) lets a retried event
  or race never double-notify. Status-change and community-vote notifications
  carry stable keys; re-casts/votes return the existing record.
- **Rich, actionable links** — new `Notification.link` deep-link column
  (e.g. `/dashboard/issues/:id`), surfaced in both the feed and the new header
  bell dropdown.
- **Email delivery** — MISSING → **PARTIAL/WORKING**. `src/lib/email/notification.ts`
  reuses the honest SMTP policy: real nodemailer delivery when `EMAIL_SERVER` is
  set; a dev-preview console log without it; and a loud failure in production so
  delivery is never faked.
- **Header bell dropdown** — new `NotificationBell` component (recent
  notifications, unread badge, one-click mark-all-read, "view all" footer)
  replaces the previous plain bell link. The full feed now marks-all-read via a
  single atomic `POST /api/notifications/read-all` instead of an N-request
  client fan-out.
- **Community event wiring** — casting a vote now notifies the issue's reporter
  (and the assigned authority) via the dispatcher, so citizens and departments
  are both kept in the loop on social signals.

Verification: `tsc --noEmit` clean; eslint clean for all new/changed files (only
pre-existing lint warnings/errors remain in untouched baseline files); `next build`
exit 0 (both new routes `/api/notifications/{read-all,preferences}` included);
67/67 unit tests pass; live Postgres smoke test of `notifyUser` (persist,
`dedupeKey` idempotency, IN_APP preference gating, email channel honest
non-delivery, cleanup).

## Phase 14 Update (this revision — Settings Actually Working)

The Settings page is no longer static mock inputs. Profile identity and user
preferences are now real, persisted, and — for the theme — actually applied at
runtime via a class-based dark mode.

- **Persisted user preferences** — MISSING → **WORKING**. New `UserPreferences`
  model (one row per user, unique on `userId`, cascade-deleted) with
  `GET/PATCH /api/me/preferences`. Fields: `theme` (LIGHT/DARK/SYSTEM),
  `language`, `weeklyDigest`, `reportUpdates`. GET always returns a fully-resolved
  view (defaults when no row exists); PATCH validates every value server-side and
  **rejects unknown keys** — values are never trusted from the browser for
  another user.
- **Theme actually works (class-based dark mode)** — the app previously relied
  purely on `prefers-color-scheme`. Now a `@custom-variant dark` enables a real
  `.dark` class toggle; a `ThemeProvider` (with an inline pre-paint script in
  `layout.tsx` reading the `cc-theme` cookie) applies the persisted preference
  with no flash of wrong theme, follows the OS when `SYSTEM`, and the Settings →
  Preferences segmented Light/Dark/System control switches it instantly.
- **Profile** — MOCK → **WORKING**. New `GET/PATCH /api/me/profile`: the full
  name is editable and persisted to the `User` record (trimmed, length-capped);
  email and role are read-only (identity/privilege attributes, not self-service
  editable). The previous fake `defaultValue` inputs and role selector are gone.
- **Language** persisted — `language` is stored per user and returned with a
  curated list on the Settings → Preferences panel.
- **Notification integration** — the Phase 13 `NotificationPreferencesPanel`
  remains the real, persisted channel toggles on the Settings → Notifications
  card; the new digest/report-updates flags live alongside it. No channel prefs
  were disrupted.
- New pure, unit-tested helpers in `src/lib/server/preferences.ts` and
  `src/lib/server/profile.ts` (default resolution, patch validation, unknown-key
  rejection, name trimming/capping).

Verification: `tsc --noEmit` clean; eslint clean (0 errors/warnings) for all new
and changed files; `next build` exit 0 (new routes
`/api/me/{preferences,profile}` included); 77/77 unit tests pass (67 baseline +
10 new); live Postgres smoke test of `UserPreferences` upsert→update→read and
missing-row default behaviour.

## Summary

| WORKING | PARTIAL | MOCK | MISSING | UNKNOWN |
| ------: | ------: | ---: | ------: | ------: |
|      22 |      11 |    8 |       6 |       0 |

## Phase 3/4 Update (this revision — Real AI Analysis + Duplicate Detection + Priority Engine)

Server-side intelligence is now real and database-backed. No AI result is
simulated anywhere: when no `AI_API_KEY`/`AI_BASE_URL` is configured the
analysis pipeline records an honest `FAILED` verdict (with an explanatory
message) and the report remains fully visible — the exact same path the app
would take on a real model outage.

- **AI issue classification** — MOCK → **WORKING** (real OpenAI-compatible
  chat-completions client; classification persisted to the `AIAnalysis` table
  with `PENDING/PROCESSING/COMPLETED/FAILED` lifecycle; category mapped back to
  the existing `IssueCategory` so routing/filters stay coherent).
- **AI severity detection** — MOCK → **WORKING** (severity + safety risk +
  infrastructure type + confidence produced by the same real pipeline and
  shown in the UI with model name + reasoning summary).
- **Duplicate detection / report merging** — PARTIAL → **WORKING** (five real
  signals — PostGIS geographic distance, trigram text similarity, perceptual
  dHash image similarity, report timing recency, category match — combined into
  a 0–1 confidence; `possible` warns without merging, `strong` groups reports
  into an `Incident` with a `CC-INC-*` public id; the synchronous 60 s
  same-reporter window guard is unchanged).
- **Priority score & labels** — PARTIAL → **WORKING** (spec formula computed
  server-side into a normalized 0–100 score + `LOW/MEDIUM/HIGH/CRITICAL` level;
  population impact and location criticality are scored neutral 50 and flagged
  `unavailable` when the system has no data — never invented; evidence
  confidence uses a real rubric over attachments).
- **AI verification meters (issue detail page)** — the hardcoded meter
  constants were replaced with real duplicate/incident + AI state cards
  (classification card shows severity/safety/infrastructure/confidence/reasoning
  and the honest `FAILED`/`PENDING` states when relevant).
- **Background processing** — MISSING → **PARTIAL** (no queue infra; the
  pipeline runs via `after()` from `next/server` after the response plus a
  resume-on-read guard, so analysis always reaches a terminal state even if the
  process dies mid-run).
- **Report / incident counts** — issue detail and lists now reflect real
  incident membership (`Incident.issues`), replacing the "merged reports" count.
- Report result page shows **Similar Issue Found** (strong/possible bands) with
  a "view existing report" link and a keep-my-report path that never blocks.

Still MOCK / MISSING (unchanged, future phases): verification CV meters,
hotspot/risk engine (spatial clustering), live incident map markers, promise
SLA engine + deadlines, escalation engine, community votes, settings
persistence, broken-promise showcase, civic karma, real-time/websockets,
email/push notifications, a real queue/worker (current after-response pipeline
is dependency-light by design).

## Phase 2/3 Update (this revision — Canonical API + Lifecycle State Machine)

The lifecycle status is now governed by a single server-side authority rather
than arbitrary client-driven PATCHes:

- **Central transition state machine** — MISSING → **WORKING** (`src/lib/issues/transition.ts`).
  `transitionIssue()` is the ONE place that may mutate `Issue.status`. Every
  HTTP surface — `PATCH /api/issues/[id]` and the deprecated `PATCH /api/reports/[id]`
  adapter — delegates here. The transition graph (`ISSUE_TRANSITIONS`) rejects
  arbitrary jumps (e.g. `SUBMITTED → RESOLVED`) with a `400 INVALID_TRANSITION`,
  and RBAC is enforced inside the same call: only an ADMIN, or the AUTHORITY of
  the issue's department, may transition; citizens are always read-only. Each
  accepted transition is written atomically with an audit entry and a reporter
  notification (`STATUS_CHANGED`).
- **Canonical `/api/issues` resource** — `POST /api/issues`, `GET /api/issues`,
  `GET /api/issues/[id]`, `PATCH /api/issues/[id]` are the canonical API. All
  handlers share one implementation (`src/lib/issues/http.ts`). `/api/reports`
  and `/api/reports/[id]` are preserved as deprecated compatibility adapters
  that call the exact same code; internal frontend consumers have been moved to
  `/api/issues`, and `/api/reports` carries no domain logic.
- **Allowed-transitions surfaced to the UI** — `GET /api/issues/[id]` and the
  department detail surface now return `IssueDetail.allowedTransitions` (empty
  for citizens / unauthorized staff). `IssueDrawer` renders only those legal
  next transitions, so the client can no longer request an invalid jump.

### Canonical domain-action endpoints (this revision)

Lifecycle changes are also exposed as explicit, intent-named endpoints under
`/api/issues/[id]/` (each delegates to `actions.ts`, which uses the same single
`transitionIssue()` authority — there is exactly one way to mutate status):

- `POST /api/issues/[id]/resolve` — staff resolve (`IN_PROGRESS/ASSIGNED/VERIFIED` → `RESOLVED`; idempotent).
- `POST /api/issues/[id]/reopen` — reopen `RESOLVED` (→ `IN_PROGRESS`) or `REJECTED` (→ `UNDER_REVIEW`); owner or staff.
- `POST /api/issues/[id]/verify` — reporter confirmation: `VERIFIED` closes, `DISPUTED` reopens.
- `POST /api/issues/[id]/analyze` — triggers the existing intelligence pipeline (no fake results).
- `POST /api/issues/[id]/evidence` / `GET` — add / list evidence via the shared file-validator.
- `POST /api/issues/[id]/escalate` — raise `Escalation` (level = max+1; rejected while an open escalation exists).

`PATCH /api/issues/[id]` remains available but is NOT an arbitrary-status escape
hatch: any `status` value is still validated against the transition graph inside
`transitionIssue()` — invalid jumps such as `PATCH {status:"RESOLVED"}` on a
`SUBMITTED` issue return `400 INVALID_TRANSITION`.

### State-machine test suite (this revision)

Pure transition-graph invariants are covered by `node:test` (run via
`npm test`, tsx loader, no external test framework): valid/invalid transitions,
no self-loops, every status has an out-edge, every out-edge names an enum state,
rejection always available, reopen policies. This automates the "block arbitrary
status PATCH" requirement at the graph level. Actor/RBAC integration tests
(department authority, admin, citizen) are DB-backed and are deferred to a
provisioned test database — they are not fabricated.

## Phase 4-10 (Status update — this revision)

### IMPLEMENTED (real, DB-backed, tested)

- **Phase 4 — Real intelligence pipeline.** Reuses existing real, DB-backed
  intelligence: image perceptual hashing (`imageHash`), AI analysis +
  classification + confidence + explanation (`intelligence/ai`), duplicate +
  incident clustering (`intelligence/duplicates`), and an explainable priority
  engine (`intelligence/priority`). Orchestrated by
   `runReportIntelligence()` and exposed via `POST /api/issues/[id]/analyze`.
   No fake scores — unavailable inputs are flagged, not invented.
- **Phase 6 — Promise/SLA engine (real deadlines + state, minus the scheduler)**
  (`src/lib/sla/`). Centralized policy (`policy.ts`) maps severity → real
  acknowledgement/resolution windows (env-overridable). Deterministic state
  calculator (`state.ts`) yields `ON_TRACK / AT_RISK / BREACHED / RESOLVED` —
  separate from Issue lifecycle. Idempotent Promise formation + reconciliation
  (`promise.ts`) is wired into issue creation, AI authority routing, resolution
  (→COMPLETED), and reopen; `Promise` rows persist real deadlines and the
  department summary exposes live SLA health (onTrack/atRisk/breached). Only the
  periodic SLA scheduler/worker needs Redis (Phase 5).

- **Phase 7 — Automated escalation engine** (`src/lib/escalation/`).
  - Canonical 4-level ladder (`levels.ts`, shared constant, not scattered strings).
  - Configurable, DB-backed `EscalationRule` model with a condition bag
    (`slaPctGte`, `statusNotIn`) plus severity/priority gates.
  - Pure, unit-tested rule evaluator (`rules.ts`) + idempotent DB engine
    (`engine.ts`): never re-escalates a level already reached, transactional
    audit + notification on creation. Wired into citizen dispute (`reopenIssue`)
    so a dispute triggers evaluation. (Automatic *periodic* evaluation awaits
    the SLA worker / Redis — see blockers.)
- **Phase 10 — Community votes + civic karma** (`src/lib/community/`).
  - `Vote` model (CONFIRM / DISPUTE / SUPPORT / DUPLICATE) with a
    `unique(issueId, userId, type)` constraint — duplicate votes impossible
    even under a race; idempotent re-casts return the existing vote.
  - `POST/GET /api/issues/[id]/votes` canonical endpoints with a dedicated
    `voting` rate limiter (anti-brigade).
  - `KarmaEvent` auditable ledger + `applyKarmaEvent()` (idempotent via unique
    `dedupeKey`, so retried events never double-award) + `calculateKarma()`.
    Karma is derived only from trusted system events; clients can never set
    `User.karmaScore` directly.

### BLOCKED / REQUIRES EXTERNAL INFRASTRUCTURE (never faked)

- **Phase 5 — Redis + BullMQ workers.** No `redis-server`, no Docker, no
  `bullmq` package in this environment. The pipeline therefore still runs via
  next/server `after()` + resume-on-read (`ensureReportIntelligence`), which is
  explicitly NOT the production primary. AI/Duplicate/Priority/Notification/SLA/
  Verification/Analytics workers, retry policy, dead-letter queue all require
  Redis — documented, not fabricated.
- **Phase 6 — SLA/Promise engine (COMPUTED, missing only the scheduler).**
  The SLA engine itself is now real: `src/lib/sla/` provides a centralized
  policy (`policy.ts`), a deterministic state calculator producing
  `ON_TRACK / AT_RISK / BREACHED / RESOLVED` (`state.ts`), and an idempotent
  Promise formation + lifecycle reconciliation service (`promise.ts`) wired
  into issue creation, AI authority-routing, resolution, and reopen.
  `Promise` rows are created with real deadlines from SLA policy; persisted
  `PromiseStatus` is kept in step (OPEN→IN_PROGRESS/COMPLETED/BROKEN); real
  SLA health (onTrack/atRisk/breached) is exposed on the department summary.
  What remains BLOCKED is the **periodic SLA worker** (a Redis/scheduler that
  scans active promises on a schedule and re-evaluates escalation) — the
  computation is real, the trigger needs the Phase 5 queue.
- **Phase 8 — Computer vision verification.** No CV provider/model is
  configured. No `CVVerification` model or fabricated confidence is emitted;
  documented as an infrastructure/provider requirement.
- **Phase 9 —Before/After + CV-fronted citizen verification UI.** The citizen
  verify action (`POST /api/issues/[id]/verify`, YES→VERIFIED, NO→reopen+escalate)
  is real and ownership-enforced; the CV-annotated before/after review UI is
  gated on the Phase 8 provider.

## Phase 2 Update (this revision — Real Report → Database Pipeline)

The report pipeline is now fully real: multipart intake → server-side validation
(magic bytes, MIME ↔ extension ↔ content, size) → private storage (local disk or
S3-compatible object storage) → PostgreSQL issue + accuracy + evidence → audit +
notification. Status overrides applied on top of the Phase 1 table:

- **Report submission persistence** — WORKING (Phase 1) → **WORKING** (now under
  `POST /api/reports` + `POST /api/issues`, shared handler `src/lib/issues/http.ts`;
  GPS accuracy persisted to `Issue.accuracy`).
- **Image / video upload & storage** — WORKING → **WORKING** (every upload is
  magic-byte + structure validated server-side; stored privately; S3-compatible
  backend when `STORAGE_*` are set; files served only via the authorized
  `GET /api/evidence/[id]/file` route — no public path).
- **Geocoding / coordinate capture** — PARTIAL → **PARTIAL** (browser GPS taps a
  real `navigator.geolocation` fix + ±m accuracy, stored with the report; optional
  server-side reverse geocoder via `GEOCODER_URL` used only for the location label
  and never needed for submission; address search still not built).
- **Duplicate detection / report merging** — MOCK → **PARTIAL** (live: same
  reporter + category + title within 60 s returns `409 DUPLICATE_REPORT`, plus a
  synchronous client lock. Cross-report similarity clustering remains MOCK).
- **Evidence privacy / access control** — MISSING → **WORKING** (per-request DB
  re-check: reporter, assigned authority, or admin may fetch a file; URL-type
  seed evidence is unchanged).
- **Role-scoped report API** — MISSING → **WORKING** (`GET /api/reports`:
  citizen=own, authority=department, admin=all; detail is owner/RBAC enforced).
- **Audit trail** — WORKING (waiting) is extended: `REPORT_CREATED` on every
  successful submission, `STATUS_CHANGED` on PATCH.

Still MOCK / MISSING (unchanged, future phases): verification CV meters,
live incident map, hotspot/risk engine, promise SLA engine + deadlines,
escalations engine, community votes, settings persistence,
broken-promise showcase, civic karma, real-time/websockets,
email/push notifications, background queue/workers.

## Phase 1 Update (this revision — Core Backend & Database Foundation)

Phase 1 backend (PostgreSQL + PostGIS + Prisma, Auth.js v5 magic-link RBAC,
real report persistence, audit + notifications) is implemented and smoke-tested.
Status overrides applied to the Phase 0 table below:

- **Report submission persistence** — MISSING → **WORKING** (`POST /api/issues`
  multipart → Postgres; evidence files to `EVIDENCE_STORAGE_DIR`, CC counter).
- **Citizen authentication / sessions** — MISSING → **WORKING** (Auth.js v5
  magic-link; JWT sessions; role in token; route guard in `src/proxy.ts`).
- **Image / video upload & storage** — MISSING → **WORKING** (multipart via
  `POST /api/issues`; files on local disk; DB `Evidence` rows).
- **Audit trail** — MISSING → **WORKING** (`AuditLog` table; written on report
  create + status change).
- **Real database** — MISSING → **WORKING** (Postgres 17 + PostGIS, migrations
  deployed, seed data).
- **Issue catalogue** — MOCK → **WORKING** (`GET /api/issues` returns DB rows).
- **Issue detail page** — MOCK → **WORKING** (served by `params.id` from DB via
  `/api/issues/[id]`; real audit-driven timeline via `IssueDetailView`).
- **Authority assignment** — MOCK → **PARTIAL** (rule-based category→department
  in `src/lib/issues/mapping.ts`; real `Authority` registry + PATCH role-gate;
  the landing/3D globe strings are still static).
- **Dashboard KPIs / analytics** — MOCK → **PARTIAL** (real counts from DB:
  active / resolved / my reports; promises & verification KPIs honest
  Phase 2 placeholders).
- **Activity timeline** — MOCK → **PARTIAL** (real audit log for persisted
  issues; landing promise-griddle is still the hardcoded `TIMELINE` demo).
- **Notifications (in-app)** — MISSING → **PARTIAL** (real in-app feed +
  unread badge backed by `Notification`; email/push not built).
- **Jurisdiction detection** — MISSING → **PARTIAL** (rule-based dept mapping;
  ward/zone lookup not built).
- **Geocoding / coordinate capture** — MISSING → **PARTIAL** (lat/lng → PostGIS
  `geography(Point,4326)` on intake; no geocoder yet).

Still MOCK / MISSING (see audited table below): verification CV meters,
live incident map, hotspot/risk engine, promise SLA engine + deadlines,
settings persistence, broken-promise showcase, real-time/websockets,
email/push notifications, background queue/workers. (Escalation engine,
community votes, and civic karma are now real DB-backed logic — updated above.)

## Feature Audit

| Feature                                         | Status  | Current Data Source                                                       | Location                                                                             | Future Requirement                                             |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Landing marketing page                          | WORKING | Frontend JSX (static)                                                     | `src/app/page.tsx`; `src/components/landing/*`                                       | Preserve                                                       |
| Landing navigation                              | WORKING | Frontend (client state)                                                   | `src/components/landing/LandingNavigation.tsx`                                       | Preserve                                                       |
| Dashboard layout + navigation                   | WORKING | Frontend                                                                  | `src/app/dashboard/layout.tsx`; `src/components/layout/Navigation.tsx`               | Preserve                                                       |
| Report form (UI + client validation)            | WORKING | Real multipart submit to `POST /api/issues`; file + URL evidence              | `src/app/report/page.tsx`                                                            | Keep as the intake UI                                          |
| Evidence before/after search                    | WORKING | **Real** — Wikimedia Commons API (keyless) via `POST /api/evidence`       | `src/lib/evidence/*`; `src/app/api/evidence/route.ts`                                | Preserve; extend with uploaded citizen evidence                |
| Evidence-derived resolution assessment          | WORKING | **Real** — ranking metrics only when a same-location photo pair exists    | `src/components/landing/CivicBeforeAfter.tsx` (`AssessmentPanel`)                    | Preserve; add real CV metrics when a vision pipeline exists     |
| Before/after comparison slider                  | WORKING | **Real** — retrieved photographs + local `public/road/*`                  | `src/components/landing/CivicBeforeAfter.tsx` (`ImageSlider`, `LocalRoadPanel`)       | Preserve                                                       |
| Local road evidence demo (honest fallback)      | WORKING | **Real, local** images; no fabricated dates/confidence                    | `public/road/image1.jpg`, `public/road/image2.png`                                   | Preserve as an offline demo                                    |
| Google Maps embed (keyless iframe)              | WORKING | Real Google embed; driven by hardcoded coords                            | `src/components/landing/CivicMapEmbed.tsx`; used in landing + `/dashboard/map`        | Keep embed; feed coordinates from the DB                       |
| 3D civic globe                                  | WORKING | Three.js render; **mock** markers (`MOCK_ISSUES`)                        | `src/components/3d/CivicGlobe.tsx`                                                   | Preserve as visual; source markers from real incidents         |
| UI component system / design tokens             | WORKING | Frontend (`src/components/ui/*`, `src/lib/design-tokens.ts`, `motion.ts`) | `src/components/ui/*`                                                                 | Preserve                                                       |
| Priority score labels & colors                  | PARTIAL | Threshold helpers real; scores themselves hardcoded                      | `src/lib/utils.ts` (`getPriorityLabel`, `getPriorityColor`, `getStatusColor`)         | Compute real priority server-side                              |
| "Live Intelligence" map overlays                | PARTIAL | Real map embed + mock issue markers/stats                                | `CivicIntelligenceMapSection.tsx`; `/dashboard/map/page.tsx`                           | Connect markers/stats to live incident data                    |
| Source credibility / trust ranking              | PARTIAL | Real heuristic on hostname + license; not cryptographically verified     | `src/lib/evidence/provider.ts` (`sourceCredibility`)                                   | Add tamper-evidence / chain-of-custody                        |
| AI issue classification                         | MOCK     | `FeaturesSection.tsx` (`DetectionDemo`); report page no longer fakes it        | `src/components/landing/FeaturesSection.tsx`                          | Real multimodal model pipeline                                 |
| AI severity detection                           | MOCK     | `FeaturesSection.tsx` demo only; severity stored `null` at creation            | `src/components/landing/FeaturesSection.tsx`                                   | Model inference or rule engine                                 |
| Duplicate detection / report merging            | MOCK     | Timed animation only (`MergeDemo`: 47 → 1)                               | `src/components/landing/FeaturesSection.tsx:167-244`                                  | Geo + text + image similarity clustering                       |
| AI auto-routing / department assignment         | PARTIAL  | Rule-based category→department (`mapping.ts`); no ML routing yet               | `src/lib/issues/mapping.ts`; `/dashboard/issues/[id]/page.tsx`                    | Jurisdiction/routing engine                                    |
| AI verification meters (issue detail page)      | MOCK     | Hardcoded `AI_VERIFICATION` constants                                    | `src/app/dashboard/issues/[id]/page.tsx:48-55`                                        | Real CV verification pipeline                                  |
| Live incident map data                          | WORKING  | **Real** located reports; `/api/map` (scoped) + public `/api/map/public` for the landing Civic Intelligence Map; `CivicGlobe` is data-driven (no `MOCK_ISSUES`) | `src/app/api/map/{route,public}/route.ts`; `src/components/map/CivicMap*`; `src/components/landing/CivicIntelligenceMapSection.tsx`; `src/components/3d/CivicGlobe.tsx` | Preserve (Phase 24 real-time stream) |
| Dashboard KPIs / analytics                      | MOCK     | Hardcoded `KPI`, stat card arrays                                        | `src/app/dashboard/page.tsx:19-33`; `verification`, `promises`, `escalations`, `community`, `map` pages | Real analytics queries                          |
| Recent issues list & issue catalogue            | MOCK     | Hardcoded `RECENT_ISSUES` / `ISSUES` arrays                              | `src/app/dashboard/page.tsx:28`; `src/app/dashboard/issues/page.tsx:9`                | DB query                                                    |
| Issue detail page                              | MOCK     | Hardcoded `ISSUE` / `TIMELINE` constants (always shows CC-1092)          | `src/app/dashboard/issues/[id]/page.tsx:22-55`                                        | Serve by `params.id` from DB                                   |
| Activity timeline                               | MOCK     | Hardcoded `TIMELINE` arrays                                             | `dashboard/issues/[id]/page.tsx:37`; `PromiseLedgerSection.tsx:17`                    | Event store + real workflow events                             |
| Hotspot detection                               | MOCK     | Hardcoded `RISKS` ward/level/trend cards                                 | `src/app/dashboard/risk/page.tsx:7-13`; `PredictiveIntelligenceSection.tsx`           | Spatial clustering (DBSCAN/H3, PostGIS)                         |
| Predictive risk engine                          | MOCK     | Hardcoded drivers + staged animation (`useRiskLifecycle`)                | `src/components/landing/PredictiveIntelligenceSection.tsx`                            | ML model + feature pipeline                                     |
| Risk scores / confidence / scan countdown       | MOCK     | Constants (`84`, `86%`, `1,204`, `NEXT_SCAN`) + `setInterval`            | `PredictiveIntelligenceSection.tsx`                                                  | Model inference + scheduled scans                               |
| Promise ledger (records + deadlines)            | MOCK     | Hardcoded `PROMISES` array                                              | `src/app/dashboard/promises/page.tsx:8-15`; `PromiseLedgerSection.tsx`                | Promise/SLA engine + DB                                         |
| Promise deadline countdown                      | MOCK     | Client `setInterval` from a pretend 18h 42m budget (labelled DEMO)       | `PromiseLedgerSection.tsx` (`CountdownDemo`)                                         | Real deadline from server, web push at thresholds               |
| Escalation engine                               | PARTIAL  | **Real** DB-backed `EscalationRule` + Level ladder + idempotent engine (`src/lib/escalation/`); dashboard still shows hardcoded display array, periodic worker blocked (no Redis) | `src/lib/escalation/{levels,rules,engine}.ts`; `src/app/dashboard/escalations/page.tsx` | Attach periodic scheduler + DB-driven dashboard display          |
| Community verification                          | PARTIAL  | **Real** DB-backed `Vote` rollups via `GET/POST /api/issues/[id]/votes` (`src/lib/community/votes.ts`); dashboard still shows hardcoded `FEEDBACK` | `src/lib/community/votes.ts`; `src/app/api/issues/[id]/votes/route.ts`; `src/app/dashboard/community/page.tsx` | Drive the dashboard from live vote aggregation                 |
| Authority assignment                            | MOCK     | Hardcoded authority strings                                             | `dashboard/issues/[id]/page.tsx:32`; `promises/page.tsx`; `PromiseLedgerSection.tsx`    | Authority registry + RBAC                                       |
| Settings / profile                              | WORKING  | **Real** auth-backed profile: editable/persisted name (`/api/me/profile`); email+role read-only; persisted `UserPreferences` (theme/language/digests) via `/api/me/preferences`; class-based theme toggle; real NotificationPreferencesPanel | `src/app/dashboard/settings/page.tsx`; `src/app/api/me/{preferences,profile}`; `src/components/settings/*`; `src/components/providers/ThemeProvider.tsx` | Add avatar upload + 2FA |
| Broken-promise marketing section                | MOCK     | Hardcoded `RESOLVED_STORIES`/promise facts                                | `src/components/landing/BrokenPromiseSection.tsx`                                    | Real outcomes from verified issues                              |
| Report submission persistence                   | WORKING  | **Real** multipart/file/custom evidence → `POST /api/issues` → Postgres | `src/app/api/issues/route.ts` + `[id]`; `src/lib/issues/http.ts`, `query.ts`        | Preserve canonical `/api/issues` path                          |
| Citizen authentication / sessions               | WORKING  | **Real** NextAuth (JWT + DB user) + middleware                           | `src/app/api/auth/[...nextauth]`; `src/proxy.ts`                                     | Gated role picker on signup (pending sign-in rate-limit fix)    |
| Image / video upload & storage                  | MISSING  | Drag-drop zone only, no handler                                          | `src/app/report/page.tsx:116-129`                                                    | Multipart upload API + object storage                           |
| Geocoding / coordinate capture                  | MISSING  | Free-text location only; coords hardcoded                               | `src/app/report/page.tsx:107`                                                        | Geocoder on intake + reverse geocode for maps                   |
| Jurisdiction detection                          | MISSING  | —                                                                        | —                                                                                     | Ward/zone → department lookup                                   |
| Heatmaps (density/severity/priority/resolved)   | PARTIAL  | **Real** density heatmap layer (Maplibre `heatmap`) over `/api/map` located issues with a Markers↔Heatmap toggle on `/map` | `src/components/map/CivicMapInner.tsx` (GeoJSON heatmap source/layer); `src/components/map/CivicMap.tsx` (view toggle) | Add severity/priority-weighted + H3 tile layers |
| Civic karma                                    | PARTIAL  | **Real** `KarmaEvent` ledger + idempotent `applyKarmaEvent()` + `calculateKarma()` (`src/lib/community/karma.ts`); no UI yet                      | `src/lib/community/karma.ts`                                    | Add karma UI + touchpoints that award events                    |
| Live real-time tracking / websockets            | MISSING  | (`socket.io-client` installed, unused)                                  | —                                                                                     | Event stream + socket server                                   |
| Notifications (in-app/email/push)               | PARTIAL  | **Real** in-app feed + unread badge + mark-read/read-all; multi-channel dispatcher (`notifyUser`) with per-channel preferences + idempotent `dedupeKey` + nodemailer email delivery (EMAIL_SERVER). Push honestly UNSUPPORTED (no provider)   | `src/app/api/notifications/{route,[id],read-all,preferences}`; `src/lib/server/notify.ts`; `src/lib/email/notification.ts`; `src/components/notifications/*`; Settings → Notifications | Add push provider + SMS channel                    |
| Blockchain / tamper-evident ledger              | MISSING  | —                                                                        | —                                                                                     | Event hash chain + optional anchoring                           |
| Audit trail                                    | PARTIAL  | **Real** `Audit` + `IssueNote` event log for persisted issues (`IssueDetailView`) | `src/lib/issues/query.ts`; schema `Audit`/`IssueNote`                                | Enable on remaining UI surfaces + blocking/action history        |
| Background jobs / workers                       | MISSING  | (pipeline runs via next/server `after()` as non-primary fallback)        | `src/lib/server/intelligence/`                                                       | Queue (BullMQ/Redis) + CI/verification workers                  |
| Real database                                  | WORKING  | **Real** PostgreSQL 16 + PostGIS; Prisma models + migrations            | `prisma/schema.prisma`; `prisma/migrations/*`                                        | Preserve                                                       |

## Notes

- **Defining honesty boundary:** the frontend currently invents most "business truth"
  (scores, priorities, verdicts) — **except** statuses/identity for authenticated
  users, which are always derived server-side from the DB (role in JWT + DB
  re-fetch; `Authority.userId` gates status PATCHes). The one externally-sourced
  pipeline (Wikimedia evidence) remains real. Phase 1 removed the fake report
  flow: `/report` persists real submissions.
- The "LIVE INTELLIGENCE / LIVE MODEL" badges describe *presentation*; the data behind
  them is prototype/mock and the UI itself carries `PROTOTYPE DATA — NOT REAL-TIME MONITORING`
  disclaimers in several sections.