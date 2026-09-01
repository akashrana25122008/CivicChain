# Phase 24 — Final User Flows & End-to-End Workflow

Completes the Phase 11 roadmap's final layer: the last citizen-facing flows
(promise tracking, verification, community feedback, escalations), the community
verification & voting loop on resolved reports, authority-facing escalation
notifications, the full admin toolset (audit explorer, department creation, user
lifecycle deactivation), an honest storage health probe, and a sweep of data
integrity fixes across dashboards so nothing on screen fabricates numbers.

## Approach

Audit-first: every Phase 22 dashboard placeholder and every Phase 24 roadmap
commitment was inventoried (fake data, unused props, dead client code). Then
APIs → real SWR pages → serializer contract → notifications → admin tooling →
data-integrity fixes → verification, keeping all existing API contracts intact
where the roadmap did not require a new one.

## 1. Citizen Self-Service APIs + Pages

Four new authenticated citizen APIs, each backed by real queries:

- **`GET /api/my-promises`** — the citizen's promises with live SLA standing
  (`calculateSlaState` per promise, true deadline + time remaining) and derived
  stats (total / onTrack / atRisk / breached / resolved / `sampledAt`).
- **`GET /api/my-verifications`** — the citizen's RESOLVED reports with
  `verificationState` (PENDING | VERIFIED) surfaced from the real
  `Evidence.verifications` rows, `resolvedAt`, and stats.
- **`GET /api/community/feedback`** — global per-issue vote rollups
  (CONFIRM/SUPPORT/DISPUTE counts + percentages), global stats, and `null`
  percentages when no votes exist (no fake zeros).
- **`GET /api/my-escalations`** — escalations on the citizen's own reports via
  the `issue.reporterId` filter, with stats (total / open / byLevel 1–4). The
  drawer links use the DB issue id (not publicId).

Pages rewritten from static mockups to real SWR feeds (30s refresh):
`/dashboard/promises`, `/dashboard/verification`, `/dashboard/community`,
`/dashboard/escalations`.

## 2. Verification & Community Voting Loop

Contract (`src/lib/issues/types.ts`): `IssueDetail.canVerify` (viewer is the
reporter AND lifecycle is RESOLVED) and `IssueDetail.voteSummary`
({confirm, dispute, support, duplicate, total}).

- `serializeIssueDetail` computes both; new tests lock the shapes.
- `votes` are included in every issue-detail feed (api/issues/[id],
  my-reports/[id], `src/lib/issues/http.ts`).
- **`POST /api/issues/[id]/votes`** (`{ type: CONFIRM|SUPPORT|DISPUTE|DUPLICATE }`).
  Server blocks voting on your own report (403 FORBIDDEN) — the UI reveals
  counts to owners but hides the cast buttons.
- Reporters of a RESOLVED report can **confirm or dispute** the resolution
  (`POST /api/issues/[id]/verify`), driving the real `VERIFIED` lifecycle;
  `RESOLUTION_PRECONDITIONS` is `[IN_PROGRESS]` on the RESOLVED edge.
- `IssueDetailView` gains Verify/Dispute and vote-cast controls with busy/error
  state; a "Resolution Confirmation" card appears for owners of RESOLVED issues
  and a "Community Verification" card shows live votes to everyone else.
- Removed the duplicate resolve `createNotification` — the transition engine
  already emits `STATUS_CHANGED` with dedupe key.

## 3. Notifications

- **`AUTHORITY_ASSIGNED`** — emitted on assignment: in `create.ts` (after the
  promise is ensured) and in the AI routing analysis only when the authority
  actually changed. Dedupe key `AUTHORITY_ASSIGNED:<issueId>:<authorityId>`,
  notify the authority's userId, failures swallowed.
- **Escalation authority notifications** — the escalation engine records a
  notification for the authority of the escalated issue
  (`ESCALATION:<id>:authority`), and the manual escalate API also notifies the
  authority when the actor is not themselves the authority.

## 4. Admin Tooling

- **Audit explorer** (`/api/admin/audit` + `/admin/audit`) — action filter
  (validated against `Object.values(AuditAction)`, `ALL` passthrough), cursor
  pagination keyed on `seq` (cursor + `skip: 1`), limit 1–200 default 50, a
  **true** total via `count({ where })`, plus `nextSeq`/`actions` for the UI.
  The page has an action dropdown and prev/next history-stack navigation.
- **Department creation** (`POST /api/admin/departments`) — creates a
  `Department` and optionally a linked `Authority` (name/email); 409
  `DEPARTMENT_EXISTS` on conflict; `parseStr` validation. Create form added to
  `/admin/departments`.
- **User lifecycle** — `User.active` (default true) + `AuditAction`
  `USER_DEACTIVATED`/`USER_REACTIVATED`. `getSessionUser` returns null for
  inactive users (single server-side choke point; existing JWTs remain valid at
  the edge but every authorization flows through it). `PATCH /api/admin/users`
  gains `deactivate`/`activate` with `SELF_ACTION` + `ALREADY_INACTIVE` /
  `ALREADY_ACTIVE` guards and audit records; the users page shows an
  Active/Deactivated badge + toggle per row.
