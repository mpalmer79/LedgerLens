# LedgerLens

**AI-assisted transaction categorization for bookkeepers. Calibrated confidence, human-in-the-loop review, eval-gated prompt changes.**

[![Live demo](https://img.shields.io/badge/demo-ledgerlens.up.railway.app-2e5f32)](https://ledgerlens.up.railway.app)
[![Eval results](https://img.shields.io/badge/eval-claude--haiku--4.5-2e5f32)](evals/runs/)
[![ADRs](https://img.shields.io/badge/ADRs-15-244c27)](docs/adr/)

---

## Current product status

LedgerLens is a **working prototype** that demonstrates an end-to-end AI bookkeeping workflow on synthetic data. It is not production-ready and not connected to real bank or accounting systems.

| Capability | Status |
|---|---|
| Eval harness (load dataset, run categorizer, persist metrics) | **Shipped** — committed JSON run artifacts under `evals/runs/` |
| Claude Haiku 4.5 categorizer with tool_use structured output | **Shipped** — `backend/src/ledgerlens/categorizers/claude_haiku.py` |
| Eval dashboard at `/evals` | **Shipped** — reads latest run JSON at build time |
| Backend API: transactions, categorize, review queue, ledger export, audit | **Shipped (this PR)** — see "API surface" below |
| Persistent storage (SQLite for demo, Postgres-ready) | **Shipped (this PR)** — SQLAlchemy 2.0 models, idempotent table creation, seeded chart of accounts |
| Frontend workflow pages (`/transactions`, `/review`, `/ledger`) | **Next sprint** — backend endpoints exist, UI to drive them is the next PR |
| Corrections-driven retrieval ("learns from corrections") | **Planned** — deterministic merchant lookup is the v1 design; pgvector is later |
| Hybrid rules + model categorizer | **Planned** |
| Production multi-tenancy, real bank integration | **Not in scope for v0** |

Full gap analysis with priorities: [`docs/IMPLEMENTATION_GAP_ANALYSIS.md`](docs/IMPLEMENTATION_GAP_ANALYSIS.md).

## The problem

Bookkeepers categorize 100–500 bank transactions per client per month. Most are mechanical ("Starbucks → Meals"), but ~10% are genuinely ambiguous: a Mitchell1 subscription that could be Software or Prepaid Software, a State Farm payment that might be Insurance Expense or a prepaid asset, a Claude API charge that could be Software or Contract Labor depending on context.

Mis-categorizations propagate into financial statements, tax filings, and audit risk. The standard playbook — rule engines + manual review — scales linearly with transaction volume and degrades with each new client's chart of accounts.

## The approach

LedgerLens treats categorization as a calibrated prediction problem, not a classification problem. Each transaction gets:

- A predicted account from the client's chart of accounts
- A confidence score between 0 and 1
- A routing decision (auto-post if confidence ≥ threshold, queue for review otherwise)
- A rationale field a human reviewer can read in seconds

The model can also return `UNCATEGORIZABLE` for transactions outside its training distribution, rather than guess and contaminate downstream books.

## Evidence — the eval suite

The project is built around a synthetic evaluation dataset:

- **3 verticals**: coffee shop, design agency, auto repair (140 accounts total)
- **302 transactions** with ground-truth account assignments
- **~10% adversarial**: deliberately ambiguous cases that hinge on policy choices a junior reviewer would forward
- **Stratified confidence labels** (high / medium / low) so calibration can be measured per-bucket

Latest run, committed at `evals/runs/2026-05-22-claude-haiku-v1.json`:

| Categorizer | Overall accuracy | Non-adversarial | Adversarial | Cost / 100 tx |
|---|---|---|---|---|
| Stub (first-expense baseline) | 9.3% | 10.3% | 0.0% | $0.00 |
| Claude Haiku 4.5 | **62.9%** | **65.3%** | **41.9%** | **$0.34** |

Reliability diagrams, slice breakdowns, and full per-transaction outputs live in [`evals/runs/`](evals/runs/). Each run is a committed JSON artifact — no metrics live in a dashboard with no underlying record.

Calibration on adversarial cases is the work to come: the model's confidence on the 41.9% adversarial slice is not yet well-calibrated, and improving that is the explicit motivation for the hybrid categorizer (ADR planned) and the correction loop.

## API surface (backend, current)

All endpoints are mounted on the FastAPI app at `backend/src/ledgerlens/main.py`. Local default uses SQLite (`sqlite:///:memory:`); set `DATABASE_URL` for persistence.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness — no dependencies checked |
| `GET` | `/ready` | Readiness — DB + provider-config status |
| `GET` | `/categories` | List active chart of accounts |
| `POST` | `/transactions` | Create one transaction |
| `POST` | `/transactions/batch` | Create up to 500 in one request |
| `POST` | `/transactions/import` | CSV upload (≤ 5 MB, ≤ 5,000 rows) |
| `GET` | `/transactions` | Paginated list |
| `GET` | `/transactions/{id}` | Single transaction |
| `POST` | `/categorize` | Categorize one stored transaction; persists result |
| `POST` | `/categorize/batch` | Up to 100 transaction IDs |
| `GET` | `/categorization-results/{id}` | Single result |
| `GET` | `/transactions/{id}/categorization-results` | All results for a transaction |
| `GET` | `/review-queue` | Transactions whose latest result is `needs_review` |
| `POST` | `/review-queue/{tx_id}/approve` | Approve latest prediction |
| `POST` | `/review-queue/{tx_id}/correct` | Override category; validates against COA |
| `POST` | `/review-queue/{tx_id}/uncategorizable` | Mark as un-categorizable |
| `GET` | `/ledger` | Finalized ledger view (corrected > approved > pending) |
| `GET` | `/ledger/export.csv` | CSV export of the ledger |
| `GET` | `/audit/events` | Audit trail; filter by entity type and id |

Example:

```bash
curl -X POST http://localhost:8000/transactions \
  -H "Content-Type: application/json" \
  -d '{"transaction_date":"2026-03-14","description":"QuickBooks Online","amount_cents":-7000}'

curl -X POST http://localhost:8000/categorize \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"tx_..."}'

curl http://localhost:8000/review-queue
```

Every state-changing call writes an `AuditEvent`. The model never gets a transaction in a code that isn't in the active chart of accounts — predictions outside the COA are auto-routed to review.

## Architecture (current)

```
Browser (Next.js 14, Tailwind, Three.js)
   ↓
FastAPI backend (Python 3.12)
   ├─ routers: transactions, categorize, review, ledger, audit, health, categories
   ├─ SQLAlchemy 2.0 + SQLite (Postgres-ready)
   ├─ confidence-threshold routing (auto / review / uncategorizable)
   └─ audit log on every state change
   ↓
[ Categorizer (Protocol) ]
   ├─ StubCategorizer        — deterministic baseline
   └─ ClaudeHaikuCategorizer — Anthropic tool_use; one retry; UNCATEGORIZABLE fallback
   ↓
Anthropic Claude Haiku 4.5
```

Both services deploy via Dockerfile-based builds on Railway. Eval runs execute in GitHub Actions and commit results back to the repo — see [ADR-0009](docs/adr/0009-evals-run-in-ci.md). Build-time eval-artifact loading on the frontend — see [ADR-0011](docs/adr/0011-build-time-eval-artifact-loading.md).

Full design spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Implementation status per section is labeled there.

## Design decisions, documented

| # | Decision |
|---|---|
| [0000](docs/adr/0000-record-architecture-decisions.md) | Use ADRs |
| [0001](docs/adr/0001-python-version.md) | Python 3.12+ |
| [0002](docs/adr/0002-deployment-topology.md) | All services on Railway *(partially superseded by 0006)* |
| [0003](docs/adr/0003-synthetic-eval-data.md) | Synthetic eval over anonymized real data |
| [0004](docs/adr/0004-eval-harness-architecture.md) | Eval harness architecture (Protocol over inheritance) |
| [0005](docs/adr/0005-single-model-categorizer-v0.md) | Single-model v0, fallback chain deferred |
| [0006](docs/adr/0006-switch-to-dockerfile-deploys.md) | Dockerfile builds (supersedes part of 0002) |
| [0007](docs/adr/0007-build-time-env-var-injection.md) | NEXT_PUBLIC_* injected via Docker ARG |
| [0009](docs/adr/0009-evals-run-in-ci.md) | Evals run in CI, not in production API |
| [0010](docs/adr/0010-design-system-architecture.md) | Design system: forest green, light theme |
| [0011](docs/adr/0011-build-time-eval-artifact-loading.md) | Build-time eval artifact loading |
| [0012](docs/adr/0012-landing-page-as-portfolio-artifact.md) | Landing page as portfolio artifact |
| [0013](docs/adr/0013-3d-hero-animation.md) | 3D hero animation via Three.js |
| [0014](docs/adr/0014-two-faced-cards.md) | Two-faced transaction cards |
| [0015](docs/adr/0015-tinted-card-surfaces.md) | Tinted card surfaces for brand cohesion |

ADR-0008 is intentionally vacant — the number was reserved for a different decision that was rolled into 0007.

## Repo layout

```
.
├── backend/         FastAPI + persistence + categorizers + eval harness (Python 3.12)
├── frontend/        Next.js 14 + Tailwind (TypeScript)
├── evals/           synthetic datasets + committed run artifacts
├── design/          token system + brand assets
├── docs/            ARCHITECTURE.md, IMPLEMENTATION_GAP_ANALYSIS.md, 15 ADRs
└── .github/         CI workflow + manual eval-trigger workflow
```

## Running locally

```bash
# Backend
cd backend
pip install -e .
uvicorn ledgerlens.main:app --reload
# → http://localhost:8000/health and http://localhost:8000/docs

# Frontend
cd ../frontend
npm install
npm run dev
# → http://localhost:3000
```

The backend defaults to an in-memory SQLite database. For a persistent local database:

```bash
DATABASE_URL=sqlite:///./ledgerlens.db uvicorn ledgerlens.main:app --reload
```

The categorize endpoints require `ANTHROPIC_API_KEY`. The rest of the workflow (intake, review, ledger, audit) works without it.

Evals run via the [`Run eval`](.github/workflows/eval.yml) GitHub Actions workflow — manually triggered for cost control.

## What's not in this project (yet)

Calling out gaps because honesty beats overclaiming:

- **No frontend workflow UI.** Backend endpoints exist; the `/transactions`, `/review`, `/ledger` pages are the next session's work. The current frontend is a landing page and an eval dashboard.
- **No real bank integration.** Synthetic dataset for evaluation, manual CSV import for the product. QuickBooks / Xero is intentionally out of scope for v0.
- **No corrections loop yet.** Reviewers can correct categories and the corrections are persisted with audit; using them to inform future predictions is the next functional milestone.
- **No multi-tenancy.** Single-tenant by data model; structurally room to add it without rewriting the persistence layer.
- **Eval harness is synchronous.** Adequate for v0 dataset size; concurrency is a follow-up when run time becomes a real cost.

These aren't bugs — they're explicit non-goals documented in [`docs/IMPLEMENTATION_GAP_ANALYSIS.md`](docs/IMPLEMENTATION_GAP_ANALYSIS.md).

## About

Built by [Michael Palmer](https://linkedin.com/in/michael-palmer) (PalmerAI Solutions) as a portfolio project demonstrating AI engineering practice: shipped systems, calibrated metrics, documented decisions, and honest failure modes. See also [VeriFlow](https://github.com/mpalmer79/VeriFlow) (compliance) and [AegisRange](https://github.com/mpalmer79/AegisRange) (SOC simulation).
