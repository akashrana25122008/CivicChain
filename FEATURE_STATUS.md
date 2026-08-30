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

## Summary

| WORKING | PARTIAL | MOCK | MISSING | UNKNOWN |
| ------: | ------: | ---: | ------: | ------: |
|      18 |      11 |   11 |       7 |       0 |

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

Still MOCK / MISSING (unchanged, future phases): AI classification/severity,
cross-report flame-similarity clustering, verification CV meters, live incident
map, hotspot/risk engine, promise SLA engine + deadlines, escalations, community
votes, settings persistence, broken-promise showcase, civic karma,
real-time/websockets, email/push notifications, background workers.

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

Still MOCK / MISSING (unchanged, Phase 2+): AI classification/severity,
duplicate detection, verification CV meters, live incident map, hotspot/risk
engine, promise SLA engine + deadlines, escalations, community votes, settings
persistence, broken-promise showcase, civic karma, real-time/websockets,
email/push notifications, background workers.

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
| Live incident map data                          | MOCK     | `MOCK_ISSUES` exported from `CivicGlobe.tsx`                            | `src/components/3d/CivicGlobe.tsx:33-42`; landing + map + dashboard pages             | Real incident coordinates from DB                              |
| Dashboard KPIs / analytics                      | MOCK     | Hardcoded `KPI`, stat card arrays                                        | `src/app/dashboard/page.tsx:19-33`; `verification`, `promises`, `escalations`, `community`, `map` pages | Real analytics queries                          |
| Recent issues list & issue catalogue            | MOCK     | Hardcoded `RECENT_ISSUES` / `ISSUES` arrays                              | `src/app/dashboard/page.tsx:28`; `src/app/dashboard/issues/page.tsx:9`                | DB query                                                    |
| Issue detail page                              | MOCK     | Hardcoded `ISSUE` / `TIMELINE` constants (always shows CC-1092)          | `src/app/dashboard/issues/[id]/page.tsx:22-55`                                        | Serve by `params.id` from DB                                   |
| Activity timeline                               | MOCK     | Hardcoded `TIMELINE` arrays                                             | `dashboard/issues/[id]/page.tsx:37`; `PromiseLedgerSection.tsx:17`                    | Event store + real workflow events                             |
| Hotspot detection                               | MOCK     | Hardcoded `RISKS` ward/level/trend cards                                 | `src/app/dashboard/risk/page.tsx:7-13`; `PredictiveIntelligenceSection.tsx`           | Spatial clustering (DBSCAN/H3, PostGIS)                         |
| Predictive risk engine                          | MOCK     | Hardcoded drivers + staged animation (`useRiskLifecycle`)                | `src/components/landing/PredictiveIntelligenceSection.tsx`                            | ML model + feature pipeline                                     |
| Risk scores / confidence / scan countdown       | MOCK     | Constants (`84`, `86%`, `1,204`, `NEXT_SCAN`) + `setInterval`            | `PredictiveIntelligenceSection.tsx`                                                  | Model inference + scheduled scans                               |
| Promise ledger (records + deadlines)            | MOCK     | Hardcoded `PROMISES` array                                              | `src/app/dashboard/promises/page.tsx:8-15`; `PromiseLedgerSection.tsx`                | Promise/SLA engine + DB                                         |
| Promise deadline countdown                      | MOCK     | Client `setInterval` from a pretend 18h 42m budget (labelled DEMO)       | `PromiseLedgerSection.tsx` (`CountdownDemo`)                                         | Real deadline from server, web push at thresholds               |
| Escalation engine                               | MOCK     | Hardcoded `ESCALATIONS` array                                           | `src/app/dashboard/escalations/page.tsx:10-14`                                        | Rules engine + notifications                                    |
| Community verification                          | MOCK     | Hardcoded `FEEDBACK` percentages                                         | `src/app/dashboard/community/page.tsx:7-12`; issue detail page                        | DB votes + aggregation                                          |
| Authority assignment                            | MOCK     | Hardcoded authority strings                                             | `dashboard/issues/[id]/page.tsx:32`; `promises/page.tsx`; `PromiseLedgerSection.tsx`    | Authority registry + RBAC                                       |
| Settings / profile                              | MOCK     | `defaultValue` static inputs; no persistence                            | `src/app/dashboard/settings/page.tsx`                                               | Auth-backed user profile                                        |
| Broken-promise marketing section                | MOCK     | Hardcoded `RESOLVED_STORIES`/promise facts                                | `src/components/landing/BrokenPromiseSection.tsx`                                    | Real outcomes from verified issues                              |
| Report submission persistence                   | MISSING  | —                                                                        | (no API route, no DB)                                                                | `POST /api/issues` + database                                   |
| Citizen authentication / sessions               | MISSING  | (`next-auth` installed, zero config)                                     | —                                                                                     | NextAuth v5 + middleware                                        |
| Image / video upload & storage                  | MISSING  | Drag-drop zone only, no handler                                          | `src/app/report/page.tsx:116-129`                                                    | Multipart upload API + object storage                           |
| Geocoding / coordinate capture                  | MISSING  | Free-text location only; coords hardcoded                               | `src/app/report/page.tsx:107`                                                        | Geocoder on intake + reverse geocode for maps                   |
| Jurisdiction detection                          | MISSING  | —                                                                        | —                                                                                     | Ward/zone → department lookup                                   |
| Heatmaps (density/severity/priority/resolved)   | MISSING  | —                                                                        | —                                                                                     | H3 geospatial aggregation + tiles                              |
| Civic karma                                    | MISSING  | Marketing copy only                                                     | —                                                                                     | User trust scoring model                                       |
| Live real-time tracking / websockets            | MISSING  | (`socket.io-client` installed, unused)                                  | —                                                                                     | Event stream + socket server                                   |
| Notifications (in-app/email/push)               | MISSING  | —                                                                        | —                                                                                     | Notifier service                                                |
| Blockchain / tamper-evident ledger              | MISSING  | —                                                                        | —                                                                                     | Event hash chain + optional anchoring                           |
| Audit trail                                    | MISSING  | —                                                                        | —                                                                                     | Append-only event log                                          |
| Background jobs / workers                       | MISSING  | —                                                                        | —                                                                                     | Queue (BullMQ/Redis) + CI/verification workers                  |
| Real database                                  | MISSING  | (`prisma`/`@prisma/client` installed, no schema, no `prisma/` dir)       | —                                                                                     | PostgreSQL + PostGIS schema + migrations                        |

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