# CivicChain — Real Report → Database Pipeline (Phase 2)

This document describes the live pipeline that turns a citizen's report form
submission into a persisted, auditable, privately-stored civic issue. **Nothing
in this pipeline is simulated.** Fixes, stale claims, or fabricated records are
never inserted; each step either performs a real operation or fails loudly.

## Flow at a glance

```
    /report (client)
        │  multipart/form-data
        │  title, category, description, location,
        │  latitude, longitude, accuracy, contact,
        │  evidenceUrl(s), file(s)
        ▼
    POST /api/reports   (or POST /api/issues — same shared handler)
        │  1. session → reporter identity (never client-supplied)
        │  2. multipart deserialization + URL/File cardinality limits
        │  3. zod field validation (incl. lat/lng pairing + accuracy range)
        │  4. per-file validation: magic bytes ↔ declared MIME ↔ extension ↔ size
        │  5. private storage (object storage OR local disk)
        │  6. windowed duplicate check (60 s) → 409 DUPLICATE_REPORT
        │  7. DB transaction:
        │       refCounter++  →  publicId "CC-<seq>"
        │       Issue(+geography, +accuracy) → Evidence rows → AuditLog(REPORT_CREATED)
        │      + Notification to reporter
        ▼
    201 { issue: { id, publicId } }

    GET /api/reports            role-scoped list    (citizen=own, authority=dept, admin=all)
    GET /api/reports/[id]       owner/RBAC detail
    PATCH /api/reports/[id]     status lifecycle    (authority of that dept or admin only)
    GET /api/evidence/[id]/file private evidence bytes (re-authorizes per request)
```

## Endpoint surface

`/api/reports` and `/api/reports/[id]` are the Phase 2 surface. Per the spec's
"reuse it instead of creating duplicate endpoints" rule, `POST /api/issues` and
`PATCH /api/issues/[id]` delegate to the exact same shared handlers in
`src/lib/issues/http.ts` — there is a single implementation, no drift.

| Route | Method | Allows | Authz model |
| ----- | ------ | ------ | ----------- |
| `/api/reports` | POST | Create a report | Any authenticated user (identity from session; role/status/actor never client-chosen) |
| `/api/reports` | GET | List reports (paginated) | CITIZEN → own; AUTHORITY → own department; ADMIN → all |
| `/api/reports/[id]` | GET | Report detail | Reporter (owner), assigned authority, or ADMIN |
| `/api/reports/[id]` | PATCH | Status change | Authority assigned to that department, or ADMIN (citizens get 403) |
| `/api/issues` | GET | Community catalogue | Any authenticated user (metadata transparency) |
| `/api/evidence/[id]/file` | GET | Evidence bytes | Owner, assigned authority, or ADMIN — re-checked against the DB per request |
| `/api/my-reports/*` | GET | Owner report feed | Citizen owner (Phase 1) |

`POST /api/evidence` remains the public Wikimedia evidence search and is **not**
touched by the pipeline (see proxy note below).

## Validation (server-side, defense-in-depth)

`src/lib/validation/evidence.ts` — `assertValidEvidenceFile`:

1. **Magic-byte probing** – real file-signature sniffing for JPEG, PNG, WebP,
   HEIC, MP4/MOV, WebM. Content is checked for structural sanity (e.g. JPEG EOI
   marker, PNG IHDR/IEND chunks, RIFF/WEBP header, `ftyp` box + brand for
   mp4/mov/heic, EBML + `webm`).
2. **MIME ↔ content cross-check** – the browser-declared `type` and the detected
   type must agree; an executable renamed to `.png` is rejected even if its
   extension matches.
3. **Extension ↔ content cross-check** – the file extension must match the
   detected format.
4. **Size cap** – enforced against `MAX_UPLOAD_BYTES` in
   `src/lib/validation/report.ts` (uploads over the limit are rejected).

