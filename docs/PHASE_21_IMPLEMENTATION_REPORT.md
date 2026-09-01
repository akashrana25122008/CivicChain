# Phase 21 — Security Hardening Implementation Report

Comprehensive security hardening across the CivicChain attack surface: rate
limiting with Redis support, image metadata stripping, polyglot malware
detection, RBAC security tests, structured request logging, input validation,
and a full audit of CSRF, CSP, error sanitization, and API abuse protection.

## Approach

Phase 21 does NOT replace existing security controls — the pre-Phase 21
codebase already had strong foundations (magic-byte file validation, private
evidence storage, DB-authoritative RBAC, Auth.js JWT sessions with SameSite
cookies, SHA-256 append-only audit ledger, security headers + CSP). The phase
adds explicit hardening on top of those foundations and writes the first
dedicated RBAC security test suite to prevent regressions.

### 1. Redis Rate Limiting (`src/lib/security/rate-limit.ts`)

Refactored the in-memory rate limiter into a pluggable `RateLimitStore`
abstraction with two backends:

- **Memory** (`RATE_LIMIT_STORE=memory`, default): unchanged behavior, single
  node, for dev / small deployments.
- **Redis** (`RATE_LIMIT_STORE=redis`): ioredis-backed, shared across instances,
  production-grade. Lazy-connects with a 2-second timeout; REDIS_URL or
  REDIS_HOST/REDIS_PORT/REDIS_PASSWORD.

**Fail-open / fail-closed policy** (per-endpoint sensitivity):

| Endpoint          | Fallback | Rationale                                   |
|-------------------|----------|---------------------------------------------|
| auth              | closed   | Prevent brute-force / credential stuffing   |
| reportCreation    | closed   | Prevent report spam                         |
| fileUpload        | closed   | Prevent storage exhaustion attacks          |
| voting            | closed   | Prevent community brigading                 |
| geocode           | closed   | Protect external provider from hammering    |
| admin             | closed   | High-value sensitive surface                |
| api (general)     | open     | Brief generous window > hard outage         |
| map               | open     | Brief generous window > hard outage         |

When Redis is unavailable: fail-open degrades to the in-memory store (local
best-effort guard); fail-closed returns 503 + Retry-After.

### 2. Image Metadata Stripping + Malware Scanning (`src/lib/security/fileScan.ts`)

**Metadata stripping**: images uploaded as evidence are re-encoded through
`sharp.rotate()` before storage. This bakes EXIF orientation into pixels and
drops EXIF/IPTC/XMP/GPS/ICC metadata — preventing geolocation leaks and
steganographic payload embedding. Videos pass through unchanged (sharp cannot
losslessly re-encode them; stored MIME is the sniffed container MIME, never
browser-declared).

**Polyglot / malware detection**: in-process heuristic scanner detects appended
executable signatures (ZIP, ELF, PE/MZ, Mach-O, PDF, GZIP, RAR, 7z, SHS) in
the last 4096 bytes of image uploads. A real AV provider hook
(`MalwareScanProvider` interface, `SECURITY_AV_PROVIDER` env var) is wired as
an async integration point for ClamAV or cloud scan providers; when configured
but unavailable, the in-process heuristic remains active (fail-open for
infrastructure errors).

Both functions are fail-safe: they never throw for infrastructure reasons and
never reject a legitimate upload when the scanner is broken.

**Pipeline integration**: `sanitizeUpload()` is called in both evidence upload
pipelines (`src/lib/issues/http.ts` for new reports, and
`src/app/api/issues/[id]/evidence/route.ts` for standalone evidence adds) after
`assertValidEvidenceFile()` and before `storeEvidenceFile()`.

### 3. Request Logging (`src/lib/security/requestLog.ts`)

