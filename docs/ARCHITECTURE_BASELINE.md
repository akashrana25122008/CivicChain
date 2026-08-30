# CivicChain — Architecture Baseline

Phase 0 baseline reference. Companion files:
`FEATURE_STATUS.md` (statuses), `docs/MOCK_DATA_INVENTORY.md` (mock registry)
and `docs/DATABASE.md` (Phase 1 DB). Section §14 records the Phase 1 additions.

---

## 1. Current Architecture

Single Next.js 16 application (App Router, Turbopack, React 19, TypeScript,
Tailwind CSS v4). There is **no separate backend** — one route handler exists.

```
┌────────────────────────────────────────────────────────────┐
│  NEXT.JS 16 APP (Next.js + React 19 SPA-style pages)       │
│                                                            │
│  src/app/                                                  │
│   ├── page.tsx            Landing (14 sections)            │
│   ├── report/page.tsx     Report intake (mock AI)          │
│   ├── dashboard/*         Dashboard (7 pages, static data) │
│   └── api/evidence/route  THE ONLY real backend route      │
│                                                            │
│  src/components/                                           │
│   ├── ui/*       design system (Button, Card, Badge, …)    │
│   ├── 3d/*        Three.js globe + hero                    │
│   ├── landing/*   15 marketing + evidence sections         │
│   └── layout/*    Navigation, Footer, DashboardSidebar     │
│                                                            │
│  src/lib/                                                  │
│   ├── evidence/   provider + queries + types (REAL)        │
│   ├── utils.ts    cn, format, priority/status labels       │
│   ├── design-tokens.ts / motion.ts  theme + animation      │
└───────────┬────────────────────────────────────────────────┘
            │  HTTPS
            ▼
   Wikimedia Commons (keyless, public)
   Google Maps embed iframe (keyless)
```

Key facts:
- **Framework:** Next.js `16.3.3`, App Router; **package manager:** npm.
- **Scripts:** `dev`, `build`, `start`, `lint` (ESLint 9 flat config); `tsc --noEmit` clean.
- **State management:** React local state only (`useState`/`useEffect`); no Redux/Zustand.
- **Data fetching:** one `fetch('/api/evidence')` client call (`src/components/landing/CivicBeforeAfter.tsx`).
- **No database, no ORM schema** (`prisma` + `@prisma/client` installed, no `prisma/` dir).
- **No auth config** (`next-auth` v5 beta installed, unused).
- **No middleware, no server actions, no background jobs, no queue.**
- **Unused deps** (installed but not imported in `src/app` or `src/components`):
  `@prisma/client`, `prisma`, `next-auth`, `maplibre-gl`, `@maplibre/maplibre-gl-geocoder`,
  `socket.io-client`, `recharts`, `swr`, `axios`, `jsonwebtoken`, `bcryptjs`,
  `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`.

## 2. Frontend Structure

Routed pages (`src/app`):

| Route                     | File                            | Data source          |
| ------------------------- | ------------------------------- | -------------------- |
| `/` (landing)             | `page.tsx`                      | Frontend / mocks     |
| `/report`                 | `report/page.tsx`               | Mock AI, no API      |
| `/dashboard`              | `dashboard/page.tsx`            | Hardcoded KPIs       |
| `/dashboard/issues`       | `dashboard/issues/page.tsx`     | Hardcoded array      |
| `/dashboard/issues/[id]`  | `dashboard/issues/[id]/page.tsx`| Hardcoded (ignores id) |
| `/dashboard/map`          | `dashboard/map/page.tsx`        | Embed + `MOCK_ISSUES`|
| `/dashboard/verification` | `dashboard/verification/page.tsx`| Hardcoded array      |
| `/dashboard/promises`     | `dashboard/promises/page.tsx`   | Hardcoded array      |
| `/dashboard/risk`         | `dashboard/risk/page.tsx`       | Hardcoded array      |
| `/dashboard/escalations`  | `dashboard/escalations/page.tsx`| Hardcoded array      |
| `/dashboard/community`    | `dashboard/community/page.tsx`  | Hardcoded array      |
| `/dashboard/settings`     | `dashboard/settings/page.tsx`   | Static UI, no save   |
| `POST /api/evidence`      | `api/evidence/route.ts`         | **Real (Commons)**   |

