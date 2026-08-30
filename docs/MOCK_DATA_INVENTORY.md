# CivicChain — Mock Data Inventory

Phase 0 audit of every simulated / hardcoded business-data source.
**Nothing here was deleted in Phase 0** — this registry exists so later phases
can replace each mock with a real API/DB behind a stable UI contract.

Priority legend (also in `docs/ARCHITECTURE_BASELINE.md` §Migration Priorities):

| Priority | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| P0       | Core business truth (creation/storage/identity)                |
| P1       | Intelligence & decision systems                                |
| P2       | Derived platform systems                                       |
| P3       | Demo/presentation enhancements                                 |

---

## Inventory

### 1. Report AI analysis (the "3-second AI")

- **Feature:** Report → AI classification → result
- **File:** `src/app/report/page.tsx:51-69`
- **Component:** `ReportPage.handleSubmit`
- **Responsible code:** `await new Promise((r) => setTimeout(r, 3000))`; `mockResult` const
- **Type:** Fake processing + hardcoded business result (`Road Pothole`, 94%, High, Roads & Infrastructure, priority 92)
- **UI consumer:** `/report` "Result" step (issue ID, confidence, severity, priority, department)
- **Replacement (future):** `POST /api/report` → AI pipeline → DB-backed issue; progress from real worker status
- **Dependencies:** None (self-contained form)
- **Priority:** P0 (submission) / P1 (AI result)

### 2. Issue catalogue (dashboard)

- **Feature:** Civic issues list
- **File:** `src/app/dashboard/issues/page.tsx:9-18`
- **Component:** `IssuesPage`
- **Responsible code:** `const ISSUES = [...]` (8 hardcoded records)
- **Type:** Hardcoded array (ids, types, priorities, promises, statuses, report counts)
- **UI consumer:** `/dashboard/issues` list rows
- **Replacement:** DB query `GET /api/issues`
- **Dependencies:** Issue model
- **Priority:** P0

### 3. Dashboard overview KPIs + recent issues + escalations

- **Feature:** Civic Overview page
- **File:** `src/app/dashboard/page.tsx:19-33, 113-115`
- **Component:** `DashboardPage`
- **Responsible code:** `KPI`, `RECENT_ISSUES`, inline escalation objects
- **Type:** Hardcoded arrays/objects (counts, deltas, statuses)
- **UI consumer:** KPI cards, Recent Issues, Escalations requiring attention
- **Replacement:** Analytics aggregation API (`/api/analytics/summary`), `/api/issues?limit=4`, `/api/escalations`
- **Dependencies:** Issue + Promise + Escalation models
- **Priority:** P2

### 4. Issue detail page

- **Feature:** Issue detail + timeline + AI verification + community votes
- **File:** `src/app/dashboard/issues/[id]/page.tsx:22-55`
- **Component:** `IssueDetailPage`
- **Responsible code:** `ISSUE`, `TIMELINE`, `AI_VERIFICATION`, inline vote percentages
- **Type:** Fully hardcoded single issue (CC-1092). **Bug:** page ignores `params.id` and always renders CC-1092.
- **UI consumer:** `/dashboard/issues/:id`
- **Replacement:** `GET /api/issues/:id` + event timeline + real metrics
- **Dependencies:** Issue, TimelineEvent, Verification models
- **Priority:** P0

### 5. Evidence upload slots (issue detail)

- **Feature:** Photo 1 / Photo 2 evidence placeholders
- **File:** `src/app/dashboard/issues/[id]/page.tsx:140-154`
- **Component:** `IssueDetailPage` > "Issue Evidence"
- **Responsible code:** Two hardcoded empty `<div>`s labelled Photo 1/Photo 2
- **Type:** Empty placeholders (no data)
- **UI consumer:** Evidence card
- **Replacement:** Stored uploads via object storage + signed URLs
- **Dependencies:** Upload API + Evidence model
- **Priority:** P0

### 6. Promises page

- **Feature:** Promise engine list + stats
- **File:** `src/app/dashboard/promises/page.tsx:8-15, 28-32`
- **Component:** `PromisesPage`
- **Responsible code:** `PROMISES`, stat cards (`173`, `142`, `18`, `13`)
- **Type:** Hardcoded array + stats
- **UI consumer:** `/dashboard/promises`
- **Replacement:** `GET /api/promises` + SLA aggregation
- **Dependencies:** Promise model + authority registry
- **Priority:** P2

### 7. Escalations page

- **Feature:** Escalation engine
- **File:** `src/app/dashboard/escalations/page.tsx:10-14, 27-30`
- **Component:** `EscalationsPage`
- **Responsible code:** `ESCALATIONS`, stats (`21`, `8`, `13`)
- **Type:** Hardcoded array + stats
- **UI consumer:** `/dashboard/escalations`
- **Replacement:** Escalation rules engine (`/api/escalations`)
- **Dependencies:** Promise/Issue models + rules engine
- **Priority:** P2