Every proxy-matched request now gets a unique `x-request-id` UUID and is
structured-logged with method, path, status, duration, IP, and rate-limit flag.
The `x-request-id` response header allows callers to quote the correlation id in
support tickets. Logging is gated by `LOG_LEVEL` and `NODE_ENV` to avoid noisy
per-request piping in production at info level; errors/warn are always emitted.

### 4. RBAC Security Tests (`src/lib/security/accessControl.ts` + tests)

Extracted authorization decision logic into a pure, DB-free module encoding
the role hierarchy (CITIZEN < AUTHORITY < ADMIN) and object-access rules:

- `canReadIssue` / `canMutateIssue`: IDOR guard — citizen reads own, authority
  reads own dept, admin reads all.
- `authorityOwnsIssue`: cross-department escalation guard — no authority may
  reach another authority's queue by supplying a foreign `authorityId`.
- `canEnterAdmin` / `canEnterDepartment`: surface-level gate predicates.

The test suite (`src/lib/security/__tests__/accessControl.test.ts`) has 13 tests
covering: privilege escalation denial, IDOR on reads and writes, cross-department
reaches, intruder ids, admin bypass, authority-dept matching, and the role
ranking total order.

### 5. Input Validation (`src/app/api/issues/route.ts`)

`GET /api/issues` now validates `page` (positive integer), `pageSize` (1–200
integer), and `sort` (one of `newest|oldest|updated`) at the route boundary.
Invalid values return a clear 400 instead of silent coercion. This is
defense-in-depth: `queryIssueList` already clamps these values internally, but
rejecting garbage at the route prevents NaN and unbounded values from entering
the query pipeline.

### 6. Security Headers + CSP Audit (`src/lib/security/headers.ts`)

Verified the full security header stack (HSTS, X-Frame-Options: DENY,
X-Content-Type-Options: nosniff, CSP, Permissions-Policy, CORP/COEP/COOP)
and both CSP variants (general + map-specific) are applied to all
proxy-matched routes.

CSP `'unsafe-inline'` in `script-src` is retained deliberately — Next.js App
Router streams RSC bootstrapping + hydration via inline scripts; removing it
without a nonce strategy would break every navigated page. The upgrade path
(nonce-based CSP via `next/headers`) is documented as a follow-up hardening
item.

### 7. CSRF Posture Documentation (`src/lib/auth/auth.config.ts`)

Documented that the session cookie is `httpOnly + sameSite:'lax' + secure` in
production. SameSite=Lax blocks cross-site state-changing cookie sends, and
the API is JWT-bearer authenticated — no custom anti-CSRF double-submit token
is needed (it would be redundant and brittle across the bearer surface).

### 8. Signed URLs

The evidence serving route (`GET /api/evidence/[id]/file`) enforces per-request
authorization against the live database and streams objects through a
server-side proxy with `Cache-Control: private, no-store`. This route-level
authorization model is equivalent to (and safer than) short-lived signed URLs,
which would create a separate access vector. No presigned URL mechanism is
introduced; the route-serve model is documented as the existing pattern.

### 9. Audit Log Integrity (Reused)

Phase 18's SHA-256 hash-chained append-only audit ledger (`ledger.ts` +
`hashchain.ts`) is verified intact and reused without modification. The
`verifyLedgerChain` function remains the canonical integrity check.

### 10. Error Sanitization (Verified)

`handleApiError` in `src/lib/server/api.ts` is verified to never leak stack
traces, database internals, or query details to the client. Unknown errors
return a stable `{ code: 'INTERNAL', message: 'Something went wrong on the
server.' }` with a 500 status. Database errors are caught and logged
server-side only.

### 11. API Abuse Protection (Verified)

- **Pagination**: `queryIssueList` caps `pageSize` at 200; page is clamped to
  >= 1. The route adds defense-in-depth validation (rejects non-integer /
  out-of-range).
- **File upload**: `MAX_UPLOAD_BYTES` enforced in `assertValidEvidenceFile`;
  `MAX_FILES = 10` enforced per upload batch in both upload routes.
