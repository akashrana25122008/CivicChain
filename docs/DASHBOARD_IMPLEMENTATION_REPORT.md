# §26 — Dashboard Implementation Report

Role-scoped dashboards (Citizen / Department / Admin), built entirely on real
PostgreSQL + PostGIS data via Prisma. Commit: `29c4ee3`.

## Scope delivered

| Area | What exists | Location |
| ---- | ----------- | -------- |
| Citizen dashboard | Greeting, 6 KPIs, my-reports, timeline, quick actions, map preview, civic updates | `src/app/dashboard/page.tsx` (server wrapper) + `src/components/dashboard/CitizenDashboard.tsx` |
| Community report map | Live MapLibre map of all reports with coordinates, derived-status legend | `src/app/dashboard/map/page.tsx`, `src/components/dashboard/IssuesMap.tsx` |
| Department dashboards | KPI board (+7), activity feed, issues workbench (filter/search/sort/pagination) | `src/app/department/dashboard|issues/page.tsx` |
| Verification queue | Pending/verified evidence, verify/reject with notes | `src/app/department/verification/page.tsx`, `POST /api/department/verification` |
| Escalation management | Open escalations, start/close with reason, history | `src/app/department/escalations/page.tsx`, `PATCH /api/department/escalations/[id]` |
| Department performance | KPI summary, status/category views, 14-day trend | `src/app/department/performance/page.tsx`, `GET /api/department/performance` |
| Admin overview | Extended stats, service health, department snapshot, recent audit | `src/app/admin/dashboard/page.tsx` |
| Admin management | Users, departments (with OPEN escalation indicator), issues (read-only drawer) | `src/app/admin/{users,departments,issues}/page.tsx` |
| Admin analytics | Recharts: status, category, over-time, role, department | `src/app/admin/analytics/page.tsx` |
| Audit & health | Raw audit log; DB/PostGIS/auth/storage/dpa uptime | `src/app/admin/{audit,health}/page.tsx` |

Shared component kit: `PageHeader`, `StatCard`, `TableFrame` (+ `Pagination`),
`LoadingBlock`, `EmptyState`, `ErrorState`, `IssuesMap` (+ `IssuesMapInner`,
SSR-safe dynamic import), `IssueDrawer` (detail drawer; departmental verify /
escalate / status action buttons; read-only for admin).

## Data policy

- No mock or fabricated business data anywhere in the dashboards. Every number
  is a serialized Prisma aggregation over the real database.
- Loading (skeleton), empty (`EmptyState`) and error (`ErrorState` + retry)
  states cover every data site.
- Honest metric derivation, e.g. `awaitingVerification` =
  `evidence.count({ where: { issue: { <role scope> }, verifications: { none: { status: 'VERIFIED' } } } })`;
  escalation audit via `STATUS_CHANGED` on `Escalation` with `{from,to,level}`
  metadata; map legend derived from the live returned statuses.
- KPIs with no data render "Insufficient Data"; non-implemented capabilities
  stay as "Coming soon", never simulated.

## RBAC & routing

- Server-side enforcement in `src/proxy.ts` (middleware) + layouts; every API
  route re-checks the role via `requireRole`.
- Gating verified by smoke test:
  - Anonymous → APIs `401`, pages `307 → /login`.
  - CITIZEN → admin/dept APIs `403`; `/department/dashboard` redirects to `/dashboard`.
  - AUTHORITY → admin APIs `403`; `/dashboard` redirects to `/department/dashboard`;
    departmental data is scoped to the operator's authority.
  - ADMIN → `/department/*` redirect to `/admin/dashboard`.
- Write endpoints validate bodies before mutating (bad status / evidence /
  escalation payloads → `400`, no DB change).

## Supporting changes

- `IssueListItem` (type + serializer) now carries parsed `latitude` / `longitude`
  so maps and drawers never reparse WKB.
- Generated Prisma client import depth standardized
  (`../../../../../generated/prisma/client` from `src/app/api/*` route files;
  `../../../generated/prisma/client` from `src/lib/*`).
- MapLibre v6 named imports (ESM-only, no default export) + `maplibre-gl.css`.
- Recharts 3.10.1 for analytics.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — 60 problems (37 errors / 23 warnings), within the ≤62 budget.
- `npm run build` — green; all role routes emitted.
- Auth-gated smoke test (dev magic-link) across all three roles: every API 200
  with plausible real aggregates, every role page 200, cross-role gates redirect
  correctly, write validation 400 without mutation.

## Known limits (unchanged, honest)

- No geocoder on intake yet — report coordinates are as-entered; list/map show
  only rows that have coordinates.
- `/api/issues` list defaults to `pageSize: 100`; the map aggregates the loaded
  page rather than a full-DB scan.