## 3. Current Data Flow

- **Citizen input:** `/report` form keeps data in `useState`; on submit a 3-second
  `setTimeout` shows a hardcoded result; **data is lost on refresh** (no persistence).
- **Evidence:** landing section `BeforeAfterEvidence`/`LocalRoadPanel` → `useEvidenceSearch`
  → `POST /api/evidence` → `CommonsEvidenceProvider.search()` → Wikimedia Commons API →
  ranked before/after pair → `ReadyPanel`/`PartialPanel`/`UnavailablePanel` + `AssessmentPanel`.
  This is the only truthful pipeline and never fabricates.
- **Dashboards:** all read top-of-file constants; no fetching, no revalidation.
- **Maps:** keyless Google Maps embed iframe; markers are `MOCK_ISSUES`.

## 4. Mock Data Locations

Complete registry: `docs/MOCK_DATA_INVENTORY.md`. Quick map:
`src/app/dashboard/{page,issues,issues/[id],map,verification,promises,risk,escalations,community,settings}`,
`src/components/3d/CivicGlobe.tsx` (`MOCK_ISSUES`),
`src/components/landing/{PredictiveIntelligenceSection,PromiseLedgerSection,BrokenPromiseSection,FeaturesSection,CivicIntelligenceMapSection}.tsx`,
`src/app/report/page.tsx`.

## 5. Architectural Rule (established in Phase 0)

> **FRONTEND MUST NOT GENERATE FAKE BUSINESS TRUTH.**

Frontend may own purely visual state: animation state, loading indicators, modal
state, active tabs, temporary form state, UI transitions.

Frontend must NOT ultimately invent business reality: issue status, risk score,
AI analysis, escalation level, authority assignment, citizen karma, evidence
verification, promise status, geographic risk, analytics, routing decisions.

Target data flow:

```
Frontend  →  API Layer  →  Database / AI / Workers / Storage / External
                                    │
Frontend  ←  API Layer  ←  Processed Result (authoritative)
```

## 6. Recommended Backend Boundary

Planned REST endpoints (order follows §Migration Priorities). These are the
boundaries future phases should implement; each returns the **same shapes** the UI
already consumes (§8).

```
/issues                     GET  list, filters (status, ward, priority)
/issues                     POST create citizen report (multipart evidence)
/issues/:id                 GET  detail + timeline
/issues/:id/verify          POST resolution evidence + CV result
/evidence                   POST search real evidence (exists: /api/evidence)
/risk-analysis              GET  ward/zone risk scores + drivers
/escalations                GET  active escalations; POST trigger rule
/promises                   GET  list + SLA state
/analytics/summary          GET  dashboard KPIs
/heatmap                    GET  hexbin/density tiles
/authorities                GET  registry (route assignment)
/karma                      GET  citizen trust score
/auth/...                   NextAuth v5 routes
/uploads                    POST signed-upload (images/video)
```

## 7. Responsibility Map