- **Auth rate limiting**: 30 requests per 15-minute window, fail-closed.
- **Report creation**: 10 per hour, fail-closed.

### 12. Error Sanitization + CSP + CSRF — `next.config.ts` (Verified)

`NEXT_TELEMETRY_DISABLED=1` and `headers` set in `next.config.ts` apply a
baseline security header layer for non-proxy-matched routes (static assets,
public pages). Verified these don't conflict with the proxy-level headers.

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/security/fileScan.ts` | Polyglot/heuristic malware detection + image metadata stripping + AV provider hook |
| `src/lib/security/accessControl.ts` | Pure RBAC authorization decision module (role hierarchy + object access rules) |
| `src/lib/security/requestLog.ts` | Structured request logging with correlation id generation |
| `src/lib/security/__tests__/accessControl.test.ts` | 13 RBAC security tests (IDOR, privilege escalation, role hierarchy) |
| `src/lib/security/__tests__/fileScan.test.ts` | 8 polyglot detection + metadata stripping tests |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/security/rate-limit.ts` | Added Redis store, RateLimitStore abstraction, fail-open/fail-closed policy, removed unused skipSuccessful/skipFailed fields |
| `src/lib/security/headers.ts` | Changed param type from `NextRequest` to minimal `PathAware` shape; removed unused `NextRequest` import; added CSP trade-off documentation |
| `src/proxy.ts` | Added admin + geocode rate limiters, request logging wrapper with requestId, `/api/geocode/*` to matcher, removed pre-existing `any` casts |
| `src/lib/issues/http.ts` | Wired `sanitizeUpload` into evidence ingestion pipeline |
| `src/app/api/issues/[id]/evidence/route.ts` | Wired `sanitizeUpload` into standalone evidence upload |
| `src/app/api/issues/route.ts` | Added page/pageSize/sort validation with clear 400 errors |
| `src/lib/auth/auth.config.ts` | Added CSRF posture documentation |
| `.env.example` | Added RATE_LIMIT_STORE, REDIS_URL, REDIS_HOST/PORT/PASSWORD, SECURITY_AV_PROVIDER, LOG_LEVEL |

## Verification

- **TypeScript**: `npx tsc --noEmit` exit 0
- **Lint**: all Phase 21 files clean (pre-existing warnings in Card.tsx / Avatar.tsx / Button.tsx are outside Phase 21 scope)
- **Tests**: `npm test` — **155 tests, 155 pass, 0 fail** (24 new security tests)
- **Build**: `NODE_ENV=production npm run build` exit 0
- **Live smoke**: dev server returns 200 on `/`; `/api/public/risks` returns real data; `/dashboard` and `/map` return security headers (CSP, HSTS, CORP, COEP, COOP, X-Request-Id)

## Security Posture Summary

| Control | Status | Notes |
|---------|--------|-------|
| File validation | ✅ Strong | Magic bytes + structural sanity + MIME + size + extension |
| Malware scanning | ✅ Added | Polyglot heuristic (Phase 21) + AV hook |
| Image metadata stripping | ✅ Added | sharp re-encode strips EXIF/GPS (Phase 21) |
| Private evidence storage | ✅ Strong | Route-authorized serve, no public path |
| Rate limiting | ✅ Hardened | Redis backend + fail-open/closed policy (Phase 21) |
| CSRF | ✅ Adequate | SameSite=Lax + JWT bearer |
| CSP | ✅ Applied | `unsafe-inline` trade-off documented |
| RBAC tests | ✅ Added | 13 IDOR/escalation tests (Phase 21) |
| Audit ledger | ✅ Intact | Phase 18 SHA-256 hash chain |
| Error sanitization | ✅ Verified | No stack/DB leaks |
| Request logging | ✅ Added | Structured logs + x-request-id (Phase 21) |
| Signed URLs | ✅ Documented | Route-serve model is the safe equivalent |
