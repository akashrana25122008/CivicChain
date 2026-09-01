# Phase 22 — Observability Implementation Report

Production-grade observability for CivicChain: structured JSON logging (pino),
request-id correlation propagated through the full request lifecycle, per-route
latency timing, slow-query detection, AI latency telemetry, notification
delivery metrics, and public + admin health/metrics endpoints.

## Approach

The pre-Phase 22 codebase had partial observability: a hand-rolled structured
access logger (`requestLog.ts` from Phase 21), a proxy-level duration log, a
stats/analytics stack (Phase 19), and an ADMIN health probe
(`/api/admin/health`). Phase 22 fills the gaps: it unifies logging behind a
structured logger, **propagates the request id into route handlers and database
queries** (the Phase 21 proxy generated an id but never passed it downstream),
adds timing + slow-query telemetry, and exposes dedicated observability
endpoints.

## 1. Structured JSON Logging (`src/lib/server/logger.ts`)

Replaced all ad-hoc `console.*` logging with **pino** (JSON lines) + **pino-pretty**
(readable output in dev):

- `LOG_LEVEL` controls verbosity (`silent | fatal | error | warn | info | debug`);
  defaults to `info` in production, `debug` in development.
- Every line carries a `service: "civicchain"` base field.
- A `requestLogger(requestId)` helper produces a child logger bound to a request id.

All prior `console.*` call sites were migrated: `api.ts` error handler,
`email/notification.ts`, `email/magic-link.ts`, `security/fileScan.ts`,
`security/requestLog.ts`, `api/auth/register/route.ts`.

## 2. Request-Id Correlation (`src/lib/server/requestContext.ts`)

- **AsyncLocalStorage** propagates `{ requestId, logger, startedAt, ip, userId, role }`
  through the entire async call stack of a request.
- The proxy (`src/proxy.ts`) generates the request id and writes it into the
  incoming `x-request-id` header, so the downstream route handler re-establishes
  the **same** id (verified live: access log and route-timing lines share one id).
- Handlers call `getRequestContext()` / `currentRequestId()` / `currentLogger()`
  to log with full correlation without threading parameters through every function.

## 3. Route Timing (`src/lib/server/timing.ts`)

A `withRequest(handler)` wrapper establishes the request context **and** measures
handler execution:

- > 5 s → `error`, > 2 s → `warn` ("very slow" / "slow"), 5xx → `error`, 4xx → `warn`,
  2xx → `debug` (avoiding production noise).
- Applies to the primary data-path handlers: issues list/detail/create, reports,
  department issues + command center, admin command center, health, metrics.

## 4. Slow-Query Detection (`src/lib/server/prismaMonitor.ts`)

- Wires Prisma's `$on('query')` event (enabled via `log: ['query', 'warn', 'error']`
  in `db.ts`).
- Queries **>= 200 ms → warn**, **>= 1 s → error**, each tagged with the request id
  and the query snippet (truncated to 200 chars) for tracing to source.

## 5. AI Latency Telemetry (`src/lib/server/intelligence/ai/client.ts`)

`chatCompletionWithRetry` now times each attempt and logs it through the
request-scoped logger: `ai:true`, `model`, `durationMs`, `attempt`, `ok`. Failures
log at `warn` with the same fields, so AI latency + error rate are visible in the
log stream and aggregated in the metrics snapshot.

## 6. Operational Metrics (`src/lib/server/observability/metrics.ts` + `/api/admin/metrics`)

`getOperationalMetrics()` computes a live 24-hour snapshot:

- **Notifications** — total, EMAIL/PUSH delivery records, delivery rate (surfaced
  honestly as unconfirmed when no provider ACK, consistent with the health check).
- **AI** — total runs, failures, error rate, **mean + p95 latency** (from
  `AIAnalysis.startedAt`/`completedAt`).
- **Errors** — AI-analysis-failure audit entries.
- **Requests-estimate** — issues created / status-changed in the window.

Exposed as `GET /api/admin/metrics` (ADMIN-only, via `withRequest` + RBAC).

## 7. Public Health Probe (`/api/health`)

A lightweight, **unauthenticated** liveness endpoint for uptime checkers / load
balancers / orchestrators: `SELECT 1` DB connectivity; 200 `{status:"ok"}` when
healthy, 503 when not. Added to the proxy matcher so it also receives security
headers + rate limiting, while intentionally staying out of the auth-required set.

## Files

- `src/lib/server/logger.ts` — pino structured logger + `requestLogger`
- `src/lib/server/requestContext.ts` — AsyncLocalStorage context + helpers
- `src/lib/server/timing.ts` — `withRequest` context+timing wrapper
- `src/lib/server/prismaMonitor.ts` — Prisma slow-query logging
- `src/lib/server/observability/metrics.ts` — metrics aggregation
- `src/lib/server/__tests__/requestContext.test.ts`, `timing.test.ts` — unit tests
- `src/app/api/admin/metrics/route.ts` — ADMIN operational metrics endpoint
- `src/app/api/health/route.ts` — public liveness probe
- `src/proxy.ts` — request-id propagation into `x-request-id` header; `/api/health` matcher
- `src/lib/db.ts` — enabled Prisma query events for the monitor
- `src/lib/server/api.ts`, `email/*`, `security/fileScan.ts`, `security/requestLog.ts`,
  `api/auth/register/route.ts` — migrated to structured logging
- `src/lib/server/intelligence/ai/client.ts` — AI latency telemetry
- Wrapped high-traffic handlers in `withRequest`: issues, reports, department,
  admin routes
- `package.json` — `pino`, `pino-pretty`
- `.env.example` — observability documentation

## Verification

- `tsc --noEmit` → clean
- `eslint` (changed files) → 0 errors, 0 warnings
- `npm test` → **161 pass** (6 new: 3 request-context, 3 timing)
- `npm run build` → production build success (proxy included)
- **Live smoke** (`/api/health`, dev server): 200 `{status:"ok"}` with security
  headers + `x-request-id`; pino structured access + route-timing lines observed in
  the dev log sharing the same `requestId` (correlation confirmed); `/api/admin/metrics`
  correctly 401-gated without auth.