| Concern              | Recommended owner                                                | Phase 0 state                       |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| Primary database     | PostgreSQL + PostGIS via Prisma                                   | Not present (no schema)             |
| Issue / evidence storage | DB + object storage (R2/S3) with signed URLs                    | Client-only, not persisted          |
| AI classification/severity | Model inference service (worker)                              | Mock (`setTimeout` + constants)     |
| Duplicate detection  | Geo (PostGIS KNN) + text + image embedding similarity            | Animation only                      |
| Routing/jurisdiction | Ward→department lookup in DB                                     | Hardcoded string                    |
| Priority engine      | Server-side scoring on issue create/update                       | Label helpers only                  |
| Risk prediction      | Feature pipeline + model batch job → `/risk-analysis`            | Hardcoded cards + animation         |
| Verification (CV)    | Worker: CLIP/YOLO/SAM + GPS + date ordering → status             | Evidence-gated landing panel only   |
| Promise/SLA          | Promise records + deadline scheduler + notifications             | Static rows + demo countdown        |
| Escalation           | Rules engine over promise SLA                                    | Static rows                         |
| Live updates         | WebSocket/SSE server (Socket.io + Redis adapter)                | Not present (`socket.io-client` unused) |
| Notifications        | Notifier service (in-app feed, email, push)                      | Not present                         |
| Maps/geolocation     | Keep keyless embed; add geocoder on intake; PostGIS for queries  | Keyless embed, hardcoded coords     |
| Auth                 | NextAuth v5 email/OAuth, role-based middleware                   | Installed, unconfigured             |
| Audit trail / trust  | Append-only event log + SHA-256 hash chain (optional anchoring)  | Not present                         |
| Background jobs      | Queue (BullMQ + Redis) — upload→AI→verify→notify chains          | Not present                         |

## 8. UI Data Contracts (preserve these shapes)

The interfaces below are what components already render. Future API responses
should **reuse these exact shapes** so the UI contract stays stable. Already typed
in `src/lib/evidence/types.ts`: `IssueContext`, `EvidenceImage`, `EvidenceSearchResult`,
`EvidenceMetrics`, `SearchLink`, `SearchStep`, `ImageSearchProvider`.

Unofficial shapes (defined inline in components — candidates to promote to
`src/lib/types.ts` in Phase 1):

```ts
// src/components/3d/CivicGlobe.tsx (IssueMarker)
{ id: string; lat: number; lng: number;
  type: 'pothole'|'drainage'|'streetlight'|'garbage'|'infrastructure';
  priority: number; status: string; reports: number }

// src/app/dashboard/issues/page.tsx (Issue row)
{ id: string; type: string; location: string; priority: number;
  promise: string; status: string; reports: number }

// src/app/dashboard/issues/[id]/page.tsx (Issue detail)
{ id, category, type, location, priority, status, affectedCitizens,
  reports, promise, authority, created, aiConfidence }

// src/app/dashboard/promises/page.tsx (Promise)
{ id: string; type: string; authority: string; deadline: string;
  status: string; created: string }

// src/app/dashboard/escalations/page.tsx (Escalation)
{ id: string; type: string; deadline: string; overdue: number;
  citizens: number; level: number; nextAction: string }

// src/app/dashboard/risk/page.tsx (Risk)
{ ward: string; type: string; level: string; historical: number;
  signal: string; trend: string }

// src/app/report/page.tsx (AIResult)
{ category: string; confidence: number; severity: string;
  department: string; priority: number }
```

Status enums already consumed by `getStatusColor`/Badge:
`active | assigned | promised | onTrack | atRisk | verificationPending |
resolved | partiallyResolved | brokenPromise`.

**Recommendation:** in Phase 1 promote these to shared types (no duplicate type
systems) and have API clients return them verbatim.

## 9. Migration Priorities

Determined from the actual codebase (not a generic template).

### P0 — Critical (core business truth)
Issue creation + persistence (`POST /api/issues`), issue/evidence DB models,
coordinates storage (PostGIS), citizen authentication (NextAuth) + middleware.

### P1 — High (intelligence & decisions)
Real AI classification/severity pipeline, duplicate detection/clustering,
priority engine, auto-routing/jurisdiction, AI resolution verification (CV),
risk analysis service.

### P2 — Medium (derived platform)
Promise/SLA engine, escalation rules, community verification votes, karma,
analytics/KPIs, live tracking + real-time, heatmaps, notifications.

### P3 — Low (demo/presentation)
3D globe marker data, landing demo animations/countdowns, broken-promise
showcase — replaced last, purely cosmetic once real data exists.

## 10. External Service Boundaries (documented, not built)

