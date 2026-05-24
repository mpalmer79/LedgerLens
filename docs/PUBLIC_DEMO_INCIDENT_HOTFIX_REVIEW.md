# Public-demo incident hotfix review

## 1. Confirmed root cause

Two independent failures, both surfaced by the same Railway deploy:

1. **CORS_ORIGINS startup crash.** `Settings.cors_origins` was typed
   `list[str]`. `pydantic-settings` runs `json.loads()` on `list[*]`
   env values before any `@field_validator(mode="before")` fires.
   The single-origin string `CORS_ORIGINS=https://x` therefore
   raised `JSONDecodeError` before the comma-splitting validator
   ever saw it. Only JSON-array values (`["https://x"]`) booted.

2. **`/demo/status` 500 page.** Five direct ORM queries in the
   handler against `transactions`, `categorization_results`,
   `review_decisions`, `correction_memory`, and `account_categories`.
   Recent PRs added new columns and a new `result_status` enum value
   (`accountant_review_required`). The Railway Postgres was created
   by an earlier deploy's `Base.metadata.create_all()` and never
   altered. Any of those queries hit the drifted schema and FastAPI
   surfaced the raw exception as `500 Internal Server Error`. The
   `/health` and `/ready` checks did not exercise the drifted
   columns, so the failure hid behind the shallow `SELECT 1` check.

## 2. Files changed

**Backend**

- `backend/src/ledgerlens/config.py` — `cors_origins: str` +
  `cors_origins_list` property + `_parse_cors_origins()` helper.
- `backend/src/ledgerlens/main.py` — uses `settings.cors_origins_list`.
- `backend/src/ledgerlens/api/demo.py` — `/demo/status` wrapped in
  try/except → structured 503; new `/demo/ready` endpoint probes
  every demo-critical table independently.
- `backend/scripts/bootstrap_or_migrate.py` — safe Alembic
  bootstrap. Detects fresh-DB / already-stamped / drift-without-
  stamp; refuses to silently stamp.
- `backend/scripts/start.sh` — container entrypoint; runs bootstrap
  when `RUN_MIGRATIONS_ON_START=true`, then `exec uvicorn`.
- `backend/Dockerfile` — CMD switched to `start.sh`; scripts chmod
  +x.
- `backend/tests/test_cors_settings_parsing.py` — 10 tests.
- `backend/tests/api/test_demo_health.py` — 5 tests.
- `backend/tests/test_start_scripts.py` — 4 tests.

**Frontend**

- `frontend/src/lib/api/client.ts` — `getDemoReady()` + `DemoReadiness`
  type.
- `frontend/src/components/app/DemoUnavailablePanel.tsx` — shared
  polished fallback panel.
- `frontend/src/app/app/page.tsx` — probes `/demo/ready`; renders
  the panel on not-ready / error.
- `frontend/src/app/demo/page.tsx` — same hook on the guided demo.
- `frontend/src/lib/page-content.test.ts` — 5 new tests under
  "demo unavailable fallback (Phase 7)".

**Top-level**

- `scripts/smoke_public_demo.sh` — post-deploy smoke check.

**Docs**

- New: `docs/PUBLIC_DEMO_INCIDENT_HOTFIX_AUDIT.md`,
  `docs/PUBLIC_DEMO_INCIDENT_HOTFIX_REVIEW.md`.
- Updated: `docs/PUBLIC_DEMO_RELIABILITY.md`,
  `docs/DEPLOYMENT_SMOKE_TEST.md`, `docs/IMPLEMENTATION_GAP_ANALYSIS.md`,
  `README.md`.

## 3. CORS parsing fix

`_parse_cors_origins(value)` returns `list[str]` from any of:

```
CORS_ORIGINS=https://x.com
CORS_ORIGINS=https://x.com,http://localhost:3000
CORS_ORIGINS=["https://x.com"]
```

Whitespace is stripped, empty entries dropped, malformed JSON
arrays raise `ValueError` at *read* time (so the process still
boots; `/health` and `/ready` can come up and surface the
misconfiguration through logs).

`Settings._coerce_cors_origins_input` accepts a `list[str]`
argument from Python callers (tests, scripts) and re-joins it with
commas so the round-trip is stable.

`main.py` reads `settings.cors_origins_list`.

## 4. `/demo/status` fix

Wrapped in `try/except`. On any `Exception`:

- Log via `ledgerlens.observability.get_logger("ledgerlens.api.demo")`
  with `sanitize_for_log` applied to the exception class name.
- Return:
  ```
  {
    "error": "demo_status_unavailable",
    "message": "Demo status is temporarily unavailable.",
    "request_id": "<id from middleware>",
    "hint": "Check /demo/ready for dependency status."
  }
  ```
  with HTTP 503.

The real exception class name is in the logs, never in the public
body.

## 5. `/demo/ready` behavior

