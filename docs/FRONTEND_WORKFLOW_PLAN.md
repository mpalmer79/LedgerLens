# Frontend workflow plan

**Builds on:** PR #23 (backend bookkeeping workflow foundation, merged on `main` as `7657bb8`).

**Goal:** turn `/` from a landing page + an eval dashboard into a clickable bookkeeping application that uses the real backend endpoints.

## Routes

| Route | Purpose | Backend endpoints used |
|---|---|---|
| `/` | Landing page (kept). Adds a "Launch the app" CTA to `/app`. | — |
| `/evals` | Eval dashboard (kept). Adds a "model accuracy is not production-ready" warning callout. | — (build-time JSON) |
| `/app` | Workflow dashboard. Summary tiles + recent activity + next actions. | `GET /transactions`, `GET /review-queue`, `GET /audit/events`, `GET /ledger` |
| `/transactions` | Filterable list of all transactions. Per-row categorize action; batch-categorize selected. | `GET /transactions`, `POST /categorize`, `POST /categorize/batch`, `GET /transactions/{id}/categorization-results` |
| `/transactions/import` | CSV upload, preview, submit, results. | `POST /transactions/import` |
| `/transactions/[id]` | Transaction detail: raw, normalized, latest + all categorizations, review actions, per-entity audit trail. | `GET /transactions/{id}`, `GET /transactions/{id}/categorization-results`, `POST /categorize`, `GET /categories`, `POST /review-queue/{id}/{approve,correct,uncategorizable}`, `GET /audit/events?entity_id=...` |
| `/review` | Review queue. Approve, correct (category dropdown from `GET /categories`), mark uncategorizable. | `GET /review-queue`, `GET /categories`, `POST /review-queue/{id}/{approve,correct,uncategorizable}` |
| `/ledger` | Finalized ledger with unresolved-count warning. Export CSV. | `GET /ledger`, `GET /ledger/export.csv` |

## API client

- File: `frontend/src/lib/api/client.ts` + `frontend/src/lib/api/types.ts`.
- Base URL: `process.env.NEXT_PUBLIC_API_BASE_URL` (already injected at Docker build time per ADR-0007). Default for local dev: `http://localhost:8000`.
- One `apiFetch<T>()` helper handles JSON, error parsing (backend returns `{detail: {error, message, ...}}` for HTTPException; non-JSON failures fall through with the response status). All typed functions wrap it.
- Types mirror the backend Pydantic schemas in `backend/src/ledgerlens/api/schemas.py`.

## App shell

- Top nav across `/app`, `/transactions`, `/review`, `/ledger`, `/evals` with a "Demo prototype" pill and a live "API: ok/unreachable" indicator (polls `/health` once on mount, then on focus).
- Landing `/` keeps its current hero/eval-teaser layout and adds an "Open the app →" link in the top nav and in a new ribbon below the intro.

## Acceptance criteria

1. A user can land on `/`, click "Open the app", land on `/app`, import the sample CSV, click into `/transactions`, run categorize on individual or batch rows, route some to `/review`, approve/correct from `/review` or detail, view `/ledger`, export CSV, and inspect audit events on detail — without ever touching the backend directly.
2. Every page that hits the backend shows distinct loading, empty, error, and populated states.
3. All HTTP traffic goes through the typed client; no `fetch(` in page components.
4. The categorize and correct actions use the real backend endpoints; no mock/fake data behind these calls.
5. `npm run build` and `npm run lint` pass.
6. Backend tests stay green; no backend changes in this PR.

## Out of scope (explicit, documented in `docs/IMPLEMENTATION_GAP_ANALYSIS.md`)

- Auth/multi-tenancy. UI labels itself as a demo prototype.
- Server-side pagination beyond what the backend already supports. Pages load top 200 rows max.
- React Query / SWR / state libraries. Pages own their fetch lifecycle with `useState`/`useEffect`; this is a 7-page app, not 70.
- Heavy frontend test framework. Pure-function tests on the API client get a vitest setup; page tests are deferred and the gap is named.
- Hybrid categorizer, correction-memory retrieval, eval-metric upgrades, security baseline — those each have their own session in the gap analysis.
