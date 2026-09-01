# Phase 20 — Landing Page Real Data Implementation Report

Connects the public marketing landing page to live CivicChain data instead of
hardcoded / mock statistics. Every landing KPI the phase calls for — live
issues, resolved today, active risk zones, SLA success rate, average resolution
time, and verified resolutions — is now computed from the production database
and served to the marketing surface through dedicated public endpoints.

## Approach

- **Reuse the Phase 19 Analytics Engine.** The landing page needs the exact
  metric families the engine already computes (active issues, resolution times,
  SLA distribution, verification counts, ward-risk zones, AI confidence).
  `computeLandingIntelligence()` simply calls `computeAnalytics('all')` and
  remaps the result — no duplicated SQL, no drift between admin analytics and
  the public marketing numbers.
- **Two landing-only queries.** The essence of Phase 20 is adding the KPIs the
  engine doesn't track: `resolvedToday` (issues whose audit trail moved to
  RESOLVED today) and `promisesTracked` (total promise count). Both are two
  small direct queries.
- **Public, read-only endpoints.** `/api/public/*` routes deliberately carry no
  auth — they back the anonymous marketing surface — and are bounded to small
  aggregates (never personal data). Responses are marked `Cache-Control:
  public, s-maxage=300, stale-while-revalidate=600` so the edge can serve stale
  while the DB refreshes.
- **Pure, testable mapping.** `buildIntelligence(payload, extras)` is a pure
  function with zero I/O, extracting the normalization so it can be unit-tested
  without a database.
- **Loading-independent UI.** Sections render immediately with zeroed metrics on
  first paint, then hydrate/replace with real values via SWR (5-minute
  refresh). Error handling surfaces a friendly notice; empty data renders a
  clear empty-state message. The misleading "PROTOTYPE DATA" labels are removed
  and replaced with "LIVE DATA — DIRECT FROM THE CIVICCHAIN DATABASE".

## Architecture

```
src/lib/server/landing.ts         computeLandingIntelligence() → LandingIntelligence
  buildIntelligence()              pure remap of AnalyticsPayload → KPI shape (unit-tested)
  resolvedTodaySql()               issue count whose audit trail reached RESOLVED today
  promisesTracked                  Promise.count()
GET /api/public/intelligence       public KPI JSON (no auth, edge-cached ~5m)
GET /api/public/risks              public predictive risk zones (fetchAreaRisks, public-safe fields)
```

Landing sections wired to real data:

- **HeroSection** — 4 metrics now live: ACTIVE CIVIC ISSUES (`liveIssues`),
  RESOLVED TODAY (`resolvedToday`), AI-VERIFIED RESOLUTIONS
  (`verifiedResolutions`), PROMISES TRACKED (`promisesTracked`). The
  "PROTOTYPE DATA" footer is replaced with a live-data label.
- **PredictiveIntelligenceSection** — the five hardcoded ward cards are now
  rendered from `/api/public/risks` (real `fetchAreaRisks` output: ward name,
  real risk score/level, active reports, 30-day trend), with a category→icon
  mapping and loading/empty/error states. The disclaimer text was updated to
  describe the real live data source.
- **DashboardPreviewSection** — the six KPI cards now read `/api/public/
  intelligence` (Issues Tracked → `totalIssues`, Resolved → `resolvedIssues`,
  Promise Fulfillment → `slaSuccessRatePct`, Broken Promises →
  `brokenPromises`, Avg Resolution Time → `averageResolutionTime` in days,
  AI-Verified Resolutions → `verifiedResolutions`). The mock department panel
  and both "PROTOTYPE DATA" badges were removed.
- **CivicIntelligenceMapSection** — already wired to `/api/map/public` in a
  prior phase; left intact and consistent with the new "LIVE DATA" framing.

## LandingIntelligence shape

```ts
interface LandingIntelligence {
  liveIssues: number;           // active (non-resolved/rejected) issues
  resolvedToday: number;        // issues whose audit log reached RESOLVED today (UTC)
  promisesTracked: number;      // total Promise rows
  brokenPromises: number;       // active promises currently BREACHED
  activeRiskZones: number;      // wards with HIGH + CRITICAL risk
  averageResolutionTime: number | null;   // avg minutes to resolve
  slaSuccessRatePct: number | null;       // 0-100, onTrack/activePromises
  verifiedResolutions: number;  // total VERIFIED verification rows
  aiConfidence: number | null;  // avg AI model confidence (0-1)
  resolutionRatePct: number | null;
  totalIssues: number;
  resolvedIssues: number;
  generatedAt: string;
}
```

## Verification

- **Typecheck**: `npx tsc --noEmit` — clean, no errors.
- **Lint**: `npx eslint` over every touched source file — 0 errors/warnings.
- **Tests**: `npm test` — **131/131 pass** (127 prior + 4 new
  `landing.test.ts` unit tests covering field mapping, SLA-rate math, the
  null-when-no-promises case, and the high+critical risk-zone sum).
- **Production build**: `npx next build` — exit 0, both `/api/public/
  intelligence` and `/api/public/risks` compiled as dynamic routes.
- **Live smoke test** (dev server against real Postgres):
  - `/api/public/intelligence` → 13 KPI fields, e.g. `liveIssues: 27`,
    `promisesTracked: 4`, `averageResolutionTime: 7200`, `slaSuccessRatePct:
    100`, `verifiedResolutions: 1`, `resolvedIssues: 2`.
  - `/api/public/risks` → real computed zones (e.g. a MEDIUM DRAINAGE area at
    score 28 and a LOW POTHOLE area at score 19) with real trends.
  - Landing page HTTP 200; zero `PROTOTYPE DATA` occurrences remain; three
    sections carry the live-data label.

## Files

- `src/lib/server/landing.ts` — new landing intelligence service (+ pure
  `buildIntelligence`).
- `src/lib/server/__tests__/landing.test.ts` — new unit tests (131 total).
- `src/app/api/public/intelligence/route.ts` — new public KPI endpoint.
- `src/app/api/public/risks/route.ts` — new public risk-zones endpoint.
- `src/components/landing/HeroSection.tsx` — live hero metrics.
- `src/components/landing/PredictiveIntelligenceSection.tsx` — live risk zones.
- `src/components/landing/DashboardPreviewSection.tsx` — live KPI cards, mock
  department panel removed.

## Notes / assumptions

- `activeRiskZones` counts wards classified HIGH + CRITICAL by the Phase 11
  engine; the live DB currently has only MEDIUM/LOW zones, so it reports 0 until
  higher-risk data exists — this is correct, not a defect.
- `resolvedToday` uses the UTC calendar day of the audit-log `STATUS_CHANGED →
  RESOLVED` transitions; the live DB had none today, hence 0.
- No AI provider is configured, so `aiConfidence` is `null` (mirrors the
  project-wide behavior).
