# Public-demo reliability layer

How LedgerLens behaves when the backend is slow, unavailable, or
returns an error — and what the public demo is designed to tolerate.

## 1. What failures the frontend handles

| Failure | Where it surfaces | UI behavior |
|---|---|---|
| Backend not reachable (TCP error, DNS, CORS) | Any page that loads data on mount | `ErrorState` with **"Demo backend unavailable"** title, plain-English explanation, "Try again" button, secondary action linking to the technical story or cleanup checklist. |
| Request timeout (>10s) | Same as above | Same `ErrorState`; underlying `ApiError.code = "timeout"`. Auto-retry kicked once already before surfacing. |
| 503 Service Unavailable (cold start, demo-mode mismatch) | Same as above | `ErrorState` with "Demo backend unavailable" copy. Retryable; one auto-retry. |
| 500 / 502 / 504 server errors | Same as above | `ErrorState`; one auto-retry. |
| 404 Not Found | `/transactions/[id]`, etc. | `ErrorState` with "Not found" title. No retry. |
| 422 Validation | `/transactions/import`, `/questions` save | Returns the backend's detail message verbatim. No retry. |
| Mutation (`POST`, `PUT`, `PATCH`, `DELETE`) fails | `/demo/seed`, `/demo/reset`, `/review-queue/*/correct`, etc. | Inline error on the relevant button or card; **never auto-retried** (a duplicated POST could double-seed, double-correct, etc.). |
| One row in a list fails to save | `/questions` | Inline red panel on **that card only** — the rest of the list stays usable. |
| Markdown / CSV download fails | `/handoff` | Inline red panel under the download button. The other download still works. |
| `/demo/scenario` 503s but `/demo/status` is fine | `/demo` | Sample-scenario card is skipped; the rest of the guided demo still works. |

## 2. API timeout / retry behavior

`frontend/src/lib/api/client.ts`:

- **Default timeout:** 10 seconds. Configurable per-request via
  `timeoutMs`. `0` disables it.
- **Default retry count:** **1 for safe GETs (`GET`, `HEAD`) only.**
  `0` for `POST` / `PUT` / `PATCH` / `DELETE` — mutations are never
  auto-retried.
- **Retry triggers:** `network_error` (TCP / DNS / CORS),
  `timeout`, `408`, `425`, `429`, and any `5xx`. Anything else fails
  immediately.
- **Retry delay:** 600ms between attempts. Single delay; not
  exponential — this is a portfolio demo, not a high-throughput
  pipeline.
- **AbortController:** the client composes the caller's `signal`
  (if any) with an internal timeout signal so navigation away from a
  page cancels in-flight requests cleanly.

## 3. Error-state strategy

Three shared components live in `frontend/src/components/ui/DataState.tsx`:

- **`<LoadingState>`** — single-line "Loading…" with a spinning
  `Loader2` icon. Accepts a custom `label` (e.g. "Loading the sample
  scenario…"). `role="status"` + `aria-live="polite"`.
- **`<EmptyState>`** — heading + body + primary + secondary action.
  Used when a page loads successfully but the relevant data is empty
  (no questions, no handoff yet).
- **`<ErrorState>`** — accessible (`role="alert"`) error panel.
  Accepts an `ApiError` (or any `unknown` error) and renders its
  `userMessage` verbatim. Optional `onRetry` callback shows a primary
  "Try again" button. Optional `secondaryAction` slot for a link. A
  collapsed `<details>` panel shows the raw technical details
  (`HTTP <status>`, error code, raw message) for reviewers who want
  the diagnostic.

`ApiError` is enriched with two convenience fields:

- `retryable: boolean` — derived from status code + error code;
  `ErrorState` uses it to decide whether to show the "Try again" button
  when no explicit `onRetry` is passed (and pages use it to decide
  whether to auto-retry mutations they've explicitly marked safe).
- `userMessage: string` — plain-English copy safe to render to a small
  business owner. Examples: "LedgerLens could not reach the demo
  backend.", "The demo backend is taking longer than expected to
  respond.", "The demo backend is temporarily unavailable."

## 4. Demo-backend health signal

`frontend/src/components/app/AppShell.tsx` ships a `<HealthDot>` in
the top-right of every app-shell page:

- **Checking** (gray) — initial state before the first `/health` call
  resolves.
- **API: ok** (brand green dot) — last `/health` call succeeded.
- **API: unreachable** (red dot) — last `/health` call threw.

`useBackendHealth` polls on mount and on `window` focus. The dot is
deliberately subtle — visible to anyone debugging, not noisy enough to
scare a casual visitor.

Marketing-only pages (`/`, `/about`, `/technical-story`) don't have
the dot; they don't call the backend.

## 5. Empty-state strategy

Pages distinguish three "no data" cases:

| Case | UI |
|---|---|
| Loading | `<LoadingState>` |
| Loaded, data legitimately empty (no transactions yet, no questions) | `<EmptyState>` with a clear CTA — usually "Try the sample scenario" or "Open cleanup checklist". |
| Loaded, data empty *because* the request failed | `<ErrorState>` — never silently a zero-count state. The page never claims "0 of 0 verified" when the request actually 500'd. |

## 6. Export-failure handling

Markdown and CSV downloads on `/handoff` are now button-driven instead
of plain `<a download>` links. Each click does:

1. `HEAD` the URL.
2. On 2xx, navigate to the URL (browser handles `Content-Disposition`).
3. On non-2xx or network error, render an inline red panel under that
   specific button with a "Please try again" message.

This catches the "user clicks download and nothing happens" failure
mode without needing a full-blown notification system.

## 7. CI enforcement

`.github/workflows/ci.yml` runs on every PR and push to `main`:

- **Backend job:** `ruff check`, `ruff format --check`, `mypy`,
  `pytest` (146 tests).
- **Frontend job:** `npm run lint`, **`npm test -- --run`** (vitest;
  133+ tests), `npm run build`.

Frontend test enforcement was added in PR #40 (this sprint). Before
that, vitest passed locally but wasn't gated by CI.

## 8. Known limitations

- **No skeleton screens.** Loading state is a simple spinner + text.
  Skeleton screens would be a polish improvement, not a correctness
  improvement.
- **No background re-polling of `/health`.** The HealthDot updates on
  mount and on `window` focus only. If the backend goes down *while*
  a user is interacting, the dot won't catch it until the next focus
  event or until they click something that fails.
- **No exponential backoff or jitter.** Single 600ms retry delay. For
  a portfolio demo the simple version is correct; a production system
  would want backoff + jitter to avoid retry storms.
- **No request IDs in error UI.** A backend that supports a request-id
  header would make user-reported failures easier to trace. Out of
  scope here.
- **No toast / notification system.** Inline errors only. A toast
  layer would clean up multi-step mutations on `/transactions`, but
  isn't required for the current workflow.
- **`apiFetch` does not validate response shape.** Type safety is
  static-only; a backend schema drift would surface as a runtime
  error inside the page. Zod / valibot validation is a deliberate
  out-of-scope choice — it would add a runtime dependency.
- **Markdown / CSV download still uses `window.location.assign`**
  rather than a `<a download>` tag triggered programmatically. This
  reuses the browser's `Content-Disposition` handler and keeps the
  code path short.

## 9. Future hardening work

In priority order:

1. **Request IDs** — backend echoes a `X-Request-Id` header on every
   response; frontend surfaces it in the technical-details panel of
   `<ErrorState>`. Cheap, high-impact for debugging.
2. **Skeleton screens** — replace `<LoadingState>` on key pages with
   placeholder rows that approximate the loaded layout.
3. **Periodic `/health` re-polling.** Every 30s while the page is
   visible. Keep it cheap (single call, no body).
4. **Toast notifications for mutation success / failure.** Especially
   on `/transactions` where multiple categorize / approve / correct
   actions happen in sequence.
5. **Response schema validation.** Add zod / valibot on the API client
   so schema drift is caught at the boundary, not deep inside a page.
6. **Multi-region deploy + retry backoff.** Out of scope for the
   current portfolio target.

## Post-incident hotfix (2026-05-24)

### Symptoms

1. Removing brackets from `CORS_ORIGINS` on Railway crashed backend startup
   with a `JSONDecodeError` before the validator could split a
   comma-separated value.
2. `/demo/status` returned a raw "Internal Server Error" page in the
   browser while `/health` and `/ready` both passed — schema drift was
   hiding behind the shallow `SELECT 1` check.

### Code changes

| Area | Before | After |
|---|---|---|
| `Settings.cors_origins` | `list[str]` — coerced via `json.loads()` by pydantic-settings before any validator ran. | `str` — raw env value stored verbatim; `cors_origins_list` property parses single origin / comma-separated / JSON-array shapes. |
| `/demo/status` | Raw exception → 500 Internal Server Error page. | `try/except` → structured 503 `{ error, message, request_id, hint }`. Real exception logged via the structured logger. |
| `/demo/ready` | _(did not exist)_ | New endpoint that probes every demo-critical table independently and reports per-check status. |
| `init_db()` / migrations | Only `Base.metadata.create_all()`; never ran Alembic. | `backend/scripts/bootstrap_or_migrate.py` + `backend/scripts/start.sh`. Dockerfile CMD now uses `start.sh`. Opt-in via `RUN_MIGRATIONS_ON_START=true`. |
| Schema drift handling | `create_all()` silently no-op'd missing columns / enum values. | Bootstrap script detects drift (app tables present + `alembic_version` missing) and **exits 2 with a clear repair message** — never silently stamps. |
| `/app` and `/demo` | A raw API error dominated when any demo dependency failed. | Both pages probe `/demo/ready` and render `<DemoUnavailablePanel>` (polished copy + three CTAs) when dependencies are unavailable. |

### Correct Railway env after this PR is deployed

```
CORS_ORIGINS=https://ledgerlens.up.railway.app
CATEGORIZER_MODE=demo_stub
DATABASE_URL=<Railway Postgres internal URL>
RUN_MIGRATIONS_ON_START=true
```

(Plain string for `CORS_ORIGINS`; brackets no longer required.)

### Frontend env

```
NEXT_PUBLIC_API_BASE_URL=https://ledgerlens-backend-production.up.railway.app
```

### Pre-deploy env (works on current main without the fix)

```
CORS_ORIGINS=["https://ledgerlens.up.railway.app"]
```

### How to repair the Railway Postgres

The Railway Postgres was populated by an earlier deploy's
`Base.metadata.create_all()`, so it has app tables but no
`alembic_version` row. On the first boot after this PR is deployed,
`bootstrap_or_migrate.py` will detect that state and exit 2 with a
repair message. The operator picks one of:

**A — RESET (recommended; demo data is fictional)**

1. In the Railway dashboard, drop the Postgres database (delete +
   recreate, or use Railway's "reset database" if available).
2. Redeploy. The next boot hits the "fresh database" path and runs
   every migration end-to-end.

**B — STAMP (only if you have verified column-by-column compatibility)**

1. Run `alembic stamp head` once against the live Postgres URL from
   your laptop or a Railway shell.
2. Redeploy. Subsequent boots run `alembic upgrade head`.

For the public portfolio demo, option A is the right choice.

### Smoke check after deploy

```
scripts/smoke_public_demo.sh
```

Exits non-zero if any of `/health`, `/ready`, `/demo/ready`,
`/demo/status`, the frontend `/`, `/app`, `/demo`, or the CORS
preflight fails.

## Static handoff fallback (owner-onboarding sprint)

`/handoff` is now resilient when the backend errors. The page renders
`<StaticHandoffSamplePreview>` instead of a dark spinner / generic
`<ErrorState>`. The fallback:

- Shows the Granite State Auto Repair March 2026 sample with summary
  stats, a reviewed-categorization table, owner answers, accountant
  follow-up rows, and the CSV-export explanation.
- Carries a visible **"Static sample preview — live backend
  temporarily unavailable"** badge so the user never confuses it for
  live data.
- Keeps the "not tax advice" disclaimer + the three CTAs (Retry,
  Owner: where do I start?, Technical story).

`/app` and `/demo` continue to use `<DemoUnavailablePanel>` (shipped
in the public-demo incident hotfix). `/start` is a pure static
route — no backend dependency at all.

Together: every owner-facing or money-shot page is presentable
through any partial backend outage.