- Runs `SELECT 1`.
- Counts every demo-critical table independently:
  `transactions`, `categorization_results`, `review_decisions`,
  `correction_memory`, `account_categories`,
  `category_mapping_profiles`, `category_mapping_entries`.
- Each check captures its own error class so one failure doesn't
  mask the others.
- Reports `categorizer.mode`, `categorizer.demo_mode`, and
  `demo_stub` block (the demo-stub flag + whether Anthropic is
  required for the current mode).
- Returns a clean 200 with `ready=false` and a per-check breakdown
  when something is wrong — the readiness signal lives in the
  response body, not the status code.
- Never echoes `DATABASE_URL`, env vars, secrets, or raw stack
  traces (pinned by
  `test_demo_ready_never_echoes_database_url_or_secrets`).

## 6. Migration / startup handling

`backend/scripts/bootstrap_or_migrate.py` is the safe entry point:

| State | Action |
|---|---|
| `alembic_version` table exists | `alembic upgrade head`. |
| `alembic_version` missing AND no app tables | `alembic upgrade head` (fresh DB). |
| `alembic_version` missing AND app tables present | EXIT 2 with a clear message. Operator must choose to RESET or STAMP. |

`scripts/start.sh` runs the bootstrap when
`RUN_MIGRATIONS_ON_START=true`, then `exec uvicorn`. Failure is
fatal — the container crashes so Railway can surface it rather
than serving a broken process.

Dockerfile CMD is now `["/app/scripts/start.sh"]`.

## 7. Frontend fallback changes

`DemoUnavailablePanel` is rendered by `/app` and `/demo` when
`/demo/ready` reports `ready=false` or the readiness call itself
errors. Copy:

- Title: "Demo dependencies temporarily unavailable."
- Body: "The API process is up, but one or more demo database
  checks are failing. This usually happens during a deploy window
  or a Railway database migration."
- Shows the affected dependency names + request id (for log
  correlation).
- Three CTAs (44px tap targets): Try again, Open cleanup checklist,
  Open technical story.
- Public-demo warning footer.

## 8. Docs updated

- `PUBLIC_DEMO_RELIABILITY.md` — full hotfix section with before /
  after table and the repair procedure for the Railway Postgres.
- `DEPLOYMENT_SMOKE_TEST.md` — new "Automated smoke" + the
  post-hotfix env table.
- `README.md` — added a bullet under "Security and
  production-readiness status".
- `IMPLEMENTATION_GAP_ANALYSIS.md` — section 11.
- `PUBLIC_DEMO_INCIDENT_HOTFIX_AUDIT.md` (new) — the root-cause
  audit produced in Phase 1.

## 9. Tests added

| Suite | Before | After |
|---|---|---|
| Backend pytest | 247 | **266** |
| Frontend vitest | 242 | **247** |

Backend additions:

- `tests/test_cors_settings_parsing.py` — 10 tests (helper + Settings
  end-to-end).
- `tests/api/test_demo_health.py` — 5 tests (`/demo/ready` happy
  path + table-failure path + secret-leak guard + request-id; and
  `/demo/status` structured 503 with no traceback leak).
- `tests/test_start_scripts.py` — 4 tests (scripts exist + are
  executable; bootstrap runs on fresh DB; bootstrap refuses to
  stamp on drift).

Frontend additions:

- 5 tests under `lib/page-content.test.ts > demo unavailable
  fallback (Phase 7)` pinning the panel copy, the integration
  points on `/app` and `/demo`, the "API process is up" /
  "demo database checks" distinction, and the no-overclaim
  contract.

All previous tests stay green; `npm run lint`, `npm run build`,
`ruff check`, `ruff format --check`, and `mypy --strict` are all
clean.

## 10. Exact Railway variables to set after this PR is deployed

**Backend service**

```
CORS_ORIGINS=https://ledgerlens.up.railway.app
CATEGORIZER_MODE=demo_stub
DATABASE_URL=<Railway Postgres internal URL>
RUN_MIGRATIONS_ON_START=true
```

(No brackets on `CORS_ORIGINS`; the JSON-array form still works
for backward compatibility.)

**Frontend service**

```
NEXT_PUBLIC_API_BASE_URL=https://ledgerlens-backend-production.up.railway.app
```

## 11. Railway DB: reset or stamp?

The Railway Postgres was created by an earlier deploy's
`Base.metadata.create_all()`. App tables are present;
`alembic_version` is missing. On the first boot of the hotfix the
`bootstrap_or_migrate.py` script will detect this and exit 2.

**Recommended: RESET.** The demo data is fictional. Drop the
Railway Postgres database from the dashboard and redeploy; the
next boot will hit the "fresh database" path and run every
migration end-to-end. This is the safer choice and is documented
as such in the script's own exit message.

The STAMP alternative (run `alembic stamp head` once, then
redeploy) is documented for completeness but should only be
attempted if the live schema has been verified column-by-column to
match the head revision. The eval-businesses Python registry is
unaffected either way.