### 8. Verification page

- **Feature:** AI verification queue
- **File:** `src/app/dashboard/verification/page.tsx:8-13, 26-30`
- **Component:** `VerificationPage`
- **Responsible code:** `VERIFICATIONS`, stats (`1,294`, `1,182`, `98`, `14`)
- **Type:** Hardcoded array + stats (confidence/location/visual fixed values)
- **UI consumer:** `/dashboard/verification`
- **Replacement:** CV verification pipeline output (`/api/verifications`)
- **Dependencies:** Evidence + CV worker + Issue model
- **Priority:** P1

### 9. Risk page

- **Feature:** Civic Risk Intelligence
- **File:** `src/app/dashboard/risk/page.tsx:7-13`
- **Component:** `RiskPage`
- **Responsible code:** `RISKS` (wards, levels, historical, signal, trend) — self-labelled *prototype intelligence*
- **Type:** Hardcoded array
- **UI consumer:** `/dashboard/risk`
- **Replacement:** Risk analysis service (`/api/risk-analysis`)
- **Dependencies:** Historical incidents + weather/geospatial signals
- **Priority:** P1

### 10. Community page

- **Feature:** Community verification feedback
- **File:** `src/app/dashboard/community/page.tsx:7-12, 25-29`
- **Component:** `CommunityPage`
- **Responsible code:** `FEEDBACK`, stats (`333`, `57%`, `21%`, `22%`)
- **Type:** Hardcoded array + stats
- **UI consumer:** `/dashboard/community`
- **Replacement:** Vote aggregation API
- **Dependencies:** Vote model + Issue model
- **Priority:** P2

### 11. Settings page

- **Feature:** Profile / notifications / privacy
- **File:** `src/app/dashboard/settings/page.tsx:28-40, 52-56`
- **Component:** `SettingsPage`
- **Responsible code:** `defaultValue` static inputs; toggle rows (non-interactive)
- **Type:** Static UI, no persistence
- **UI consumer:** `/dashboard/settings`
- **Replacement:** Auth-backed `GET/PUT /api/profile`, notification preferences
- **Dependencies:** Auth
- **Priority:** P2

### 12. Map page + landing map overlay

- **Feature:** Civic Intelligence Map (live claims)
- **Files:** `src/app/dashboard/map/page.tsx:4,90`; `src/components/landing/CivicIntelligenceMapSection.tsx:5,111`
- **Components:** `MapPage`, `CivicIntelligenceMapSection`
- **Responsible code:** `MOCK_ISSUES` from `src/components/3d/CivicGlobe.tsx:33-42`; hardcoded `STATS`, `LEGEND`, `CITY_CENTER`
- **Type:** Real Google embed + hardcoded markers/statistics; `PROTOTYPE DATA — NOT REAL-TIME MONITORING` footnote
- **UI consumer:** map iframe, Nearby Issues list, stats strip, issue popover
- **Replacement:** Incident GeoJSON via map API; coordinates from DB (`POSTGIS`)
- **Dependencies:** Issue model + geospatial index
- **Priority:** P2 (visual data feed), P0 (coordinate storage)

### 13. Civic globe (3D)

- **Feature:** 3D globe with issue markers
- **File:** `src/components/3d/CivicGlobe.tsx`
- **Component:** `CivicGlobe`, `CivicGlobeWrapper`
- **Responsible code:** exported `MOCK_ISSUES` (8 issues, Mumbai coords); all rendering reads it
- **Type:** Hardcoded fixture (coordinates, ids, priority, status, reports)
- **UI consumer:** hero/landing globe, dashboard map (previously), connections layer
- **Replacement:** Real incidents from DB; keep Three.js rendering
- **Dependencies:** Issue model
- **Priority:** P3 (marker data), P0 (coordinate source)

### 14. Predictive intelligence section (landing)

- **Feature:** Predictive risk model demo
- **File:** `src/components/landing/PredictiveIntelligenceSection.tsx`
- **Component:** `RiskZoneDemo`, `RiskGauge`, `useRiskLifecycle`
- **Responsible code:** `RISKS` (5 wards), `NODES`, `HEAT_BLOBS`, `HOTSPOTS`, `WARD_PATH`, `STAGE_LABEL`, metrics (`84`, `86%`, `1,204`, `6–12 hrs`), countdown
- **Type:** Hardcoded risk cards + staged animation (scan → analyze → complete) + `setInterval`/`setTimeout`; self-published note: *prototype intelligence, not real-time prediction*
- **UI consumer:** `#predictive` section
- **Replacement:** Risk analysis API output + model inference
- **Dependencies:** Historical incidents, weather/geospatial feeds
- **Priority:** P1

### 15. Promise ledger section (landing)

