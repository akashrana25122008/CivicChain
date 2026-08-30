# §49-contract — Phases 3 & 4 Implementation Report

Real AI intelligence (Phase 3) + duplicate detection & priority engine (Phase 4)
on the CivicChain report pipeline.

Everything in these phases is real and server-side: AI classification is a live
call to an OpenAI-compatible model (or an **honest `FAILED`** when one is not
configured), duplicate detection uses five real signals with incident
clustering, and priority is a transparent formula over real report data. No
`setTimeout`, no fake scores, no hardcoded verdicts.

## Approach

- **Three independent engine packages** under `src/lib/server/intelligence/`
  (AI, duplicates, priority) with explicit, no-dependency contracts between
  them; none of them import each other's internals — `pipeline.ts` is the only
  orchestrator that touches all three.
- **No queue hard dependency:** analysis is kicked via `after()` from
  `next/server` after the HTTP response, and a **resume-on-read guard**
  (`ensureReportIntelligence`) re-runs any non-terminal analysis whenever its
  issue detail is requested — the pipeline always converges to a terminal state
  even across process restarts.
- **Provider-agnostic AI:** `ai/client.ts` speaks OpenAI-compatible
  `/v1/chat/completions` only, configured by env (`AI_BASE_URL`, `AI_API_KEY`,
  `AI_MODEL`). No key ⇒ `failAnalysis` records `FAILED` with an explanatory
  message — the exact behavior a real outage would produce.
- **No pg_trigram:** the Homebrew PostgreSQL 17.11 install lacks the extension,
  so text similarity is computed in TypeScript as trigram-overlap (Dice
  coefficient) over a bounded candidate set instead of a DB operator.
- **Configurable thresholds/weights** in `intelligence/config.ts`, all
  env-overridable (see `.env.example`), with the spec defaults.

## Architecture

```
POST /api/reports ──(shared handler)──▶ $transaction: Issue + Evidence + Audit
                                             │ + AIAnalysis row (status=PENDING)
                                             ▼
                            201 { issue, analysisStatus:'PENDING', duplicate }
                                            │
   after() ──▶ runReportIntelligence()      │  (synchronous, non-blocking)
                  ├─ hashEvidenceImages()    │  duplicate sweep ──▶ Incident?
                  ├─ runAiAnalysis()         │  storePriorityForIssue()
                  │    PENDING→PROCESSING    ▼
                  │    →COMPLETED | FAILED   Issue.priority / priorityLevel
                  ├─ assignIncident(allowReassign)
                  └─ storePriorityForIssue()

GET /api/reports/[id] ──▶ includes aiAnalysis + incident + priorityBreakdown
                         └─ after(): ensureReportIntelligence()  (resume-on-read)
```

Duplicate detection is **never a blocker**: `evaluateDuplicate` returns a
verdict (`probably_new` / `possible` / `strong`). `possible` is surfaced as a
warning; only `strong` (≥ 0.70 by default) groups reports into an `Incident`
with a `CC-INC-<seq>` public id. The synchronous 60 s same-reporter window
guard stays unchanged.

## DB schema & migrations

Migration `20260830074217_phase34_intelligence` (hand-trimmed: the generated
pg_trigram extension/trigram index were dropped because the local PostgreSQL
lacks pg_trigram, and the generated `DROP DEFAULT` on the PostGIS column was
removed).

- New enums: `AICategory`, `AISeverity`, `SafetyRisk`, `InfrastructureType`,
  `AIAnalysisStatus` (`PENDING/PROCESSING/COMPLETED/FAILED`), `PriorityLevel`
  (`LOW/MEDIUM/HIGH/CRITICAL`).
- `AuditAction` += `AI_ANALYSIS_COMPLETED`, `AI_ANALYSIS_FAILED`,
  `INCIDENT_ASSIGNED`.
- `Issue` += `incidentId` (FK `SetNull`), `incidentMatch Json?` (the winning
  verdict: incident id, confidence, band, distance, signals), `priorityLevel`,
  indexes.
- `Evidence` += `perceptualHash TEXT?` — 16-char hex dHash written after
  upload.
- New `AIAnalysis` (`unique issueId`, FK cascade, status, category, severity,
  confidence, safetyRisk, infrastructureType, reasoningSummary, modelName,
  errorMessage, startedAt, completedAt).
- New `Incident` (`unique publicId CC-INC-*`, title, category, status,
  severity, priority, priorityLevel, `issues` relation). Public-id counter
  reuses `RefCounter` row `id=2` starting at 1000.

`prisma migrate dev` can hang in the shadow-DB phase in this environment; the
replacement flow is `prisma generate` / `migrate deploy`.

## Engines (all under `src/lib/server/intelligence/`)

### AI analysis (`ai/`)
- `client.ts` — retries with real backoff (300 ms + attempt × 300 ms), hard
  timeout (`AI_TIMEOUT_MS`), `AiServiceError`.
- `analysis.ts` — computes a strict-shape expectation, validates the model
  output with zod, persists a `COMPLETED` or `FAILED` result, guards against
  concurrent/stale runs (90 s), records audits. Optional vision context feeds
  downscaled image thumbnails (≤ 1024 px) to the model.
