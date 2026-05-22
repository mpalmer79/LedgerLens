# LedgerLens

**AI-assisted transaction categorization for bookkeepers. Calibrated confidence, human-in-the-loop review, eval-gated prompt changes.**

[![Live demo](https://img.shields.io/badge/demo-ledgerlens.up.railway.app-2e5f32)](https://ledgerlens.up.railway.app)
[![Eval results](https://img.shields.io/badge/eval-claude--haiku--4.5-2e5f32)](evals/runs/)
[![ADRs](https://img.shields.io/badge/ADRs-10-244c27)](docs/adr/)

---

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

The project is built around a synthetic evaluation dataset that doesn't exist anywhere else in the bookkeeping-AI space:

- **3 verticals**: coffee shop, design agency, auto repair (140 accounts total)
- **302 transactions** with ground-truth account assignments
- **~10% adversarial**: prompts deliberately designed to be ambiguous, including the three highest-difficulty cases that hinge on whether a subscription is software-expense vs. prepaid-asset
- **Stratified confidence labels** (high / medium / low) so calibration can be measured per-bucket, not just in aggregate

Two categorizers run against this dataset:

| Categorizer | Overall accuracy | Non-adversarial | Adversarial | Cost / 100 tx |
|---|---|---|---|---|
| Stub (rent-everything baseline) | 9.3% | 10.3% | 0.0% | $0.00 |
| Claude Haiku 4.5 | `<HAIKU_ACCURACY>` | `<HAIKU_NON_ADV>` | `<HAIKU_ADV>` | `<HAIKU_COST>` |

Reliability diagrams, slice breakdowns, and full per-transaction outputs live in [`evals/runs/`](evals/runs/). Each run is a committed JSON artifact — no metrics live in a dashboard with no underlying record.

## Architecture

```
Browser (Next.js 14, Tailwind)
   ↓
FastAPI backend (Python 3.12)
   ↓
[ Categorizer (Protocol) ]
   ├─ Stub               — baseline, always returns "Rent"
   └─ ClaudeHaikuCategorizer — tool_use, retry-once on validation
   ↓
Anthropic Claude Haiku 4.5
```

Both services deploy via Dockerfile-based builds on Railway. Eval runs execute in GitHub Actions and commit results back to the repo — see [ADR-0009](docs/adr/0009-evals-run-in-ci.md).

Full architecture spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Design decisions, documented

This project uses ADRs for every non-trivial decision. The list:

| # | Decision |
|---|---|
| [0000](docs/adr/0000-record-architecture-decisions.md) | Use ADRs |
| [0001](docs/adr/0001-python-version.md) | Python 3.12+ |
| [0002](docs/adr/0002-deployment-topology.md) | All services on Railway |
| [0003](docs/adr/0003-synthetic-eval-data.md) | Synthetic eval over anonymized real data |
| [0004](docs/adr/0004-categorizer-protocol.md) | Categorizer Protocol, sync v0 |
| [0005](docs/adr/0005-single-model-v0.md) | Single-model v0, fallback chain deferred |
| [0006](docs/adr/0006-switch-to-dockerfile-deploys.md) | Dockerfile builds (supersedes part of 0002) |
| [0007](docs/adr/0007-build-time-env-var-injection.md) | NEXT_PUBLIC_* injected via Docker ARG |
| [0008](docs/adr/0008-env-var-list-parsing.md) | CSV-tolerant CORS_ORIGINS validator |
| [0009](docs/adr/0009-evals-run-in-ci.md) | Evals run in CI, not in production API |
| [0010](docs/adr/0010-design-system-architecture.md) | Design system: forest green, light theme |

## Repo layout

```
.
├── backend/         FastAPI + categorizers + eval harness (Python 3.12)
├── frontend/        Next.js 14 + Tailwind (TypeScript)
├── evals/           synthetic datasets + run artifacts
├── design/          token system + brand assets
├── docs/            ARCHITECTURE.md + 11 ADRs
└── .github/         CI workflow + manual eval-trigger workflow
```

## Running locally

```bash
# Backend
cd backend
pip install -e .
uvicorn ledgerlens.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Evals run via the [`Run eval`](.github/workflows/eval.yml) GitHub Actions workflow — manually triggered for cost control.

## What's not in this project (yet)

Calling out gaps because honesty beats overclaiming:

- **No real bookkeeping integration.** The dataset is synthetic. Wiring up QuickBooks or Xero is straightforward but out of scope for v0.
- **No corrections loop.** The system can route to review, but doesn't yet learn from human corrections. ADR-0011 will cover this.
- **No multi-tenant deployment.** Single-business in the data model for v0; multi-tenant is a future migration.
- **Eval harness is synchronous.** Concurrent API calls would cut wall-clock time 5-10×; deferred until eval volume justifies it.

These aren't bugs — they're explicit non-goals documented in the ADRs.

## About

Built by [Michael Palmer](https://linkedin.com/in/michael-palmer) (PalmerAI Solutions) as a portfolio project demonstrating production-quality AI engineering: shipped systems, calibrated metrics, documented decisions, and honest failure modes. See also [VeriFlow](https://github.com/mpalmer79/VeriFlow) (compliance) and [AegisRange](https://github.com/mpalmer79/AegisRange) (SOC simulation).
