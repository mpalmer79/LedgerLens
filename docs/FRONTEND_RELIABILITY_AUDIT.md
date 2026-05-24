# Frontend reliability audit

## 1. Current API client behavior

`frontend/src/lib/api/client.ts:apiFetch` (lines 61–119) is a thin
wrapper around `fetch()`:

- ❌ **No timeout** — a hung backend hangs the page indefinitely. The
  user sees an infinite spinner.
- ❌ **No abort signal** — navigating away mid-fetch leaks the
  in-flight request; a state update after unmount logs a warning.
- ❌ **No retry** — a single 503 / 504 / transient TCP error fails the
  whole page, even for safe GETs.
- ✅ **Typed error envelope** — `ApiError` carries `status`, `code`,
  `message`, optional `details`. FastAPI `{"detail": {...}}` is
  parsed correctly.
- ✅ **Network errors are categorized** — `fetch` rejection lands in
  the catch as `ApiError(code="network_error", status=0)`. Distinguishes
  "backend is down" from "backend responded 5xx."

## 2. Current loading-state behavior

Every page that loads data follows the same hand-rolled pattern:

```ts
const [state, setState] = useState({ loading: true, error: null, ... });
useEffect(() => { (async () => { ... })(); }, []);
```

Loading rendering is one of three things across the codebase:

- `<p className="...text-text-subtle">Loading…</p>` (the most common —
  /cleanup, /questions, /handoff, /ledger, /rules, /corrections).
- A `Loader2` icon from `lucide-react` rotating inline (`CheckApiButton`).
- Nothing at all — the page renders empty until data lands (a few
  table pages).

There's no shared `LoadingState` component, no skeleton screen, no
"loading is taking longer than expected" hint after N seconds.

## 3. Current error-state behavior

Every page reinvents error display. The repeated pattern is:

```tsx
{state.error && (
  <div className="...border-red-200 bg-red-50 p-4 text-red-700">
    {state.error}
  </div>
)}
```

with the error string built from `err.message + (err.status ? " (HTTP " + err.status + ")" : "")`.

Gaps:

- ❌ **No retry button.** A failed page is a permanent dead-end until
  the user manually refreshes the browser.
- ❌ **No plain-English copy.** "Failed to fetch (HTTP 500)" is the
  literal text a small-business owner sees.
- ❌ **No secondary actions.** A user staring at an error has no link
  to "go home" / "open cleanup" / "see the technical story."
- ❌ **No variant system.** Backend unavailable (network_error) and
  500 server error look the same.

## 4. Pages most likely to fail awkwardly

| Page | Failure mode today | Severity |
|---|---|---|
| `/cleanup` | Single error string at top; counts cards show "Loading…" forever. | High — this is the primary CTA from the homepage. |
| `/questions` | Page-level error blocks all cards. A save failure leaves the user's selected answer invisible to them. | High — the workflow page. |
| `/handoff` | Same single-error pattern. **Markdown / CSV downloads have no error handling at all** — they're plain `<a download>` links. A download that 500s silently fails. | High — this is the deliverable surface. |
| `/demo` | Per-step error state is decent, but the scenario card disappears entirely if `/demo/scenario` 503s. | Medium. |
| `/app` | Combines 6+ parallel calls into one error string; one failed call hides everything else. | Medium. |
| `/transactions/[id]` | Six parallel calls behind one try/catch; a missing transaction looks like a server error. | Medium. |
| `/transactions/import` | CSV row-level errors are surfaced fine; a 500 from the endpoint itself shows the raw status string. | Low. |
| `/review`, `/ledger`, `/rules`, `/corrections` | Same single-error pattern; tables vanish on error. | Low-medium. |
| `/evals` | Static-generated from on-disk files; only fails at build time. | None at runtime. |

## 5. Public demo risk areas

1. **A LinkedIn click that lands on `/cleanup` while Railway is cold-starting** sees an infinite spinner. There is no timeout. There is no "the demo backend is waking up — try again" copy.
2. **`/handoff/export.md` returning 500** silently downloads nothing. The user clicks the button, nothing happens, they assume the product is broken.
3. **`/demo/seed` succeeding but `/demo/status` failing on refresh** leaves the page in an ambiguous "did the seed work?" state. The fix is a clean reload, but a casual user won't know that.
4. **Double-clicking the seed or reset button** sends two requests. Today the second one wins or 500s. The buttons aren't disabled while in flight.
5. **A reviewer hitting `/questions` with one corrupt review item** — the whole list disappears because the page-level error wipes the queue. One bad item shouldn't blank the page.

## 6. CI/test enforcement gap

`.github/workflows/ci.yml`:

- **Backend job** runs ruff, ruff format check, mypy --strict, and
  pytest (146 tests today). Solid.
- **Frontend job** runs `npm run lint` and `npm run build` only. The
  119 frontend tests (vitest) are **not** enforced by CI. They pass
  locally, but a regression in a frontend test would land in main
  without anyone noticing.

This is the most concrete gap on the project — the test story is half
local and half CI. Closing it is one line in the workflow file.

## 7. Recommended reliability scope for this sprint

In priority order:

1. **Harden `apiFetch`** — add a default 10s timeout, retry-once for
   safe GETs on network errors and 5xx, never retry mutations. Enrich
   `ApiError` with `retryable: boolean` and a `userMessage` field that
   pages can render verbatim.
2. **Three small reusable state components** — `LoadingState`,
   `EmptyState`, `ErrorState`. ErrorState supports a `variant`
   (`default | warning | demo`), a `retry` callback, a secondary
   action, and an optional `<details>` panel for the raw error.
3. **Harden the five exposed pages** — `/cleanup`, `/questions`,
   `/handoff`, `/demo`, `/app`. Use the new components for every
   loading / empty / error surface. Disable mutation buttons while
   in flight. Show export-error inline on `/handoff`.
4. **Add `npm test -- --run` to CI**. One line in
   `.github/workflows/ci.yml`.
5. **Write a deployment smoke checklist** — 15-step manual QA list a
   reviewer can walk in 5 minutes before a launch.
6. **Reliability + smoke-test docs** — short and honest.

The `AppShell` already has a `HealthDot` indicator (checking / ok /
unreachable). It's good enough — no separate backend-health panel is
needed.

## 8. What should wait for later

- **Skeleton screens** — `LoadingState` ships as a text-and-spinner;
  skeletons are a nicer polish for a later sprint.
- **Periodic background re-polling of `/health`** — overkill for a
  portfolio demo; the on-mount + on-focus check is enough.
- **Per-request observability / request IDs** — listed as a candidate
  next-PR; not a fit for this sprint.
- **Hardening the lower-traffic table pages (`/review`, `/ledger`,
  `/rules`, `/corrections`, `/transactions/[id]`)** beyond converting
  their error rendering to `ErrorState` — they're not on the
  small-business owner's path.
- **Schema validation of API responses (zod / valibot)** — would catch
  real bugs but adds a runtime dependency. Defer.
- **A "request is taking longer than expected" 2-second hint inside
  `LoadingState`** — nice-to-have polish, not blocking.
- **Toast notifications for mutation success / failure** — out of scope.
  Inline errors on the page are sufficient.

## Acceptance criteria

- Audit identifies concrete routes and components needing hardening.
- Sprint scope is clear: API client + 3 components + 5 pages + CI +
  smoke doc. Nothing more.
- Honesty contracts untouched: no AI-accuracy claims, no removal of
  sample-scenario disclaimers, no addition of email / phone /
  resume links.
