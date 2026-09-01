# Phase 11 — Risk / HotSpot Intelligence Engine

The Risk Intelligence engine already existed from the roadmap's earlier sweep
(real, DB-derived, weighted `src/lib/risk/scoring.ts`, batched area grouping,
and the four-risk-API surface). This phase audited that implementation against
the full 28-step Phase 11 spec — and, critically, against the product's
**No Fake System Policy** (§28, "everything visible must be backed by real
computation"). The audit found the engine honest at its core but leaking
placeholder values and misleading labels in several places. Those were the gaps
closed here.

## Approach

Audit-first. Classified every existing risk artifact (service → API → hooks →
UI) as COMPLETE / PARTIAL / MISSING against the spec, then fixed only the real
gaps — reusing the existing weighted engine rather than rebuilding it. No
schema changes were needed; everything below is read-path computation over the
same Issue data the rest of the platform already trusts.

## 1. Audit findings (fixed this phase)

| Gap | Where | Spec / policy |
| --- | --- | --- |
| Fabricated hotspot metrics | `fetchHotspots` + summary `topHotspots` hardcoded `avgUnresolvedHours: 0, confirmVotes: 0` | §28 no fake data |
| Real explanation engine unused | `generateRiskExplanation` (in `scoring.ts`) existed but the UI built its own template | §19 explanations |
| No ward-detail API | Missing `GET /api/risk/wards/:wardId` | Spec 11.15 |
| Deceiving filter params | `limit`/`offset` accepted but ignored by `fetchAreaRisks` | §28 no dead APIs |
| N+1 trend queries | `computeAreaTrend` ran 2 queries per area (12 areas → ~26 queries) | correctness/scale |
| Fake "AI" branding | `RiskEngine.tsx` claimed `MODEL v2.1`, "Re-run AI Scan", "Predictive Risk Engine" for a deterministic weighted score | §28 no fake AI |
| Missing real filters | The risk page only offered risk-level + time window; new category / department / ward-search filters | Spec 11.19 |

## 2. Service layer (`src/lib/risk/areas.ts`)

- **Real hotspot values** — `toHotspot()` now maps the ward summary's actual
  computed `avgUnresolvedHours`, `confirmVotes`, and `totalVotes`; the hardcoded
  `0` placeholders are gone from both `fetchHotspots` and `fetchRiskSummary`.
  `WardRiskSummary` gained `avgUnresolvedHours`, `confirmVotes`, `totalVotes`,
  and an `explanation` field.
- **Batched trends** — `computeAreaTrends()` issues exactly two queries (current
  and previous period), groups once, and matches areas by name. The previous
  per-area re-query storm is eliminated.
- **Explanation engine wired** — every ward summary carries the real
  `generateRiskExplanation(...)` output (classification, incident/repeat/SLA
  counts, primary driver, and an honest "population-exposure data unavailable"
  note rather than inventing population numbers).
- **Honest pagination** — `limit`/`offset` are honored (after risk-level
  filtering) so the API does what its query contract advertises.
- **Real filter dimension** — `departmentId` is now a WHERE-clause filter on
  every risk query (per-area, hotspots, summary, trends).
- **`RiskSummary.computedAt`** — the recomputation timestamp proves the engine
  recalculates from live data on every request (no stale/cached numbers).

## 3. API layer

- **New `GET /api/risk/wards/:wardId`** — full ward detail: summary, per-factor
  breakdown, real explanation, category distribution, and the actual issues
  (with promise deadlines) driving the score. 404 when the ward doesn't exist
  in the window; input validation for `days`.
- **`GET /api/risk/departments`** — citizen-safe feed of departments that have
  issues, powering the dashboard filter (id + name only).
- `summary` / `wards` / `hotspots` / `trends` now accept `departmentId` and do
  strict `days` / `riskLevel` / `limit` / `offset` validation instead of passing
  garbage through.

## 4. Risk dashboard (`src/app/dashboard/risk/page.tsx`)

- **Filters**: time window (7/30/90), ward/area text search, issue category,
  routed department, and risk level — all real, all wired to the backend.
- **Ward-detail side panel** — clicking any row opens the breakdown from
  `/api/risk/wards/:wardId` (explanation, categories, driving issues).
- **Real explanations** replace the old hand-rolled template in the
  "Why is X HIGH?" cards.
- Removed the dead self-referencing "View all" link (§28 no dead UI).
- Empty/error states preserved and extended for filtered-empty results.

## 5. RiskEngine visualization (`RiskEngine.tsx`)

De-branded from fake AI: no more `MODEL v2.1`, "AI ENGINE" stage labels,
"Re-run AI Scan", or "Predictive" claims. The gauge now reads **"City Risk
Intelligence / Live Risk Overview"** with honest labels ("Risk Load",
"Active Issues", "Weighted Risk Model", "Re-run Risk Scan") and spells out in a
comment that the score is a deterministic weighted computation — not ML
inference. The pre-existing `set-state-in-effect` lint debt was also fixed by
deferring the mount scan out of the synchronous effect body.

## 6. Tests

`src/lib/risk/__tests__/areas.test.ts` (new, pure, no DB):
- `toHotspot` carries the real aggregate values (never zeros), mirrors trend/
  coordinates, and propagates identity.
- `categoryBreakdownFromIssues` tallies and sorts deterministically.
- `generateRiskExplanation` states classification, counts, driver, and flags
  unavailable data instead of fabricating it.

Existing scoring/trend suites unchanged. **Full suite: 181 tests passing**
(174 baseline + 7 new risk tests).

## 7. Verification

- `npx tsc --noEmit` — clean.
- `eslint` over all touched files — clean (including the RiskEngine lint fix).
- `npm test` — 181 pass / 0 fail.
- `npm run build` — exit 0, all new routes registered
  (`/api/risk/departments`, `/api/risk/wards/[wardId]`).
- `prisma migrate diff` — **no schema drift** (no migrations required).
- Live smoke (dev server :3101, auth via magic link):
  - Hotspots report real values — e.g. an issue unresolved for **535h**
    surfaces as `avgUnresolvedHours: 535`, not a fabricated 0.
  - Ward detail returns explanation, factor keys, category breakdown, and issue
    list; unknown ward → 404.
  - `limit`/`offset` pagination returns distinct pages; category and department
    filters change result sets; invalid inputs → 400; unauthenticated → 401.
  - Departments feed returns the 5 real departments.
- Mock sweep: `docs/MOCK_DATA_INVENTORY.md` row #9 updated to list the two new
  consumed endpoints; no mock risk data introduced anywhere.

## 8. Honest limitations (unchanged, documented)

- **Population exposure** remains structurally reserved (`populationWeight: 0`):
  the API flags it as "unavailable" rather than inventing a number.
- **Periodic recalculation** is satisfied by recompute-on-read (`computedAt`
  changes each request). A scheduled snapshot would require the Redis/BullMQ
  worker not yet provisioned (Phase 5/26) — this does not fabricate a cron.
- The deterministic weighted score is deliberately **not** marketed as a
  predictive ML model (see §5).