Field validation (`src/lib/validation/report.ts`): lat ∈ [-90,90], lng ∈
[-180,180], co-occurrence (both or neither), accuracy ≥ 0 and only when
coordinates exist, ≤ 10 evidence items. Every failure surfaces a user-safe
message through the standard error envelope.

## Storage — one abstraction, two backends

`src/lib/server/storage.ts` (`storeEvidenceFile` / `readEvidenceFile` /
`deleteEvidenceFile`):

- **S3-compatible object storage** (Cloudflare R2, AWS S3, MinIO, …) is used
  when `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, and
  `STORAGE_SECRET_KEY` are all set. The AWS SDK is loaded lazily so the local
  backend never pays for it. Credentials never reach the browser.
- **Local disk** (`EVIDENCE_STORAGE_DIR`, default `private/uploads`) otherwise.

`Evidence.url` now stores the **object key without a leading slash**
(`evidence/<yyyymm>/<ts>-<uuid>.<ext>`); it is never a public URL. Files are
served only through the authorized `/api/evidence/[id]/file` route, which
re-fetches the evidence with its issue and re-checks authorization for every
request, then streams bytes with `X-Content-Type-Options: nosniff` and
`Cache-Control: private, no-store`. Orphaned uploads are deleted if report
creation fails after any file was stored.

## Privacy & access control

- Uploaded IMAGE/VIDEO evidence serializes an API route URL
  (`/api/evidence/[id]/file`), never a static path. External URL-type evidence
  (seed/demo) is returned verbatim.
- Evidence authorization: reporter (owner) → assigned authority → ADMIN.
- Report detail over `/api/reports/[id]` applies the same scope, so a citizen
  cannot read another citizen's report metadata via the reports API, while the
  community catalogue `/api/issues/[id]` keeps civic metadata transparent.

## Auditability

- `AuditLog` ACTION `REPORT_CREATED` is appended inside the same transaction as
  the issue — an audited report is only visible if its creation is recorded.
- `STATUS_CHANGED` audits every PATCH and notifies the reporter.
- The reporter identity and audit actor always come from the session, never the
  request body.

## Duplicate protection

- Client: a synchronous submit lock prevents two identical requests from one
  click.
- Server: a windowed check (same reporter + category + case-insensitive title
  within 60 s) returns `409 DUPLICATE_REPORT` before any storage or ID minting.
  Cross-report similarity clustering remains a future phase (no simulation).

## Geolocation

- "Use My Location" reads a real `navigator.geolocation` fix
  (`enableHighAccuracy`) and submits lat, lng, and the device-reported ±meters
  accuracy, persisted to `Issue.accuracy` (migration
  `20260830065006_report_accuracy`).
- Coordinates are stored as PostGIS `geography(Point,4326)` (Phase 1) plus
  plain lat/lng for queries and map links.
- Optional reverse geocoding (`src/lib/server/geocode.ts`) runs only when
  `GEOCODER_URL` is configured, only when the citizen provided no address, is
  non-fatal on failure, and never fabricates a label.

## Configuration (`see .env.example`)

| Variable | Purpose | Default |
| -------- | ------- | ------- |
| `EVIDENCE_STORAGE_DIR` | Local evidence root | `private/uploads` |
| `STORAGE_ENDPOINT` / `STORAGE_BUCKET` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` | S3-compatible backend (all four activate it) | off |
| `STORAGE_REGION` | S3 region | `auto` |
| `STORAGE_FORCE_PATH_STYLE` | path-style endpoint (MinIO) | `false` |
| `GEOCODER_URL` / `GEOCODER_API_KEY` | Optional reverse geocoder | off |

## Honesty guarantees

- No fabricated reports, addresses, scores, statuses, or users.
- The report flow never invents AI analysis; anything that would require a model
  outputs "not available" rather than a made-up verdict.
- Every claimed write is a real database write verified by subsequent reads
  (the form re-fetches the created report before showing success).