- **Feature:** Promise ledger + deadline countdown
- **File:** `src/components/landing/PromiseLedgerSection.tsx`
- **Component:** `PromiseLedgerSection`, `CountdownDemo`
- **Responsible code:** hardcoded promise (`#CC-00421`), `TIMELINE`, `CountdownDemo` budget (`18h 42m`), `setInterval`
- **Type:** Static record + simulated countdown; badge `DEMO` + caption "Simulated countdown — prototype, not connected to a live backend"
- **UI consumer:** `#promise-ledger`
- **Replacement:** Promise/SLA API + real deadlines + server-driven countdown
- **Dependencies:** Promise model
- **Priority:** P2

### 16. Broken promise section (landing)

- **Feature:** Broken-promise accountability showcase
- **File:** `src/components/landing/BrokenPromiseSection.tsx`
- **Component:** `BrokenPromiseSection`
- **Responsible code:** `RESOLVED_STORIES`; hardcoded promise facts (`#CC-00421`, `63` citizens, `28 August 2026`)
- **Type:** Hardcoded example story
- **UI consumer:** `#broken-promise`
- **Replacement:** Real expired promises + outcomes
- **Dependencies:** Promise/Issue models
- **Priority:** P3

### 17. Features section demos

- **Feature:** AI detection / merging / priority / verification animations
- **File:** `src/components/landing/FeaturesSection.tsx`
- **Component:** `DetectionDemo`, `MergeDemo` (`AnimatedStage`), `PriorityDemo`, `VerifyDemo`
- **Responsible code:** `setTimeout` stage scripts; hardcoded `Road Pothole`, `94%`, `HIGH`, `Road Pothole`, `47 → 1`, `91`, `98/84/71`, `PARTIALLY RESOLVED`
- **Type:** Timed animations with hardcoded demo figures (badge: `AI ANALYSIS — PROTOTYPE`)
- **UI consumer:** `#features` cards
- **Replacement:** Real AI/pipeline results-driven components
- **Dependencies:** AI pipeline, clustering, priority, verification
- **Priority:** P3

### 18. Issue detail activity timeline (duplicate of #4)

- **File:** `src/app/dashboard/issues/[id]/page.tsx:37-46`
- **Type:** Hardcoded `TIMELINE`
- **Replacement:** Event store
- **Priority:** P2

## Phase 1 — replaced / retired entries

Phase 1 (Core Backend) replaced these entries with real, DB-backed flows. The
rows remain above as the Phase 0 record; the current source of truth is noted.

| Entry | Phase 0 type | Phase 1 replacement |
| ----- | ------------ | ------------------- |
| #1 Report AI analysis (the "3-second AI") | Fake processing | **Retired from `/report` flow** — the form now submits real multipart data to `POST /api/issues`; result step reads the persisted issue. The `DetectionDemo`/`PriorityDemo` animations in `FeaturesSection` remain P3 |
| #2 Issue catalogue | Hardcoded array | `GET /api/issues` → DB (seeded `CC-1090…` + real reports) |
| #4 Issue detail page (+ #18 timeline) | Fully hardcoded CC-1092 | `GET /api/issues/[id]` → DB; timeline rendered from `AuditLog`; `params.id` honored |
| #11 Settings page | Static UI, no persistence | Unchanged (still static) — P2 |
| Authority assignment / auto-routing | Hardcoded string | Rule-based category→department (`src/lib/issues/mapping.ts`) + real `Authority` registry + `Authority.userId` PATCH gate |

New real data surfaces added in Phase 1 (not in the Phase 0 inventory):
`src/app/api/my-reports/*`, `src/app/api/notifications/*`,
`src/app/api/admin/{audit,stats}`, `src/lib/email/magic-link.ts` (dev preview +
fail-loud production), `src/app/admin/page.tsx`, `src/app/dashboard/notifications/page.tsx`.

Everything else in the inventory above is unchanged and deferred (P1–P3).

---

## Summary by category

| Category                                  | Entries                                        |
| ----------------------------------------- | ---------------------------------------------- |
| Hardcoded business arrays/constants       | #2, #3, #4, #6, #7, #8, #9, #10, #12, #13, #15, #16, #18 |
| Fake processing + hardcoded result        | #1, #14, #17                                   |
| Client-side timers simulating state       | #1 (`setTimeout`), #14 (`setInterval`/`setTimeout`), #15 (`setInterval`), #17 (`setTimeout`) |
| Static UI without persistence             | #11                                           |
| Empty placeholders                        | #5                                            |

## Non-business use of the same primitives (NOT mocks, safe)

The following use `Math.random` / timers for **pure visuals** only and are excluded
from the inventory above:

- `src/components/3d/CivicHero3D.tsx` — `Math.random` for decorative building/particle layout (no business values)
- `src/components/landing/LandingNavigation.tsx` — `setTimeout` for menu close delay
- `src/components/landing/BrokenPromiseSection.tsx` — `setInterval` for an auto-rotating story carousel (presentation)
- `src/components/landing/CivicIntelligenceMapSection.tsx` / map page — `key`-based iframe re-render (presentation)