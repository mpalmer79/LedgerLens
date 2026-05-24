# Public demo incident hotfix audit

## Why raw `CORS_ORIGINS` crashed startup

`Settings.cors_origins` is typed `list[str]`. `pydantic-settings`
runs the field's *built-in coercion* before any `@field_validator`
runs. For a `list[str]` field, that built-in coercion is
`json.loads()`. So:

| Inbound env value | What happens |
|---|---|
| `["https://x"]` | `json.loads` returns `["https://x"]` → validator splits on commas → list. ✓ |
| `https://x,https://y` | `json.loads("https://x,...")` raises `JSONDecodeError` before the validator ever sees the string. ✗ |
| `https://x` | Same — `json.loads("https://x")` raises. ✗ |

The `_split_cors_origins` validator was supposed to handle the
comma-separated case, but `mode="before"` doesn't actually run
before the JSON decode on `list[str]` fields in current
pydantic-settings. So the only forms that ever booted were JSON
arrays, and only by accident.

## Why JSON-array `CORS_ORIGINS` worked

`["https://ledgerlens.up.railway.app"]` is a valid JSON array → the
built-in coercion succeeds → the field value is a 1-element list →
the validator receives a list (not a string) → returns it
unchanged.

## Why `/health` can pass while `/demo/status` fails

`/health` is a literal-string response handler. It does not touch
the database. It will respond `200 OK` whenever the process is up.

`/demo/status` issues five SQL queries against `transactions`,
`categorization_results`, `review_decisions`, `correction_memory`,
and a count via `TransactionRepo`. If any one of those tables is
missing a column, has a stale enum, or doesn't exist at all,
SQLAlchemy raises and FastAPI returns `500 Internal Server Error`.

## Why `/ready` can pass while `/demo/status` fails

`/ready` runs `SELECT 1` against the connection. It does not touch
any application tables. A Railway Postgres that's reachable and
authenticated but missing the new columns (e.g. `category_mapping_entries.notes`,
`category_mapping_profiles.source`, the new ResultStatus enum value
`accountant_review_required`, etc.) will pass `/ready` because
`SELECT 1` doesn't probe any of those.

## Likely schema drift issue

The Railway Postgres was created when `init_db()` first booted. The
images that booted contained different SQLAlchemy metadata:

- The Auth/Tenant Phase 1 PR added 6 new tables (`users`,
  `tenants`, `memberships`, `businesses`, `category_mapping_profiles`,
  `category_mapping_entries`). `create_all()` is idempotent for new
  tables — it would add them on the next boot. But on a long-running
  Railway Postgres, the first boot may have happened before those
  models existed.
- The persistent-mapping PR made `category_mapping_entries.category_code`
  nullable, added `notes`, and added `category_mapping_profiles.source`.
  **`create_all()` does NOT alter existing tables.** If
  `category_mapping_entries` already exists on Railway from an
  earlier deploy, the new columns are missing and the new write code
  will fail.
- The review-safety PR added a new value to the `result_status` enum
  (`accountant_review_required`). Postgres enums are not altered by
  `create_all()`. A boot on Railway will fail any query that selects
  or filters on the new value.

`/demo/status` only queries `categorization_results`,
`review_decisions`, `correction_memory`, and `transactions`. The
most likely 500 cause today is the missing enum value on
`result_status`, surfaced when SQLAlchemy ORM tries to deserialize
a row that was written under the old enum into the new model.

## Migration / startup gap

The backend `Dockerfile` runs `uvicorn` directly:

```
CMD ["sh", "-c", "uvicorn ledgerlens.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

There is no migration step. `init_db()` (called in the lifespan) is
`Base.metadata.create_all()`, which only creates missing tables;
it never alters columns or enums.

The Alembic baseline migration exists, but:

- It is **never run** on Railway.
- If we naively add `alembic upgrade head` to the startup script and
  Railway Postgres already has the tables (created via `create_all`),
  the `CREATE TABLE` statements in the baseline will fail with
  "relation already exists" and the boot will hang in a crash loop.

So a safe path is required: detect the situation rather than guess.

## Exact remediation plan

1. **CORS parsing — make it bulletproof.**
   - Type `cors_origins` as `str` (the raw env value).
   - Add a `cors_origins_list: list[str]` property that handles JSON
     arrays, comma-separated strings, and single origins, with
     whitespace stripping and rejection of empty entries.
   - Update `main.py` to read `settings.cors_origins_list`.
   - Tests cover all three forms + malformed JSON.

2. **`/demo/status` failure mode.**
   - Wrap the body in a try/except. On any DB exception, log via
     the structured logger (with redaction) and return a 503 with
     the structured shape:
     `{ "error": "demo_status_unavailable", "message": "...",
        "request_id": "...", "hint": "Check /demo/ready ..." }`.

3. **New `/demo/ready` endpoint.**
   - Runs `SELECT 1`.
   - Runs a count query against every demo-critical table.
   - Returns `{ ready, checks: {...}, warnings, version }`.
   - Never returns env vars / DATABASE_URL / secrets.
   - Catches each table check independently so one failure doesn't
     mask the others.

4. **Safe startup migration / bootstrap.**
   - `backend/scripts/bootstrap_or_migrate.py` detects:
     - `alembic_version` exists → run `alembic upgrade head`.
     - `alembic_version` missing AND no app tables → run
       `alembic upgrade head` (fresh DB).
     - `alembic_version` missing AND app tables present → exit with
       a clear message instructing manual `alembic stamp head`.
   - `backend/scripts/start.sh` runs the bootstrap, then `uvicorn`.
     `RUN_MIGRATIONS_ON_START` opts in.
   - Dockerfile CMD uses `start.sh`.

5. **Frontend `/app` and `/demo` fallback panels.**
   - Both pages call `/demo/ready` on mount.
   - If `ready=false` or the call errors, render a polished
     "Demo dependencies are temporarily unavailable" panel with
     plain-English copy and three CTAs (Try again, Open cleanup
     checklist, Open technical story).

6. **Public smoke script.**
   - `scripts/smoke_public_demo.sh` curls the frontend and backend
     URLs, plus the four health-shape endpoints and the CORS
     preflight.

7. **Docs.**
   - Update `PUBLIC_DEMO_RELIABILITY.md`, `DEPLOYMENT_SMOKE_TEST.md`,
     `README.md` to give the **post-fix** env shape:
     `CORS_ORIGINS=https://ledgerlens.up.railway.app` (no brackets).
   - New `PUBLIC_DEMO_INCIDENT_HOTFIX_REVIEW.md` reports what was
     done.

8. **Tests.**
   - Backend: CORS parsing in all four forms + malformed JSON;
     `/demo/ready` happy path + table-failure path; `/demo/status`
     503 shape; smoke that `start.sh` is executable; existing 247
     tests stay green.
   - Frontend: `/app` and `/demo` render the polished panel and do
     not lead with `"Is the backend running?"`.
