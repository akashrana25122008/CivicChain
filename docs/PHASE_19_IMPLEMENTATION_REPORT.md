# Phase 19 — Analytics Engine Implementation Report

A centralized Analytics Service for CivicChain that consolidates every metric
family around a single, unified time window and a single authenticated entry
point. It replaces scattered ad-hoc aggregates with one reproducible
computation — never fabricated, always derived from live database data.

## Approach

- **One service, one window.** Every metric module consumes the same
  `RangeWindow` (`7d / 30d / 90d / all`) produced by `range.ts`. This means
  issue, resolution, SLA, duplicate, verification, escalation, department,
  ward-risk, satisfaction and AI numbers all describe the exact same period —
  no per-route drift.
- **Reuse over reinvention.** The new engine builds on the existing
  `/api/admin/analytics` surface and the Phase 11 risk engine rather than
  duplicating them. Ward-risk metrics call `fetchRiskSummary`/`fetchHotspots`
  from `src/lib/risk/` unchanged; resolution+SLA timings reuse the audit-log
  derivation pattern first established in `src/lib/server/metrics.ts` and the
  shared SLA evaluator in `src/lib/sla/state.ts`.
- **Honest when there is no data.** Every family degrades to `null` / `0`;
  nothing is invented. With no AI provider configured the AI family reports
  `completed: 0` and `categoryAccuracyPct: null`, matching the project's real
  analysis pipeline.
- **Deterministic intelligence.** Anomalies and insights are pure functions
  over the computed metrics (`insights.ts`) with explicit thresholds — no
  hidden randomness, no LLM calls.
- **Admin-only RBAC** is enforced on the new consolidated route before any
  computation.

## Architecture

```
src/lib/server/analytics/
  types.ts       shared metric vocabulary + aggregate payload types
  range.ts       time-range normalization (RangeWindow, prev-window, where)
  issues.ts      issue volume / status / category / department / over-time
  resolution.ts  resolution rate, avg resolution + first-response, reopen rate
  sla.ts         ON_TRACK / AT_RISK / BREACHED distribution + per-dept
  duplicate.ts   duplicate coverage %, cluster sizes, avg reports/incident
  verification.ts verification funnel + avg custody time
  escalation.ts  escalation volume, per-level, resolution %, avg per issue
  department.ts  per-department performance ranking (issues/rate/time/backlog)
  wardRisk.ts    adapts the Phase 11 risk engine into the metric shape
  satisfaction.ts community votes (confirm/support/dispute/duplicate) + karma
  ai.ts          AI completion, confidence, category accuracy
  insights.ts    anomaly detection + narrative insights (deterministic)
  index.ts       computeAnalytics(range) aggregate entry + re-exports
```
```
GET /api/admin/analytics/engine?range=30d   (ADMIN-only, validated server-side)
        └─▶ computeAnalytics(range)
               └─▶ 10 metric modules (Promise.all) ─▶ anomalies + insights
                                                    ─▶ AnalyticsPayload JSON
```
`src/app/admin/analytics/page.tsx` now renders the engine payload: a range
selector (7d/30d/90d/All), consolidated metric stat cards, insight + anomaly
panels, a department-performance table and a ward-risk top-areas table, on top
of the existing fixed 30-day charts.

## Metric families delivered

| Family | Key outputs |
| ------ | ----------- |
| Issues | totals (all/active/resolved/rejected), by-status/by-category/by-dept, zero-filled daily series, volume trend |
| Resolution | resolution rate %, avg resolution min, avg first-response min, reopen count + rate, trend |
| SLA | on-track/at-risk/breached counts, breach rate %, per-department breakdown |
| Duplicate | coverage %, cluster-size distribution, avg reports/incident, linked reports |
| Verification | pending/verified/rejected, verification rate %, avg custody time |
| Escalation | total/active/resolved, per-level, avg per issue, resolution % |
| Department | ranked by volume + resolution rate/avg time/active backlog/breaches |
| Ward risk | area counts by risk level, avg risk score, top hotspot areas |
| Satisfaction | vote breakdown, net positive share, karma awarded |
| AI | completion stats, avg confidence, category-accuracy % |

## How it was verified

- `npx tsc --noEmit` — clean.
- `npx eslint` — clean (no errors or warnings).
- `npm test` — **127 / 127 pass** (added 20 tests: 8 range + 12 insights).
- `npx next build` — exit 0; `/admin/analytics` and
  `/api/admin/analytics/engine` compiled successfully.
- Live Postgres smoke test — `computeAnalytics('30d')` returned real, coherent
  numbers for all ten families (e.g. duplicate coverage 53.33% across 4
  incidents; department ranking headed by Roads & Infrastructure; SLA breach
  rate from active promises; AI accuracy honestly `null` with no provider).

## Notable fixes during implementation

- **Cross-enum comparison bug:** `AICategory` and `IssueCategory` are distinct
  Postgres enums, so `a.category = i.category` raised `42883`. Cast both sides
  to `::text` (same pattern as the Phase 18 ledger back-fill) for the AI
  accuracy check.
- **Type-safe status predicates:** escalation status filters use the generated
  `EscalationStatus` enum instead of ad-hoc strings.

## Files

- `src/lib/server/analytics/` — the service (types, range, 10 metric modules,
  insights, aggregate entry) + `__tests__/range.test.ts`, `__tests__/insights.test.ts`.
- `src/app/api/admin/analytics/engine/route.ts` — ADMIN-only, range-validated API.
- `src/app/admin/analytics/page.tsx` — extended analytics UI (engine sections).
