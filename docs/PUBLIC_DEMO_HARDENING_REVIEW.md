# Public-demo hardening — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| `apiFetch` (frontend) | Raw `fetch()`. No timeout, no abort, no retry. `ApiError` carried `status / code / message / details`. | **10s default timeout** (AbortController-driven, composes with caller's signal). **Retry-once on safe GETs** for transient failures (network error, timeout, 408, 425, 429, 5xx). **Mutations never auto-retried.** `ApiError` enriched with `retryable: boolean` + `userMessage: string`. New `ApiFetchOptions` shape exposes `timeoutMs / retries / retryDelayMs / signal` per call. |
| Reusable state UI | None — every page reinvented loading / empty / error display. | **`<LoadingState>`** (label + spinner, accessible status role), **`<EmptyState>`** (icon + title + message + primary + secondary action), **`<ErrorState>`** (variant + retry + secondary action + collapsed technical details). All in `frontend/src/components/ui/DataState.tsx`. |
| `/cleanup` | Inline red error div; "Loading…" `<p>`; hand-rolled empty state. Page-level error blocked all retry. | Shared `ErrorState` with `onRetry` (re-runs the load) + secondary "Read the technical story" link. Shared `LoadingState`. Sample-scenario empty state preserved. |
| `/questions` | Page-level error wiped the queue. A failed save cleared the page. | Shared `ErrorState` with retry. Shared `LoadingState`. Shared `EmptyState` for the "No owner questions right now" case with "View accountant handoff" + "Open cleanup checklist" CTAs. **Per-card `saveErrors` map** so one failed save shows an inline error on **that card only** without clearing the rest of the queue. |
| `/handoff` | Inline error div. **Markdown / CSV downloads were plain `<a download>` — a 500 silently downloaded nothing.** | Shared `ErrorState` with retry. Shared `LoadingState`. New "No handoff package yet" empty state (when the DB is empty) with "Start monthly cleanup" + "Try the sample scenario" CTAs. **Downloads are now button-driven `handleDownload`** that probes the URL with a `HEAD` request first and surfaces an inline error if it fails. Each download has its own error region so a markdown failure doesn't hide the CSV button. |
| `/demo` | Scenario load bundled with status/samples in one `Promise.all` — one failure broke everything. Reset button could be double-clicked. | Scenario load is fire-and-forget; status + samples remain critical. **Reset button now shows "Resetting…" and is disabled while in flight.** Seed handler short-circuits if already running. Scenario card is omitted gracefully if `/demo/scenario` 503s. |
| `/app` | Inline backend-unreachable panel with hand-rolled copy. Page reload was the only retry path. | Shared `ErrorState` with `onRetry` (re-runs the load) + secondary "Open cleanup checklist" link. Existing local `EmptyState` helper inside cards preserved (different signature; used for inline list-empty states). |
| `AppShell` `HealthDot` | Already shipped (checking / ok / unreachable). | Unchanged — already adequate. The reliability layer leans on it for the always-visible health signal. |
| CI workflow | Backend job ran ruff + ruff format + mypy + pytest. Frontend job ran lint + build **but not tests.** | Frontend job now runs **`npm test -- --run`** between lint and build. Workflow name updated to `Frontend (lint, test, build)`. |
| Deployment QA | Ad-hoc, undocumented. | New `docs/DEPLOYMENT_SMOKE_TEST.md` — 17-step manual checklist + 5 failure-mode spot-check rows. |
| Docs | No reliability layer doc. | New `docs/FRONTEND_RELIABILITY_AUDIT.md` (planning audit) + `docs/PUBLIC_DEMO_RELIABILITY.md` (reference) + this review. |
| Honesty | "Trust metric is workflow-level — not raw model accuracy." | Preserved. No claim removed; no email / phone / resume link added; "Fictional sample scenario" badges and "not tax advice or substitute for accounting review" disclaimer untouched. |

## 2. Reliability gaps before this sprint

The audit (`docs/FRONTEND_RELIABILITY_AUDIT.md`) called out seven concrete
gaps. Status after this sprint:

| Gap | Status |
|---|---|
| No timeout on `apiFetch` — infinite spinner on a hung backend. | **Fixed** — 10s default timeout, configurable. |
| No retry — single 503 / blip kills the page. | **Fixed** — retry-once for safe GETs on transient failures; mutations explicitly never auto-retry. |
| No shared error UI — every page reinvented it. | **Fixed** — `<ErrorState>` everywhere on the five exposed pages. |
| No shared empty-state component. | **Fixed** — `<EmptyState>` shipped; used on `/questions` and `/handoff`. |
| Markdown / CSV downloads on `/handoff` silently failed. | **Fixed** — `HEAD` probe + inline error panel per button. |
| Demo seed / reset buttons could be double-clicked. | **Fixed** — `Resetting…` disabled state on reset; seed handler short-circuits if running. |
| Frontend tests not enforced in CI. | **Fixed** — `npm test -- --run` added to the frontend workflow. |

## 3. API client changes

`frontend/src/lib/api/client.ts` is now ~270 lines instead of ~119. The
public surface is backwards-compatible — every existing helper
(`listTransactions`, `getReviewQueue`, `getHandoff`, `seedDemo`, etc.)
still works the same way. New behavior is opt-out via the new
`ApiFetchOptions` parameter on `apiFetch` itself.

Key concepts:

- **`isRetryableStatus(status, code)`** — single source of truth for
  what counts as transient. `network_error`, `timeout`, 408, 425, 429,
  and any 5xx.
- **`userMessageFor(status, code, fallback)`** — single source of truth
  for the plain-English copy attached to common failure modes. Other
  modules can read `apiErr.userMessage` and render it verbatim.
- **`apiFetchOnce`** — the inner per-attempt function. Composes the
  caller's `signal` with a timeout `AbortController`, parses the
  response, throws on non-2xx. The outer `apiFetch` wraps it in the
  retry loop.

## 4. Loading / empty / error-state strategy

Three components, one mental model:

- **Loading** = "we don't know yet". Render `<LoadingState>`.
- **Empty** = "we know, and the answer is *nothing*". Render
  `<EmptyState>` with a CTA pointing at the natural next step.
- **Error** = "we tried and it failed". Render `<ErrorState>` with a
  retry button. Never silently a zero-count state — a request that
  500'd never reads as "0 verified rows" in the UI.

Same wording everywhere; same accessibility roles (`status` / `alert`);
same Tailwind tone classes.

## 5. Route-by-route improvements

- **`/cleanup`** — `useCallback`-wrapped `load()`; shared
  `ErrorState` with retry + technical-story link; shared
  `LoadingState`.
- **`/questions`** — same `load()` pattern; shared `ErrorState` with
  retry + cleanup link; shared `LoadingState`; shared `EmptyState`
  for "No owner questions right now"; per-card `saveErrors` map so
  one card's failure doesn't blank the queue; inline "Could not save
  this answer" red panel with a Dismiss button on the failing card
  only.
- **`/handoff`** — same `load()` pattern; shared `ErrorState`,
  `LoadingState`, `EmptyState`. Downloads converted from
  `<a download>` to `handleDownload` callbacks that `HEAD` the URL
  before navigating, surfacing per-button error panels on failure.
- **`/demo`** — scenario load decoupled from status + samples;
  `resetting` boolean disables the reset button mid-flight;
  `handleSeed` short-circuits if seed is already running.
- **`/app`** — `useCallback`-wrapped `load()`; shared `ErrorState`
  with retry + cleanup-checklist link.

The lower-traffic table pages (`/transactions`, `/review`, `/ledger`,
`/rules`, `/corrections`, `/transactions/[id]`, `/transactions/import`)
were intentionally **not** touched in this sprint. The audit lists them
as Low-medium severity; they all already display error strings (not
blank pages) and they aren't on the small-business owner's path. A
later sprint can convert them to `<ErrorState>` for consistency, but
it's not blocking.

## 6. Backend changes

**None.** The reliability sprint is frontend-only. The existing
`/health` and `/ready` endpoints (used by the `HealthDot`) are
unchanged.

The 146 backend tests still pass without modification. Anthropic SDK
remains never-imported in demo mode (the regression test in
`test_demo.py::test_seed_does_not_import_anthropic_sdk` still passes).

## 7. CI changes

`.github/workflows/ci.yml`, frontend job:

```diff
   - name: Lint
     run: npm run lint

+  - name: Test
+    run: npm test -- --run
+
   - name: Build
     run: npm run build
```

The job name updates to `Frontend (lint, test, build)`. Backend
workflow is unchanged.

## 8. Deployment smoke checklist

`docs/DEPLOYMENT_SMOKE_TEST.md` ships a 17-step manual checklist and
five failure-mode spot checks. Designed for the 5 minutes before
announcing a deploy or sharing a LinkedIn post. Honesty contracts are
explicit acceptance criteria (no "100% AI accuracy", no missing
disclaimers, no email / phone / resume in the rendered pages).