| Service                  | Where it plugs in                          | Notes                                            |
| ------------------------ | ------------------------------------------ | ------------------------------------------------ |
| Object storage (R2/S3)   | Report upload API → evidence records       | `.env`: `STORAGE_*`                              |
| Geocoder (MapLibre/Google)| Report intake + reverse-geocode for maps   | `.env`: `GOOGLE_MAPS_API_KEY` (optional)         |
| Real-time (Socket.io)    | Live tracking, dashboard subscription      | Backend socket server + Redis adapter            |
| Notifications (email/push)| Promise/escalation/verification events     | Notifier service                                 |
| Mail/OTP (NextAuth v5)   | Auth                                       |                                                                                                                                                |
| ML inference             | Classification/verification/risk workers   | Provider agnostic (no vendor committed)          |

## 11. Environment & Secrets

- **Today:** no `.env` files; app runs with zero env vars (evidence API and map
  embed are keyless). `.env*` already git-ignored (`.gitignore` line 34).
- **Template:** `.env.example` created at repo root with only planned variables
  (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `STORAGE_*`,
  `GOOGLE_MAPS_API_KEY`, optional `AI_*`). No real credentials anywhere in the repo.
- The `.claude/skills/**` tree references its own gemini `api_key` via environment
  variables only (agent tooling, outside the app runtime).

## 12. Known Issues / Technical Debt (do not fix in Phase 0)

1. `/report` links to `/dashboard/issues/CC-1128`; detail page hardcodes `CC-1092`.
2. 66 pre-existing ESLint problems (37 errors, 29 warnings): `react-hooks/set-state-in-effect`
   in `Navigation.tsx`, `CivicTheme.tsx`, `StoryScroll.tsx`; empty interfaces in `Card.tsx`;
   unused vars in `Avatar.tsx`, `Button.tsx`, `Navigation.tsx`; `<img>` in `Avatar.tsx`.
   **TypeScript is clean** (`tsc --noEmit` exit 0).
3. Dead links / unimplemented buttons: "View on Map", "Export Report" (issue detail),
   "Save Changes" (settings), upload zone (report) — cosmetic, no-op.
4. `formatNumber` / `formatRelativeTime`/`formatDate` in `src/lib/utils.ts` are
   currently unused by pages (dead helpers).
5. Free-text location never converted to coordinates → nothing is truly geocoded.
6. `Math.random()` usage in `CivicHero3D.tsx` is decorative (render-time) and
   violates React purity lint; flagged for a future refactor only.

## 13. Phase 1 Readiness

**Ready to begin Phase 1 (Core Backend & Database Foundation)**, in this order:
1. Prisma schema + PostgreSQL/PostGIS migrations (`User`, `Issue`, `Evidence`,
   `Authority`, `Promise`, `Verification`, `Escalation`, `Vote`, `AuditEvent`).
2. NextAuth v5 auth + role middleware; `.env.local` from `.env.example`.
3. `POST /api/issues` + multipart upload + object storage + geocoding.
4. Promote §8 shared types and an API client; swap mock constants behind it.
5. Wire real issues into `/dashboard/issues` and `/dashboard/issues/[id]`.

The UI contract preservation work in §8 is the on-ramp: components can keep their
current shapes while their data source moves from file constants → API client → DB.

---

## 14. Phase 1 Additions (Core Backend & Database Foundation)

Implemented. The frontend-originated "business truth" pipeline
(Frontend → API → DB, flow in §5) is live for reporting, auth and admin.

### Data flow now real

```
Browser (session cookie / JWT)  →  src/proxy.ts (route guard)
  ├─ pages: /login /report /dashboard /dashboard/issues /dashboard/issues/[id]
  │          /my-reports /admin /dashboard/notifications
  └─ APIs: /api/auth/* /api/issues /api/issues/[id] /api/my-reports
           /api/notifications /api/admin/* /api/evidence (unchanged)
                                        │
                                        ▼
   Prisma (driver adapter pg)  →  PostgreSQL 17 + PostGIS
   Auth.js v5 (next-auth beta, JWT strategy, magic-link EmailProvider)
   Evidence files on disk (EVIDENCE_STORAGE_DIR, served from /uploads)
```