- `mapping.ts` — AI category → existing `IssueCategory` (department routing
  stays coherent); `Issue.category` is updated after a successful analysis.

### Duplicate detection (`duplicates/`)
- `engine.ts` — spatial candidates from PostGIS `ST_DWithin` on the `geography`
  column (500 m default), plus a recency fallback; five signals:
  geographic (normalized distance), text (trigram Dice), image (best-pair dHash
  Hamming), time (recency decay), category (match). Confidence is a weighted
  mean over **available** signals only; unavailable signals never fabricate
  agreement.
- `cluster.ts` — `assignIncident` joins/reassigns issues to the strongest
  incident and recomputes the incident's aggregated severity/category/priority
  from member quality.

### Priority (`priority/`)
- `computePriorityScore` implements the spec formula faithfully, normalized to
  0–100: severity × 0.30 + reports × 0.20 + population × 0.15 + location ×
  0.15 + safety × 0.10 + evidence × 0.10. Population impact and location
  criticality are **neutral 50 and flagged `unavailable`** whenever the system
  has no data — never invented. Evidence confidence uses a defensible rubric
  (+40 visual, +30 precise GPS ≤ 50 m / +20 coords, +20 ≥ 2 attachments,
  +10 description ≥ 40 chars, cap 100). Bands: 0–49 LOW, 50–69 MEDIUM, 70–89
  HIGH, 90–100 CRITICAL.

## Integration

- `create.ts` — AIAnalysis `PENDING` row inside the create transaction; after
  the transaction: duplicate sweep, interim priority, evidence hashing; create
  response carries `analysisStatus` + `duplicate`.
- `http.ts` — `after()` kicks the full pipeline on create; detail reads run
  `ensureReportIntelligence` and include `aiAnalysis`/`incident`/
  `priorityBreakdown`.
- `serialize.ts`/`types.ts`/`mapping.ts` — serialized AI/incident/priority
  shapes plus client-safe label vocabularies (`AI_CATEGORY_LABELS`,
  `SAFETY_RISK_LABELS`, `INFRASTRUCTURE_TYPE_LABELS`, `PRIORITY_LEVEL_LABELS`,
  `DUPLICATE_BAND_LABELS`).
- UI — the report result card shows the real AI state (`COMPLETED` fields,
  honest `FAILED`, polling `PENDING`), a **Similar Issue Found** panel
  (strong/possible) with a view-existing link and a keep-my-report path, and
  incident/priority summaries; `IssueDetailView` shows classification
  breakdown, priority bars, and the duplicate/incident card. Phase-2
  placeholder copy ("AI severity in Phase 2", "Affected: Phase 2") and the
  hardcoded verification meters were removed.

## Security

- AI credentials (and the new config family) are server-only env vars; nothing
  reaches the browser.
- Vision context is read through the existing private evidence reader and
  downscaled in memory; no new public paths.
- Report/incident joins are ownership/RBAC neutral: no new data exposure —
  lists and detail cloth the same policies as Phase 2.

## Performance

- Hashing and AI calls run post-response (`after()`); evidence hashing is
  also called synchronously after create but bounded per report.
- Spatial duplicate queries are indexed by `Issue.geoLocation` (PostGIS GIST)
  and bounded by radius + lookback + `maxCandidates`.
- The compare set is capped (`DUPLICATE_MAX_CANDIDATES=50`), and trigram
  similarity only runs on reports with descriptions ≥ `textMinLength` chars.

## .env.example / FEATURE_STATUS

- `.env.example` documents `AI_*` (api key/base url/model/timeout/retries/
  vision), `DUPLICATE_*` (radius, lookback, time decay, cap, thresholds, min
  text length) and `PRIORITY_*` (weights + reports cap).
- `FEATURE_STATUS.md` overrides: AI classification / AI severity / duplicate
  detection & merging / priority scoring all move to **WORKING**; background
  processing to **PARTIAL** (after-response + resume-on-read, no queue).

## Verification

Smoke-tested against the live app (reports seeded via `POST /api/reports` with
real image evidence):

1. Create with coords + image → `analysisStatus: PENDING`, verdict surfaced.
2. Near-identical report (same coords, similar title, same category) → verdict
   `strong` @ 0.86–0.89; both reports joined into `CC-INC-1000`; audit shows
   `INCIDENT_ASSIGNED`.
3. Identical-image pair → identical dHashes; confidence rose to 1.0
   (image signal real and non-trivial, hash `66919994a7737383…`).
4. No key configured → `AIAnalysis` records `FAILED` with
   "AI service is not configured (set AI_API_KEY and AI_BASE_URL)." and the
   report + priority (45/LOW, honest `unavailable` components) remain intact.
5. Detail API includes `aiAnalysis`, `incident` (4 members regrouped),
   `priorityBreakdown`; all UI pages (`/report`, `/my-reports`,
   `/dashboard/issues/[id]`) render 200.

The extended automated E2E pass (spec Tests 1–6) is covered in the companion
test script; lint/typecheck/build results are reported with the final commit.