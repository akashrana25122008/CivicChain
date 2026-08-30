# CivicChain — Database (Phase 1)

PostgreSQL 17 + **PostGIS** via Prisma ORM. All migrations live in
`prisma/migrations/` and are applied with `prisma migrate deploy`.

## Connections / roles

- Role `civicchain` (SUPERUSER locally) owns `civicchain` (app) and
  `civicchain_shadow` (future `migrate dev` shadow DB).
- `CREATE EXTENSION postgis` was run on `civicchain`. This requires the DB role
  to own/install trusted extensions — locally the role is a superuser. For
  production, grant the app role `USAGE` on `public` + `CREATE` **during
  migration time only** (or create the extension as a DBA and revoke).

## Prisma driver architecture

- `@prisma/adapter-pg` + `node:pg` (no `@prisma/client` binary engine). The
  driver adapter is instantiated in `src/lib/db.ts` as a module singleton.
- **Generated client is NOT shipped in `node_modules/@prisma/client`** — the
  schema uses a custom `output`:
  ```ts
  generator client {
    provider   = "prisma-client-js"
    output     = "../generated/prisma"
    moduleFormat = "esm"
  }
  ```
  Import from the repo-relative path, e.g. `@/generated/prisma/client` or
  `../../../../generated/prisma/client`. The `generated/` tree is git-ignored
  and rebuilt with `npx prisma generate`.

## Schema highlights

- `Issue.geoLocation` is a raw-SQL PostGIS column:
  ```sql
  "geoLocation" geography(Point,4326)
    GENERATED ALWAYS AS (st_setsrid(st_point(longitude, latitude), 4326)) STORED
  ```
  The Prisma field is declared `Unsupported("geography(Point,4326)")?` with a
  Gist index (`@@index([geoLocation], type: Gist, map: "issue_geoLocation_idx")`)
  so schema diffs stay stable while PostGIS handles the geospatial logic.
- Generated column has **no default** — hand-written migrations must NOT copy a
  `DROP DEFAULT` from migrate-diff output (that diff is based on the shadow
  schema and is spurious for generated columns).
- `Authority.userId String? @unique` links an Authority row to a `User` so
  status transitions can be gated by "this authority owns the issue's
  department". Issues point to authorities by dept name (`authority` string)
  until a nullable FK migration is added.
- Counter-based public IDs: `ReportCounter` table mints `CC-<n>` sequentially
  inside the report-creation transaction.
- PostGIS geography + ST functions are exercised via raw SQL; Prisma PrismaSql
  (`` Prisma.sql ``) is only used for raw spatial queries when needed.

## Migrations workflow (IMPORTANT)

`prisma migrate dev` is **non-interactive here and unsupported** in this
environment ("environment is non-interactive … use prisma migrate deploy").
Use instead:

```bash
# 1. edit prisma/schema.prisma
# 2. generate the SQL diff (author longhand; do NOT blindly apply migration.sql)
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
# 3. author prisma/migrations/<utc_timestamp>_<name>/migration.sql
#    keeping raw PostGIS DDL + omitting spurious generated-column changes
# 4. apply + regenerate the client
npx prisma migrate deploy
npx prisma generate
```

Manual DB verification (role `civicchain`, pass in `.env`):

```bash
PGPASSWORD='...' psql -h localhost -U civicchain -d civicchain -tA \
  -c "SELECT id, \"publicId\", status FROM \"Issue\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

## Seed data

`npx prisma db seed` (via `prisma.config.ts` → `tsx prisma/seed.ts`).
Idempotent: skips demo data if any demo issue exists. Creates:

- 5 users (admin/authority/ravi/meera/priya @`civicchain.dev`) — demo emails
  only, never real inboxes.
- 5 authority departments; **authority@civicchain.dev is linked** to
  Roads & Infrastructure via `Authority.userId`.
- 8 demo issues `CC-1090 … CC-1097` across statuses with promises, evidence
  rows, audit logs and notifications (all flagged `demo: true` in metadata).

## Env

- `DATABASE_URL` — app pool (required).
- `SHADOW_DATABASE_URL` — shadow database (only if `migrate dev` ever becomes
  usable in CI/local dev).
- `EVIDENCE_STORAGE_DIR` — local disk dir for uploaded evidence (served from
  `/uploads`, git-ignored).

## Related reading

- `docs/ARCHITECTURE_BASELINE.md` §Phase 1 (backend additions).
- `docs/MOCK_DATA_INVENTORY.md` — what mocks were replaced by real DB reads.