- **Health storage probe** — `probeStorageHealth()` (real `HeadBucketCommand`
  for S3, dir-create/list for local) wired into `/api/admin/health`.
- **Stats** — `/api/admin/stats` counts departments; the Departments StatCard
  uses the real number.
- **Map label source** — new `src/lib/city.ts` (`REGION_CITY`) is the single
  source for the map center and department labels; `IssueMap` + dashboard
  `queryLabel`s use it.

## 5. Data-Integrity Fixes

- **`RiskEngine`** — neutral defaults (score/level/ward/trend/confidence null,
  `hasData = score != null`, renders '—' / 'No data' / 'No ward data yet').
  `CitizenDashboard` now wires real `/api/risk/summary`: level derived from
  `averageRiskScore` (≥75 CRITICAL / ≥50 HIGH / ≥25 MEDIUM / else LOW), ward
  from the top hotspot, trend from `overallTrend` (`INCREASING`/`DECREASING`/`STABLE`
  vocabulary); no-data case renders the neutral state instead of a fake LOW.
- **Karma label** — dashboard card now reads "real balance, earned and
  auditable" instead of "reputation engine arrives later".
- **IssueDrawer action props** — the command-center drawer and admin issues list
  were read-only; both now pass the capability props (`canUpdateStatus`,
  canVerify, canEscalate where the department scoping allows).
- **Command-center SLA badges** — the queue rendered invalid badge keys
  (`on_track`, `at_risk`, `breached` → default color); now mapped through the
  canonical vocabulary (`onTrack` / `atRisk` / `brokenPromise`).

## 6. Schema + Migration

- `User.active Boolean @default(true)`; `AuditAction` gains
  `USER_DEACTIVATED` / `USER_REACTIVATED`.
- `prisma/migrations/20260901093000_phase24_user_active/migration.sql` (12th
  migration) — `migrate deploy` applied cleanly, client regenerated (7.10.0).

## Files

- Citizen APIs + pages: `src/app/api/my-{promises,verifications,escalations}`,
  `src/app/api/community/feedback`, `src/app/dashboard/{promises,verification,
  community,escalations}/page.tsx`
- Community loop: `src/lib/issues/{types,serialize,http}.ts`,
  `src/components/issues/IssueDetailView.tsx`,
  `src/app/api/issues/[id]/{verify,votes}/route.ts`
- Notifications: `src/lib/issues/create.ts`,
  `src/lib/server/intelligence/ai/analysis.ts`,
  `src/lib/escalation/engine.ts`,
  `src/app/api/issues/[id]/escalate/route.ts`
- Admin: `src/app/api/admin/{audit,departments,users,health,stats}/route.ts`,
  `src/app/admin/{audit,departments,users,dashboard}/page.tsx`
- Integrity: `src/lib/city.ts` (new), `src/lib/server/storage.ts`,
  `src/components/dashboard/{RiskEngine,CitizenDashboard,IssueDrawer}.tsx`,
  `src/app/department/command-center/page.tsx`, `src/app/admin/issues/page.tsx`
- Schema: `prisma/schema.prisma`,
  `prisma/migrations/20260901093000_phase24_user_active/migration.sql`
- Tests: `src/lib/issues/__tests__/serialize.test.ts` (+3)

## Verification

- `tsc --noEmit` → clean
- `npm test` → **172 pass** (3 new this phase, baseline 169)
- `eslint` → 0 errors from changed files (pre-existing `RiskEngine`
  set-state-in-effect + unused-var warnings, `Card/Avatar/Button/CivicMapInner`
  + `.claude/skills` violations left untouched as established)
- `npm run build` → production build success
- `prisma migrate diff --from-migrations … --to-config-datasource --exit-code`
  → **no difference** (no drift)
- **Live smoke** (dev server against Postgres, real magic-link log in as
  CITIZEN / AUTHORITY / ADMIN):
  - `my-promises` / `my-verifications` / `community/feedback` / `my-escalations`
    → real rows; `risk/summary` → 12 areas, avg 13, INCREASING +100%
  - verify as reporter → 200; self-vote → 403 FORBIDDEN; third-party vote →
    201 + voteSummary reflected in the detail
  - admin audit: action filter (33 STATUS_CHANGED), cursor page 2 seqs, invalid
    action → 400; citizen on admin api → 403
  - users: deactivate → 200 + audit `USER_DEACTIVATED`; repeat → 400
    `ALREADY_INACTIVE`; activate restores
  - departments POST duplicate → 409 `DEPARTMENT_EXISTS`; stats → departments:5
  - department command-center + drawer feed (real KPIs, allowedTransitions
    RESOLVED/REJECTED, evidence, voteSummary)
  - `/api/admin/health` → storage probe ok (local), PostGIS 3.6, DB ok,
    overall DEGRADED (email/AI/redis/queue/websocket honestly NOT_CONFIGURED)
- `AUTHORITY_ASSIGNED` / escalation-authority notifications are event-driven
  (issue creation / new escalation); code is typechecked, but the existing demo
  rows predate the change so no historical instances exist to smoke.