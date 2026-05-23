# LedgerLens — Implementation gap analysis

**Status as of 2026-05-22.** Most recently updated alongside session 13 (correction memory). Specific to the files on `main` after PRs #23 (backend foundation), #24 (frontend workflow), and #25 (correction memory).

This document maps what is implemented, what is implied but missing, what needs to exist to call LedgerLens a working bookkeeping app, and how the remaining work should be sequenced.

## Status changes since the original draft

- **Backend foundation — shipped (PR #23).** Items #1–#8 and #10 in the priority table below are complete: lazy settings + `/health` + `/ready`, SQLAlchemy persistence layer, transaction intake (single, batch, CSV import), categorize endpoint with confidence routing, review queue (approve / correct / uncategorizable), audit trail on every state change, ledger CSV export.
- **Frontend workflow pages — shipped (PR #24).** Item #9 in the table: `/app`, `/transactions`, `/transactions/import`, `/transactions/[id]`, `/review`, `/ledger` are real, talk to the typed API client, and surface the live backend.
- **Correction memory — shipped (PR #25).** Item #12 in the table: deterministic, exact-key correction memory. Human corrections create `CorrectionMemory` rows; future transactions matching the same key categorize from memory at zero model cost; conflicts route to review; generic merchants are explicitly excluded. This is rule lookup over a model categorizer — not training, not fine-tuning, not embeddings.
- **Hybrid rules + model categorizer — shipped (PR #26).** Item #13 in the table: a deterministic rule layer sits between correction memory and the model. ~25 curated rules in `backend/src/ledgerlens/data/category_rules.json` validated against the active chart of accounts at load time. Strong matches (rule confidence ≥ auto threshold) auto-approve with `provider = rule_categorizer`, zero cost, and an explanation citing the matched rule id. Below-auto matches route to review. Conflicting matches route to review. New endpoints `GET /rules` and `GET /transactions/{id}/rule-matches`; new frontend page `/rules`. The pipeline order is now: **memory → rules → model → confidence routing → human review → audit.**
- **Portfolio-safe demo mode — shipped (PR #28).** New `CATEGORIZER_MODE` env var with values `demo_stub` (default) and `anthropic`. In demo mode the fallback layer is a deterministic zero-cost stub (`DemoStubCategorizer`) that returns `UNCATEGORIZABLE` so unmatched transactions land in human review. The `anthropic` SDK is never imported in demo mode (regression-tested). `/ready` now reports `categorizer.mode` and `anthropic.required_for_current_mode` honestly. New `docs/PORTFOLIO_DEPLOYMENT.md`. Closes the "deploy demos shouldn't cost real money" concern.
- **Product story overhaul — shipped (PR #29).** Landing page rewritten around the small-business bookkeeping problem with three business value cards and a recruiter-facing technical-credibility section. New `/demo` guided journey (seven narrative steps) driven by real backend calls — load samples, layered categorization, route-to-review, correct, watch memory replay, export ledger. New backend endpoints `GET /demo/{status,sample-transactions}` (safe in any mode) and `POST /demo/{seed,reset}` (guarded to `CATEGORIZER_MODE=demo_stub`). Page-level copy upgrades on `/app`, `/review`, `/corrections`, `/rules`, `/ledger`. New `docs/LINKEDIN_PROJECT_STORY.md`, `docs/PRODUCT_OWNER_REVIEW.md`, `docs/PRODUCT_STORY_OVERHAUL_PLAN.md`. README intro rewritten.
- **Trust metric — shipped (this PR).** New product-level metric: "100% of finalized guided-demo ledger rows are verified before export." A finalized row counts as verified only when it came from a rule auto-approval, a correction-memory replay, or an explicit human review. Demo-stub results and unreviewed model auto-approvals are explicitly NOT verified. New `LedgerTrust` schema, `trust` block on `/ledger`, `model_provider` + `verified` columns on the CSV export, new `TrustPanel` component on `/demo` step 6 and `/ledger`. Landing page reframed: raw model accuracy demoted from the headline; trust panel becomes the product's headline number. Eval page gets an "Raw model accuracy is not the product's trust boundary" callout. New `docs/TRUST_METRIC.md`.

The priority table below is kept in its original form for traceability — items 1–10, 12, and 13 are now done; items 11 and 14 onward remain as the forward backlog. Item #15 (security baseline) gains the portfolio-mode toggle as a partial credit toward credible deploy operations. The next natural milestone is **per-tenant rule generation** so rules-only and hybrid eval modes can be benchmarked meaningfully against the synthetic dataset.

---

## 1. What is actually implemented

### Backend (`backend/`)

- **`ledgerlens.main`** — a FastAPI app with exactly one route: `GET /health`. Returns `{"status": "ok", "service": "ledgerlens-api"}`. Constructed in `create_app()`; module-level `app = create_app()` runs `get_settings()` at import.
- **`ledgerlens.config`** — Pydantic Settings reading `ANTHROPIC_API_KEY`, `DATABASE_URL`, model identifiers, threshold constants, log level, CORS origins, and app version. Both `anthropic_api_key` and `database_url` are required strings with no defaults. `get_settings()` is `lru_cache`-wrapped; calling it without env vars set raises `ValidationError`.
- **`ledgerlens.categorizers.base`** — `Categorizer` Protocol (`name: str` + `categorize(transaction, business, chart_of_accounts) -> CategorizationResult`) and the `CategorizationResult` Pydantic model.
- **`ledgerlens.categorizers.stub`** — `StubCategorizer` returning the first expense account at confidence 0.5.
- **`ledgerlens.categorizers.claude_haiku`** — `ClaudeHaikuCategorizer` calling Anthropic Haiku via tool_use, parsing the response into `CategorizationResult`, with one retry on validation failure and `UNCATEGORIZABLE` fallback on API error.
- **`ledgerlens.categorizers.prompts`** — `build_system_prompt()` and `build_user_prompt()`, plus `format_amount()`.
- **`ledgerlens.evals`** — schemas, loader, metrics, harness, writer, and CLI (`python -m ledgerlens.evals.run`). All read-side: no database.

### Eval pipeline

- Synthetic v0 dataset: 3 businesses, 302 transactions, 31 adversarial, committed under `evals/datasets/v0/`.
- Stub run committed at `evals/runs/2026-05-21-stub-v1.json` (9.3% overall).
- Claude Haiku run committed at `evals/runs/2026-05-22-claude-haiku-v1.json` (62.9% overall, 65.3% non-adversarial, 41.9% adversarial, $0.34/100 transactions, p95 latency 5,952 ms).
- GitHub Actions workflow `.github/workflows/eval.yml` triggers runs manually and auto-commits artifacts.

### Frontend (`frontend/`)

- Landing page `/` — hero with 3D transaction-card carousel (Three.js), "What am I looking at?" intro, three pillars, eval-results CTA (Featured), live API-health widget, footer.
- Eval dashboard `/evals` — reads `evals/runs/*.json` at build time; renders headline metrics, stub-vs-Haiku comparison chart (Recharts), reliability scatter, per-business table, adversarial deep-dive cards.

### Infrastructure

- Backend `Dockerfile` (single-stage Python 3.12) and Railway config.
- Frontend `Dockerfile` (single-stage Node 20) with `evals/` copied into the build context so the dashboard loads real artifacts.
- Root `railway.toml` for the frontend, `backend/railway.toml` for the backend.
- CI workflow `.github/workflows/ci.yml` runs ruff / ruff format / mypy strict / pytest on backend, lint + build on frontend.

### Docs

- 15 accepted ADRs covering decisions through 0015 (with 0008 skipped — no ADR exists for that number).
- `docs/ARCHITECTURE.md` — 13-section design spec, written aspirationally; some sections describe the planned system, not the shipped one.

---

## 2. What is implied or claimed but not implemented

### Backend application surface (the biggest gap)

The repo positions LedgerLens as "an AI-assisted transaction categorization system" with "categorization → confidence routing → human review → corrections → audit." None of that workflow exists in the backend application yet — only as eval-side batch processing reading committed JSON.

Specifically missing:

- **No persistence layer.** SQLAlchemy and Alembic are in `pyproject.toml`, but no models, sessions, migrations, or repositories exist. The settings loader expects a `DATABASE_URL` and there's no code that uses it.
- **No transaction endpoints.** No `POST /transactions`, no `GET /transactions`, no CSV import. The product can't accept a transaction from a user.
- **No categorization endpoint.** The `ClaudeHaikuCategorizer` exists, but there's no HTTP route that invokes it on a stored transaction.
- **No review queue.** `ARCHITECTURE.md §4` describes routing thresholds and `LEDGERLENS_AUTO_QUEUE_THRESHOLD = 0.90`, `LEDGERLENS_REVIEW_QUEUE_THRESHOLD = 0.60` are in settings, but no endpoint applies these thresholds to a stored result.
- **No corrections loop.** The "learns from corrections" story doesn't have a `corrections` table or a retrieval lookup.
- **No audit trail.** Settings has `LOG_LEVEL` but no AuditEvent model, no audit endpoint.
- **No ledger export.** The categorized output that bookkeepers would need is not exportable.

### Backend startup robustness

- `app = create_app()` calls `get_settings()` at import time. Without `ANTHROPIC_API_KEY` and `DATABASE_URL` set, importing `ledgerlens.main` raises `ValidationError`. Tests work around this with `backend/tests/conftest.py` setting dummy env vars. The Railway deployment requires both vars even though only categorization actually needs the API key.
- `/health` indirectly depends on `get_settings()` succeeding because the route is registered after settings load.
- There is no `/ready` endpoint distinguishing process-up from dependencies-ready.

### Frontend product surface

- Frontend has two real pages (`/` and `/evals`). The product workflow — transaction list, review queue, ledger view, import — is not implemented.
- The eval dashboard reads JSON at build time; if no Haiku run is present in the build context, it falls back to a placeholder (handled by ADR-0011 follow-up).

### Documentation drift

- `README.md` line 42 has unresolved placeholder cells: `<HAIKU_ACCURACY>`, `<HAIKU_NON_ADV>`, `<HAIKU_ADV>`, `<HAIKU_COST>`. The committed Haiku run has real values (62.9% / 65.3% / 41.9% / $0.34) that should fill these.
- `README.md` references ADRs with broken paths: `0004-categorizer-protocol.md` (real file: `0004-eval-harness-architecture.md`), `0005-single-model-v0.md` (real: `0005-single-model-categorizer-v0.md`), and `0008-env-var-list-parsing.md` (no ADR-0008 exists at all).
- `README.md` claims "ADRs: 10" in the badge, but 15 ADRs are accepted (with 0008 skipped). Either correct the count or actually write 0008.
- `docs/ARCHITECTURE.md` describes pgvector retrieval, corrections-driven learning, an LLM-as-judge for reasoning quality, and observability that are not built. Sections are not labeled with implementation status.
- `docs/PRODUCT_BRIEF.md` does not exist; sessions referenced it as a source.

### Eval methodology issues

- Per-category precision/recall is computed by `metrics.per_category_precision_recall` using the full ground truth on every slice. When called on the adversarial slice, only adversarial predictions are in the `predictions` list — that's correct — but the ground truth dict still contains all 302 transactions. Result: support values are inflated and recall numbers for low-support categories are misleading. This is documented here as a known issue, not yet fixed.
- The reliability diagram exists but there's no expected calibration error (ECE) summary number.
- There's no baseline comparison beyond stub-vs-model.

---

## 3. What needs to exist for LedgerLens to be a working bookkeeping app

The minimum end-to-end workflow:

1. **Intake.** Upload a CSV of bank transactions OR POST individual transactions. Normalize the description, preserve the raw, persist.
2. **Categorize.** Run the categorizer (Haiku, optionally with a rule layer) over each transaction. Persist the result with confidence, explanation, latency, cost, and model metadata.
3. **Route.** Apply the confidence thresholds. Mark each as `auto_approved`, `needs_review`, or `uncategorizable`.
4. **Review.** Show a queue of `needs_review` transactions. Reviewer approves, corrects, or marks uncategorizable. Each decision is audited.
5. **Learn.** Corrections feed back into future categorizations (initially as a deterministic merchant-keyed lookup; pgvector retrieval is future work).
6. **Export.** Generate a CSV of the finalized ledger with the resolved category per transaction.
7. **Audit.** Every state change writes an `AuditEvent` row; an endpoint lists them.

Underneath all that:

- A real persistence layer (SQLite for demo, Postgres for any real deployment).
- A configuration model that lets the backend start without a model-provider key (so the health-check works in any environment, regardless of secrets).
- A frontend that actually drives the workflow, not only a marketing page + an eval dashboard.

---

## 4. Priority ranking of missing capabilities

| # | Capability | Why this rank |
|---|---|---|
| 1 | Backend startup hardening (lazy settings, real `/health`, `/ready`) | Everything else assumes the app can start. Currently fragile in deployed environments. |
| 2 | Persistence layer (SQLAlchemy + Alembic + SQLite) | Every product endpoint downstream needs to persist. |
| 3 | Transaction intake API (`POST /transactions`, list, get) | Without this, there's no way to put data into the system through HTTP. |
| 4 | Categorize endpoint (`POST /categorize`) | The product's headline feature, currently only exists as a batch eval. |
| 5 | Confidence routing → status | Specified in ADR-0005 and architectures docs; not implemented. |
| 6 | Review queue endpoints (approve / correct / uncategorizable) | The human-in-the-loop pillar the marketing page advertises. |
| 7 | Audit events | "Auditable by design" is one of the three pillars; needs to be more than a tagline. |
| 8 | Ledger export (CSV) | The actual deliverable a bookkeeper would want. |
| 9 | Frontend workflow pages (`/app`, `/transactions`, `/review`, `/ledger`) | Without this the product isn't usable from a browser. |
| 10 | CSV import endpoint | Real bookkeepers don't paste JSON. |
| 11 | Doc cleanup (placeholders, ADR links, status labels) | Stops the repo from looking unfinished to reviewers. |
| 12 | Correction memory (deterministic merchant lookup) | Closes the feedback loop. |
| 13 | Hybrid rules + model categorizer | Better accuracy on obvious cases at lower cost. |
| 14 | Eval harness fixes (sliced metrics, ECE, baseline rules) | Improves the project's evaluation credibility. |
| 15 | Security baseline (input limits, log redaction, narrow CORS) | Required for credibility on financial data. |
| 16 | Observability (structured logs, request IDs, cost tracking endpoint) | Operational basics. |
| 17 | Demo data + seed flow | Enables a recruiter to click through the workflow. |
| 18 | CI gates (no-placeholder check, eval schema validation) | Stops drift from recurring. |
| 19 | Deployment hardening (env var docs, Dockerfile review post-changes) | Last-mile, after the rest works. |
| 20 | Frontend test framework | Lowest priority — useful but not blocking. |

---

## 5. Risks and technical debt

- **`get_settings()` at import time** couples app start to env-var presence. Tests work around it; production deploys require both `ANTHROPIC_API_KEY` and `DATABASE_URL` to be set even though they're not needed for `/health`. Risk: hard to debug deployment failures.
- **No request-ID propagation or structured logging.** Once multiple endpoints exist, debugging a misbehaving categorization across the categorize/route/store/audit path will be miserable.
- **`evals/datasets/v0/` is duplicated implicitly.** The dataset is the source of truth for the chart of accounts in three businesses; the product code does not currently read it as the COA source. If the product seeds a real COA, the two will drift.
- **No transaction-level idempotency.** A re-import of the same CSV will create duplicate transactions. Either a transaction hash key or an explicit `external_id` is needed.
- **CSV parsing has zero hardening.** The intake endpoint will need size limits, encoding detection, and header normalization.
- **The categorizer cost numbers in `claude_haiku.py` are point-in-time constants.** No mechanism to update them; no warning if usage moves outside the assumed model.
- **Frontend dashboards read JSON at build time.** Any new run requires a redeploy. Documented but not solved.
- **Single-tenant assumption.** Acceptable for v0, but the data model should not embed it permanently.

---

## 6. Definition of done for this build sprint

The sprint deliverable is **a backend that drives the bookkeeping workflow end-to-end via HTTP**, with honest documentation. Specifically:

1. The Python app starts and serves `/health` without any provider env vars set.
2. A `/ready` endpoint reports database connectivity separately.
3. A SQLite-backed data model exists with: `AccountCategory`, `Transaction`, `CategorizationResult`, `ReviewDecision`, `AuditEvent`.
4. HTTP endpoints exist for:
   - Transaction creation, listing, retrieval (single + batch + CSV import)
   - Single-transaction and batch categorization, persisting results with confidence routing
   - Review queue listing, approval, correction, and uncategorizable marking
   - Ledger listing and CSV export
   - Audit event listing
5. Tests cover each endpoint's happy path and at least one failure mode.
6. The README accurately states what is shipped versus what is in progress versus what is planned.
7. Frontend workflow pages and the corrections loop are explicitly tagged as "next sprint" — this gap-analysis doc names them, but the gap is not closed in this sprint.

What is **explicitly not in scope** this sprint:

- Frontend workflow pages (Phases 8–9 in the staff-engineer brief)
- Eval harness improvements (Phase 10)
- Hybrid rules + model categorizer (Phase 11)
- Correction-memory retrieval (Phase 12)
- Full security baseline and observability layer (Phases 13–14)
- Demo-data polish (Phase 15)
- CI quality gates beyond what already exists (Phase 17)
- Deployment hardening passes (Phase 18)
- Final self-review document (Phase 20)

Each of those gets its own session.

---

## 7. Sequencing for follow-up sessions

A reasonable order after this PR:

1. **Frontend workflow pages.** Once the backend has real endpoints, the frontend's `/transactions`, `/transactions/import`, `/transactions/[id]`, `/review`, `/ledger`, `/app` (dashboard) pages can be built. Adds a typed API client and shared error rendering. (Phases 8–9.)
2. **Correction memory.** Deterministic merchant-keyed lookup, with an endpoint that lists learned corrections. (Phase 12.)
3. **Hybrid categorizer.** Rule layer first, model fallback. New `HybridCategorizer` behind the same Protocol. (Phase 11.)
4. **Eval harness fixes + new metrics.** Sliced per-category metrics, ECE, routing metrics, baseline rule comparison. (Phase 10.)
5. **Security and observability.** Log redaction utility, input limits, structured logs with request IDs, operational summary endpoint. (Phases 13–14.)
6. **Demo data + seed flow.** Reset endpoint, demo-mode banner on the frontend, scripted walkthrough. (Phase 15.)
7. **CI and deployment hardening.** No-placeholder check, schema validation for eval artifacts, env-var docs by mode. (Phases 17–18.)
8. **Final self-review.** `docs/FINAL_ENGINEERING_REVIEW.md`, README pointer. (Phase 20.)