### New files (annotated)

- `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`,
  `prisma.config.ts` — schema (14+ tables incl. `Issue`, `Evidence`,
  `AuditLog`, `Notification`, `Authority`, `ReportCounter`), migrations, seed.
- `generated/prisma/` — git-ignored generated client (custom output, ESM).
- `src/proxy.ts` — edge middleware; redirects protected pages to `/login`,
  returns 401/403 JSON for protected APIs; matches **before** auth routes so
  sign-in callbacks are never intercepted.
- `src/lib/db.ts`, `src/lib/auth/auth.config.ts` + `auth.ts`,
  `src/lib/email/magic-link.ts` (custom `sendVerificationRequest`; dev preview
  Map + production "fail loudly without SMTP").
- `src/lib/server/{api,session,audit,notify,storage}.ts` — error contract,
  session/role helpers, audit writes, notifications, upload storage.
- `src/lib/issues/{mapping,types,serialize,create}.ts` — category/status
  labels + display-status mapping, serializers, atomic create tx (counter →
  issue → evidence → audit → notification).
- `src/lib/validation/report.ts` — zod v4 multipart validation with
  client-safe `{ error }` messages.
- `src/types/next-auth.d.ts` — extended `Session["user"]` (`id`, `role`).

### API surface added (all JSON `{ error: { code, message } }` on failure)

| Endpoint | Method | Guard | Notes |
| --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | all | public | magic-link sign-in, session |
| `/api/auth/dev/magic-link` | GET | dev-only env | returns the pending preview link |
| `/api/issues` | GET | public* | real issue list + detail fields |
| `/api/issues` | POST | any user | multipart; mint CC id; evidence uploads |
| `/api/issues/[id]` | GET/PATCH | PATCH: ADMIN or owning AUTHORITY | status transition + audit + notify |
| `/api/my-reports` | GET | user | own reports |
| `/api/my-reports/[id]` | GET | owner or ADMIN | 403 otherwise |
| `/api/notifications` / `[id]` | GET/PATCH | user | list + mark read |
| `/api/admin/audit`, `/api/admin/stats` | GET | ADMIN | audit log + aggregate stats |

### RBAC model

- Role lives in the JWT (set on sign-in) and **identity is re-fetched from the
  DB on every protected call** — the client can never assert a role.
- `AUTHORITY` gates on `Authority.userId`: a status change is allowed only for
  an authority whose department maps to the issue category (`mapping.ts`).
- `ADMIN` bypasses ownership/dept checks.

### Honesty boundary (carried forward)

- No fake AI: the report form submits **real data**; "AI analysis" panels show
  honest Phase 2 placeholders. KPI cards show real counts where available,
  Phase 2 placeholder text otherwise. Demo seed data is explicitly marked
  (titles `DEMO:` / `demo: true` metadata / `@civicchain.dev` emails).
- Severity/priority are `null` at creation (no invented scoring); the dedicated
  authority assignment is a documented rule-based mapping, not an ML model.

### Verification performed (this revision)

- `npx tsc --noEmit` clean; ESLint back to the **66 pre-existing** problems
  (no new violations from Phase 1 code).
- `npm run build` green — all app routes + Proxy emitted (Turbopack).
- Runtime smoke (dev server, magic-link preview): citizen sign-in → report
  upload → `CC-1098` persisted (issue + evidence file + `REPORT_CREATED` audit
  + notification + PostGIS geometry) → `/api/my-reports` ownership 403/200 →
  authority PATCH on a Roads issue (200 + `STATUS_CHANGED` audit + notify),
  403 on a Water dept issue → citizen PATCH 403 → admin audit/stats 200,
  citizen 403 → notification mark-read persisted.