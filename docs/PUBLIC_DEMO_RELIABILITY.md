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