## 9. Tests added/updated

**Frontend (146 passed, +27):**

| New tests | Coverage |
|---|---|
| `DataState.test.tsx` (9 tests) | `<LoadingState>` default + custom label; `<EmptyState>` title / message / actions; `<ErrorState>` generic case, `ApiError.userMessage` consumption, retry button toggle, secondary-action slot, technical-details disclosure. |
| `client.test.ts` `ApiError envelope` (3 tests) | `userMessage + retryable` on network error; retryable matrix (503 / 504 / 429 / 404 / 400); plain-English `userMessage` for common failure modes. |
| `client.test.ts` `retry behavior` (5 tests) | Safe GETs retry once on network error; safe GETs retry on 503; POST mutations not retried on 5xx; POST mutations not retried on network error; GETs not retried on 404; success on the second attempt. |
| `page-content.test.ts` (+9 assertions across `/cleanup`, `/questions`, `/handoff`, `/demo`, `/app`) | Each page imports and uses the shared `ErrorState` / `LoadingState`; `/questions` and `/handoff` use `EmptyState`; download probe / inline error copy / per-card save errors / double-click guards / scenario-load-is-non-critical all asserted. |

**Backend (146 passed, +0):** unchanged.

**Build / lint / typecheck:**

- `cd backend && pytest -q` → **146 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → 85 files already formatted
- `cd backend && mypy --strict src` → no issues found in 58 source files
- `cd frontend && npm test -- --run` → **146 passed (11 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build

## 10. Mobile / tablet QA notes

The new components were designed mobile-first:

- **`<LoadingState>`** — single line; clamp-friendly inline layout.
- **`<EmptyState>`** — `flex flex-wrap items-center justify-center
  gap-3`; primary + secondary actions stack on phones.
- **`<ErrorState>`** — `flex items-start gap-3`; retry + secondary
  action use `flex-wrap`. Technical details `<details>` panel is
  collapsed by default and doesn't add visual weight at 360px.

Manual responsive verification recommended at 360 / 375 / 430 / 768 /
1024 / 1280 once deployed. The smoke checklist (`docs/DEPLOYMENT_SMOKE_TEST.md`)
includes a 375px pass.

## 11. Remaining weaknesses

- **No skeleton screens.** Loading state is a simple spinner + text.
- **No periodic `/health` re-polling.** Updates on mount and focus
  only.
- **No exponential backoff or jitter.** Single 600ms retry delay.
- **No request IDs in the error UI.** Backend doesn't echo a
  `X-Request-Id` header today; adding it would make user-reported
  failures easier to triage.
- **Table-heavy pages still use the old inline error rendering.**
  `/transactions`, `/transactions/import`, `/transactions/[id]`,
  `/review`, `/ledger`, `/rules`, `/corrections`. Not blocking, but a
  consistency win is on the table.
- **No toast / notification system.** Inline errors only. Multi-step
  flows on `/transactions` could benefit from one later.
- **API responses are not schema-validated at the boundary.** Type
  safety is static; a backend schema drift would surface as a deep
  runtime error. Adding zod / valibot is a deliberate out-of-scope
  call (new runtime dependency).

## 12. Recommended next PR

In priority order:

1. **Owner-question free-text field (`/questions` v2).** The walkthrough
   rescript review and the sample-scenario review both named this as
   the strongest follow-up. A small `<textarea>` next to "Needs
   accountant review" so the owner can paste context, surfaced into
   the handoff markdown's "Questions answered by owner" section. This
   directly strengthens the artefact the rest of the sprint produced.
2. **Per-tenant rule generation from correction memory.** Still the
   highest-value engineering follow-up. The sample-scenario sprint
   gave Granite State Auto Repair a realistic dataset; the next move
   is to learn from it.
3. **Backend request IDs + frontend echo.** A `X-Request-Id` header on
   every response, surfaced in the `<ErrorState>` technical-details
   panel. Cheap, high impact for debugging.
4. **Extend `<ErrorState>` / `<EmptyState>` to the remaining
   table-heavy pages.** Consistency win; not blocking.
5. **QuickBooks-friendly CSV export mapping.** Map the handoff CSV
   to IIF or QuickBooks Online's import format so an accountant can
   drop it in without transformation.

The recommended single next PR is **#1 (owner-question free-text
field)** because it builds directly on what this sprint just made
robust — the questions workflow can now afford a richer answer model
without worrying about the save path breaking the page.
