# Phase 23 — Database Model Finalization

Finalizes the Phase 11 roadmap's data model: promotes the ad-hoc `department`
string on `Authority` into a **first-class `Department` entity**, renames the
`AuditLog` table to **`AuditEvent`** (aligning the codebase's naming everywhere),
adds integrity **CHECK constraints** across the schema, and introduces a
registry-backed **department seeding + routing** source of truth so dev data and
production routing can never silently disagree.

## Approach

The roadmap finalization phase touches every layer, so the work was sequenced as
schema → data-preserving migration → code → tests:

1. **Audit** — full inventory of `AuditLog` (22 files) and `Authority.department`
   (34 files) usage across routes, serializers, analytics, and UI.
2. **Schema** — `Department` model; `Authority`/`Issue`/`Promise.departmentId` FKs;
   `AuditLog` → `AuditEvent`.
3. **Data-preserving migration** — hand-written (Prisma 7 `migrate dev` is
   interactive-only) and applied against the live Postgres with backfills, a
   table rename, and non-zero-downtime-safe CHECK constraint additions.
4. **Code** — renamed the relation everywhere, decentralized the department
   lookups through the new relation, and kept every existing API contract intact.
5. **Integrity tests** — locked the mapping↔registry congruence and the new
   serializer shapes so future refactors cannot drift.

## 1. Schema Changes (`prisma/schema.prisma`)

- **`Department` model** (new): `id`, `name` (unique, the routing key), `jurisdiction`,
  timestamps. `Department` is the canonical owning entity the new `departmentId`
  FKs reference.
- **`Authority`** — dropped scalar `department String?`; added
  `departmentId String?` + `department Department?` relation
  (`onDelete: SetNull`) + `@@index([departmentId])`.
- **`Issue`** — added denormalized `departmentId` + relation + index
  (hot list queries avoid a join to `authority.department`).
- **`Promise`** — added the same denormalized `departmentId` + relation + index.
- **`AuditLog` → `AuditEvent`** — model renamed; `User.auditLogs` / `Issue.auditLogs`
  back-relations renamed to `auditEvents`. `authorityId` FKs on Issue/Promise/
  Escalation are unchanged (Authority stays the operating entity linked to a
  Department).

## 2. Migration (`20260901090000_phase23_model_finalization`)

Written by hand (Prisma 7 `migrate dev --create-only` is interactive-only). Because
Prisma Postgres does not wrap a `migrate deploy` in a transaction, the first apply
failed mid-way after the table+column work and had to be completed manually; the
migration SQL in the directory is the **canonical, fixed** version that replays
cleanly on a fresh database.

Steps:

- Rename `AuditLog` → `AuditEvent` (table, all indexes, constraints) — **103 existing
  rows preserved**.
- Create `Department`; **backfill the 5 canonical departments** from the
  pre-existing `Authority.department` strings (IDs via `gen_random_uuid()::text`).
- `Authority`: add `departmentId`, backfill every authority's department,
  drop the old `department` column.
- `Issue.departmentId` (29 backfilled) + `Promise.departmentId` (4 backfilled) —
  batch-updated from each row's authority.
- **CHECK constraints** (6): `Issue_priority_range` (0-100),
  `Issue_latitude_range` (-90..90), `Issue_longitude_range` (-180..180),
  `AIAnalysis_confidence_range` (0-1), `Escalation_level_range` (1-4),
  `AuditEvent_seq_positive` (>0).

State after apply: `prisma migrate status` = "up to date" (12 migrations);
`prisma migrate diff --from-migrations … --to-config-datasource --exit-code` =
**no difference** (no schema drift). DB backup taken beforehand at
`/tmp/civicchain_pre_phase23_backup.sql`.

## 3. Department Registry + Seeding

- **`src/lib/server/departments/registry.ts`** — the canonical `DEPARTMENTS` list
  (single source of truth). `prisma/seed.ts` now imports it instead of
  duplicating the names, and seeds `Department` rows before wiring
  `Authority.departmentId` (idempotent: finds authorities by the seeded name and
  patches missing links).
- Seeded `Issue`/`Promise` rows now carry `departmentId` so a fresh database is
  consistent with the live backfill.

## 4. Code Changes

**AuditLog → AuditEvent** (relation + raw-SQL table + response shapes):

- `src/lib/server/ledger.ts`, `src/lib/server/observability/metrics.ts`,
  `src/lib/server/metrics.ts`, `src/lib/server/landing.ts`,
  `src/app/api/admin/health/route.ts`, `src/app/api/admin/stats/route.ts`,
  `src/app/api/admin/audit/route.ts` (`AuditEventItem`),
  `src/app/api/department/summary/route.ts`,
  `src/lib/server/analytics/resolution.ts` (raw SQL),
  `src/app/api/admin/departments/route.ts` (raw SQL).
- `src/lib/issues/serialize.ts` — `AuditEvent`-based timeline + the `authority`
  label now prefers `authority.department?.name`. **Fixed a precedence bug** the
  new tests caught: department label must win over `authority.name` when the
  relation is loaded.
- `src/lib/issues/types.ts` — `AuditLogItem` → `AuditEventItem`;
  importers updated (`src/app/admin/audit/page.tsx`,
  `src/app/admin/dashboard/page.tsx`).
- All issue-detail include sets (`http.ts`, `issues/[id]`, `my-reports/[id]`,
  `department/issues/[id]`, list feed in `query.ts` + `my-reports/route.ts`)
  now load `authority → department` in a **single batched join** (no N+1).

**Department wiring**:

- `src/lib/issues/create.ts` + `src/lib/server/intelligence/ai/analysis.ts` —
  routing now resolves through `where: { department: { name } }` and records the
  authority's `departmentId` on the issue ("hot-lookup" denormalization).
- `src/lib/server/dept.ts` — `OwnAuthority` includes `department`.
- `src/lib/server/department/commandCenter.ts` + route — `authority.department`
  is the department name string.
- `src/lib/server/admin/commandCenter.ts` + route — department-aware escalation
  labels; `kpis.departments` now counts real `Department` rows (same numeric
  contract the UI already expected).
- `src/app/api/admin/users/route.ts` — creating a new authority now upserts a
  `Department` and links `departmentId`; department projections everywhere.
- `src/lib/server/analytics/{issues,department,sla}.ts` +
  `src/app/api/admin/analytics/route.ts` — label resolution from the relation.
- `src/lib/sla/promise.ts` — `ensurePromiseForIssue` copies `departmentId`.

**API contract preserved**: every route that returned a `department` string
returns the same value via `authority.department?.name` (post-backfill identical),
so no frontend page needed changes for the rename.

## Files

- `prisma/schema.prisma` — `Department`, `AuditEvent`, `departmentId` wiring
- `prisma/migrations/20260901090000_phase23_model_finalization/` —
  `migration.sql` (canonical) + `remainder.sql` (manual completion of first apply)
- `prisma/seed.ts` — department seeding from the registry + `departmentId` wiring
- `src/lib/server/departments/registry.ts` — canonical department list
- `src/lib/issues/mapping.ts` — unchanged mapping, now tested against the registry
- `src/lib/issues/serialize.ts`, `http.ts`, `types.ts`, `query.ts`, `create.ts`
- `src/lib/issues/__tests__/departmentIntegrity.test.ts` — routing↔registry congruence
- `src/lib/issues/__tests__/serialize.test.ts` — authority/department + timeline shapes
- All API routes and analytics/command-center services listed above

## Verification

- `tsc --noEmit` → clean
- `npm test` → **169 pass** (8 new this phase, baseline 161)
- `eslint` → 0 errors / 0 warnings from changed files (pre-existing
  `Card/Avatar/Button/CivicMapInner` + `.claude/skills` violations untouched)
- `npm run build` → production build success
- `prisma migrate status` → up to date; `migrate diff --exit-code` → no drift
- `npx prisma db seed` → idempotent on the live database
- **Live smoke** (server-side against Postgres): 5 departments; 5/5 authorities
  linked; 103 `AuditEvent` rows; 30-issue list resolves department labels
  (`CC-1119 → Roads & Infrastructure Department`, unassigned `CC-1118 → null`);
  POTHOLE routing resolves to authority + `departmentId`; detail serializes
  timeline from `auditEvents`; admin command center `kpis.departments: 5`;
  department command center resolves the operator's department name; all 6 CHECK
  constraints + `Department`/`AuditEvent` tables present.