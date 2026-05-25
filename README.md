# LedgerLens

**A bookkeeping cleanup and accountant handoff assistant for small-business transaction review.** Turns messy monthly bank transactions into a reviewed categorization package + accountant handoff. **Not accounting software.** Not a substitute for a CPA.

[![Live demo](https://img.shields.io/badge/demo-ledgerlens.up.railway.app-2e5f32)](https://ledgerlens.up.railway.app)
[![Guided demo](https://img.shields.io/badge/3--minute-guided%20demo-244c27)](https://ledgerlens.up.railway.app/demo)
[![Trust metric](https://img.shields.io/badge/trust-100%25%20procedurally%20verified-2e5f32)](docs/TRUST_METRIC.md)
[![GitHub](https://img.shields.io/badge/GitHub-mpalmer79-181717?logo=github&logoColor=white)](https://github.com/mpalmer79)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Michael%20Palmer-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/michael-palmer)

## What LedgerLens is

- **Who it's for** — small-business owners doing monthly bookkeeping cleanup; the engineering audience evaluating an AI-systems portfolio.
- **The headline outcome** — a **handoff package** (markdown summary + CSV transaction export) that an owner can send to their bookkeeper or accountant for substantive review at month-end.
- **The approach** — a layered pipeline (`correction memory (exact + fingerprint) → 50 deterministic rules → fallback → confidence routing → human review → audit`) that only calls the model when the earlier layers can't decide safely.
- **The headline number** — **100% of finalized guided-demo rows are procedurally verified before handoff.** A finalized row counts as verified only when it came through a deterministic rule auto-approval, a correction-memory replay, or an explicit human review. **Workflow trust boundary, not a guarantee of accounting or tax correctness.** See [`docs/TRUST_METRIC.md`](docs/TRUST_METRIC.md).
- **The deployed instance** — runs in **zero-cost demo mode**. The `anthropic` SDK is never imported. A regression test asserts that.

## What LedgerLens is NOT

- **Not production accounting software.** No double-entry, no accrual, no bank reconciliation, no tax handling, no multi-currency. Split-transaction foundation exists for reviewed accountant handoff, but this is not double-entry accounting and does not post to accounting systems. See [`docs/ACCOUNTING_DOMAIN_BOUNDARY.md`](docs/ACCOUNTING_DOMAIN_BOUNDARY.md).
- **Not production multi-tenant SaaS.** LedgerLens now has demo session context, actor-aware audit events, and business-scoped workflow tables, but it is still not production authentication or production tenant isolation. See [`docs/AUTH_TENANT_PHASE_2_REVIEW.md`](docs/AUTH_TENANT_PHASE_2_REVIEW.md) and [`docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_REVIEW.md`](docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_REVIEW.md).
- **Not a substitute for a CPA.** "Verified" here is procedural (a defensible authority signed off on the row), not substantive (a CPA confirmed the books).
- **Not safe for real bank data uploads.** The public demo is intended for synthetic / sample CSVs only. The `/transactions/import` page warns explicitly.

## Public demo warning

> **The public demo runs on synthetic sample data with demo-only session context, not production authentication.**
>
> LedgerLens now business-scopes core workflow rows and redacts obvious sensitive values from audit/log payloads, but this is still a portfolio demo — not production tenant isolation, not a compliance product, and not a safe place for real bank statements, customer information, employee information, account numbers, payroll data, or sensitive financial data. Use the bundled sample CSV or invented data only.

## Sample data disclaimer

The bundled demo scenario — **Granite State Auto Repair, March 2026** — is a **fictional independent auto repair shop**. It is not a real business, not a real customer, and not anyone's actual books. Every page that names it carries a "Sample / fictional scenario" badge. See [`docs/SAMPLE_BUSINESS_SCENARIO.md`](docs/SAMPLE_BUSINESS_SCENARIO.md).

## Accounting-domain boundary

LedgerLens produces a **reviewed categorization** + an **accountant handoff package**, **not** a double-entry accounting ledger. A real accounting ledger contains structured debit/credit entries that obey the accounting equation. LedgerLens emits a categorized transaction sheet with verification metadata; an accountant takes that output and books the offsetting entries in their accounting system (QuickBooks, Xero, Sage). LedgerLens is a step **before** the ledger, not a replacement for it.

Full boundary: [`docs/ACCOUNTING_DOMAIN_BOUNDARY.md`](docs/ACCOUNTING_DOMAIN_BOUNDARY.md).

## Security and production-readiness status

LedgerLens is a **portfolio-grade workflow demo**, not production SaaS. The current repo is more mature than the original prototype, but the remaining gaps are still documented honestly.

- **Demo-safe session + actor context shipped.** `GET /session` returns the seeded `Demo Owner` and `Granite State Auto Repair` business. AppShell shows the demo session badge. This is intentionally stateless demo context — no passwords, JWTs, OAuth, real signup, or production login. See [`docs/DEMO_SESSION_AND_BUSINESS_CONTEXT.md`](docs/DEMO_SESSION_AND_BUSINESS_CONTEXT.md).
- **Actor-aware audit shipped.** Import-profile changes, mapping updates, previews, selected-row applies, and review actions write audit events with business, actor, display name, request id, action, and safe before/after metadata. See [`docs/AUDIT_EVENT_MODEL.md`](docs/AUDIT_EVENT_MODEL.md).
- **Tenant-boundary foundation shipped.** `transactions`, `categorization_results`, `review_decisions`, and `correction_memory` now carry `business_id`; service and API reads/writes are scoped to the active business; cross-business leakage is covered by regression tests. This is a serious tenant-boundary foundation, but not a claim of production multi-tenancy. See [`docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_REVIEW.md`](docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_REVIEW.md).
- **Sensitive-data guardrails shipped.** A shared redaction utility strips obvious emails, phone numbers, card-like groups, long digit runs, SSN/EIN-like patterns, database URLs, tokens, and forbidden audit keys. This is a guardrail for logs/audit payloads, not a complete PII/compliance pipeline. See [`docs/SECURITY_AND_PRODUCTION_READINESS.md`](docs/SECURITY_AND_PRODUCTION_READINESS.md).
- **Public-demo deployment reliability hardened.** `CORS_ORIGINS` accepts single-origin, comma-separated, or legacy JSON-array forms. `/demo/status` fails safely with structured JSON. `/demo/ready` checks demo-critical dependencies. The backend start script can run Alembic on boot with `RUN_MIGRATIONS_ON_START=true` and refuses silent stamping. See [`docs/PUBLIC_DEMO_INCIDENT_HOTFIX_REVIEW.md`](docs/PUBLIC_DEMO_INCIDENT_HOTFIX_REVIEW.md).
- **Data retention and backups are not production-ready.** A tenant-scoped deletion primitive and backup/restore runbook exist, but there is no customer-facing deletion workflow, no verified production backup/restore drill, no retention scheduler, and no disaster-recovery guarantee. See [`docs/BACKUP_RESTORE_AND_RETENTION_RUNBOOK.md`](docs/BACKUP_RESTORE_AND_RETENTION_RUNBOOK.md).
- **Accounting-system integrations are not implemented.** LedgerLens exports reviewed/follow-up CSV and Markdown handoff files. It does not round-trip to QuickBooks/Xero and does not connect to Plaid/Finicity. See [`docs/ACCOUNTING_SYSTEM_EXPORT_READINESS.md`](docs/ACCOUNTING_SYSTEM_EXPORT_READINESS.md).
- **Homepage visual refresh shipped.** All five local-photography slots are live (hero, trust, auto shop, engineering, FAQ) via a manifest-driven system. No remote hotlinks, no fake credits, no icon substitutes. See [`docs/HOMEPAGE_VISUAL_REFRESH_PREP_REVIEW.md`](docs/HOMEPAGE_VISUAL_REFRESH_PREP_REVIEW.md).
- **Vendor normalization shipped.** A deterministic, zero-cost module normalizes noisy bank-statement descriptions to stable vendor identifiers (45+ vendor families). Ambiguous vendors (Amazon, Costco, Home Depot) are detected but NOT auto-categorized. See [`docs/VENDOR_NORMALIZATION_AND_MEMORY_MATCHING.md`](docs/VENDOR_NORMALIZATION_AND_MEMORY_MATCHING.md).
- **Correction memory supports fingerprint matching.** Tier-2 matching reuses prior human corrections across noisy description variants from the same vendor and business. Ambiguous vendors are blocked from fingerprint matching. See [`docs/CORRECTION_MEMORY_GENERALIZATION_AUDIT.md`](docs/CORRECTION_MEMORY_GENERALIZATION_AUDIT.md).

Full posture + roadmap: [`docs/SECURITY_AND_PRODUCTION_READINESS.md`](docs/SECURITY_AND_PRODUCTION_READINESS.md).

## What problem does it solve?

Small-business owners fall behind on categorizing transactions. Accountants need *business context* the bank export doesn't carry (what was that ACH transfer for? was the Costco run office supplies or inventory?). Pure AI guessing on financial data is not safe — every wrong category propagates into financial statements and tax filings.

LedgerLens does three things instead:

1. **Handles the obvious vendors automatically** with deterministic rules + correction memory.
2. **Asks plain-English questions** about the uncertain ones (no accounting jargon as the first step).
3. **Produces a handoff package** the owner can send to their accountant for substantive review.

## What is the handoff package?

A downloadable package at [`/handoff`](https://ledgerlens.up.railway.app/handoff) with **7 separated exports**:

| # | Export | Path |
|---|---|---|
| 1 | Full ledger CSV | `/ledger/export.csv` |
| 2 | Reviewed rows CSV | `/handoff/export.reviewed.csv` |
| 3 | Accountant follow-up CSV | `/handoff/export.followup.csv` |
| 4 | Owner questions CSV | `/handoff/export.owner-questions.csv` |
| 5 | Split transaction lines CSV | `/handoff/export.splits.csv` |
| 6 | Handoff summary Markdown | `/handoff/export.md` |
| 7 | Package manifest JSON | `/handoff/export.package.json` |

- **Procedurally verified rows** — finalized rows backed by a rule, memory, or human review.
- **Unresolved review items** — anything that still needs accountant or owner follow-up, explicitly flagged.
- **Owner answers** — plain-English notes the owner wrote during the questions workflow.
- **Split lines** — when a single transaction needs multiple categories (e.g. Amazon order = shop supplies + personal).
- **Corrections learned** — new (merchant → category) rules saved this month for reuse next month.

The export is **not tax advice**, not a QuickBooks/Xero import file, and not a true accounting ledger. It's a cleanup and handoff aid that gives the accountant clean inputs. All downloads use a reliable fetch→blob mechanism with content-type validation — no silent dud files on mobile.

## Try it / read about it

- **Start the workflow** — [`/cleanup`](https://ledgerlens.up.railway.app/cleanup). Six-step monthly checklist driven by real backend status.
- **See the deliverable** — [`/handoff`](https://ledgerlens.up.railway.app/handoff). The verified accountant handoff package.
- **3-minute guided demo** — [`/demo`](https://ledgerlens.up.railway.app/demo). Real backend calls, no mocked state.
- **Engineering story** — [`/technical-story`](https://ledgerlens.up.railway.app/technical-story). Architecture, "not an LLM wrapper" comparison, trust model, stack.
- **About the builder** — [`/about`](https://ledgerlens.up.railway.app/about). Michael Palmer, GitHub + LinkedIn.
- **Eval evidence** — [`/evals`](https://ledgerlens.up.railway.app/evals). Honest raw model-only numbers (model accuracy ≈ 63%, adversarial ≈ 42%).
- **Run locally** — see the [`Running locally`](#running-locally) section below.

## Sample scenario: Granite State Auto Repair

LedgerLens ships one fictional sample business so the guided demo, the cleanup checklist, and the accountant handoff all tell the same story end-to-end.

**Granite State Auto Repair** — an independent auto repair shop in New Hampshire cleaning up its **March 2026** bank activity before sending records to its accountant. The dataset is **42 transactions** spanning a realistic monthly mix: parts (NAPA, AutoZone, O'Reilly, Advance Auto, LKQ, tire distributor), payroll (ADP bi-weekly + tax), utilities and rent (Eversource, Comcast, Waste Management, NH Property Management, Manchester Water), software (QuickBooks, Mitchell1, Google Workspace), fuel (Shell, Irving, Mobil), insurance and finance (Hanover, TD Bank, First Citizens), revenue deposits (Stripe, Square, customer checks, cash), and the ambiguous rows a real monthly cleanup turns up — ACH transfers, paper checks, Amazon, Costco, Home Depot, Lowe's, Venmo, ATM withdrawals, and an OWNER TRANSFER row that's clearly a personal-vs-business judgement call.

The scenario is **fictional sample data**. It is not a real business. Every surface that names it carries a "Sample / fictional scenario" badge. See [`docs/SAMPLE_BUSINESS_SCENARIO.md`](docs/SAMPLE_BUSINESS_SCENARIO.md) for the full scenario reference and [`docs/examples/granite-state-auto-repair-handoff.md`](docs/examples/granite-state-auto-repair-handoff.md) for a representative handoff package output.

## Why not claim 100% AI accuracy?

Because ambiguous bookkeeping data requires business context, and adversarial cases exist precisely because a junior bookkeeper would forward them. Pretending the model gets every case right is dishonest. LedgerLens instead verifies *what becomes final*: finalized rows must be backed by human review, correction memory, or deterministic rules. Raw model accuracy on the synthetic eval dataset is around **63% overall** and **42% on the adversarial slice** — and that's reported honestly on [`/evals`](https://ledgerlens.up.railway.app/evals) and the committed run artifacts in `evals/runs/`.

## Current product status

LedgerLens is a **working portfolio prototype** that demonstrates an end-to-end bookkeeping cleanup workflow on synthetic data. It is not production-ready and not connected to real bank or accounting systems.

| Capability | Status |
|---|---|
| Eval harness + committed run artifacts | **Shipped** — JSON/Markdown artifacts under `evals/runs/` |
| Claude Haiku 4.5 categorizer with structured output | **Shipped for local/private testing** — public deploy runs `demo_stub` |
| Zero-cost public demo mode | **Shipped** — regression-tested so the `anthropic` SDK is not imported in demo mode |
| 50 deterministic rules + correction memory (exact + fingerprint) | **Shipped** — zero-cost layers with vendor normalization run before fallback/model routing |
| Saved CSV import profiles | **Shipped** — stores header/mapping metadata only, never row data |
| Editable category mapping | **Shipped** — `/mapping` supports business-specific intent → COA mapping and `block_fallback` |
| Mapping recategorization preview + selected-row apply | **Shipped** — read-only preview plus selected eligible-row apply with server-side eligibility checks and audit |
| Demo session + actor-aware audit | **Shipped** — `Demo Owner`, business context, audit events, `/audit` page |
| Business-scoped core workflow rows | **Shipped** — `business_id` on transactions/results/review/correction-memory with tenant-boundary tests |
| Homepage local photography system | **Shipped** — all 5/5 image slots live, manifest-driven, local files, verification script |
| Vendor normalization + fingerprint memory | **Shipped** — 45+ vendor families, fingerprint-based correction reuse, ambiguous-vendor protection |
| Eval safety + coverage + confusion reporting | **Shipped** — safety metrics, enriched confusion pairs, coverage by provider, unmatched vendor analysis, report generator |
| Split transaction foundation | **Shipped** — model, service, API, validation, business-scoped; not double-entry accounting |
| Accountant export package (7 exports) | **Shipped** — reviewed CSV, follow-up CSV, owner-questions CSV, splits CSV, full ledger CSV, markdown, package JSON |
| QuickBooks/Xero/Plaid integrations | **Not implemented** — export readiness is documented, live integrations are future work |
| Split transaction frontend UI | **Not implemented** — backend API ready, UI deferred |
| Production auth, billing, backup SLAs, retention automation | **Not implemented** — documented roadmap items, not claims |

Five-minute reviewer path through the working app: [`docs/DEMO_WALKTHROUGH.md`](docs/DEMO_WALKTHROUGH.md).

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

## Categorization order

A transaction passes through three deterministic layers before any model can fire. Which categorizer sits in the fallback slot is controlled by `CATEGORIZER_MODE`.

**Demo mode (default, `CATEGORIZER_MODE=demo_stub`)** — the portfolio deploy. Zero paid-API spend.

1. **Correction memory** — exact-key lookup over rules built from prior human corrections, plus tier-2 fingerprint matching across noisy bank-description variants (blocked for ambiguous vendors). Zero cost. (See [`docs/CORRECTION_MEMORY_PLAN.md`](docs/CORRECTION_MEMORY_PLAN.md) and [`docs/CORRECTION_MEMORY_GENERALIZATION_AUDIT.md`](docs/CORRECTION_MEMORY_GENERALIZATION_AUDIT.md).)
2. **Deterministic rule layer** — a curated table of merchant / keyword rules in [`backend/src/ledgerlens/data/category_rules.json`](backend/src/ledgerlens/data/category_rules.json), validated against the active chart of accounts at server startup. Zero cost. (See [`docs/HYBRID_CATEGORIZER_PLAN.md`](docs/HYBRID_CATEGORIZER_PLAN.md).)
3. **Demo stub** — implemented in `backend/src/ledgerlens/categorizers/demo_stub.py`. Returns `UNCATEGORIZABLE` with provider `demo_stub`, zero cost, and an explanation noting that the transaction was routed to review instead of calling a paid model. The `anthropic` SDK is **not** imported in this mode.
4. **Human review queue.**

**Anthropic mode (`CATEGORIZER_MODE=anthropic`)** — local / private testing.

1. Correction memory (unchanged).
2. Deterministic rule layer (unchanged).
3. **Claude Haiku 4.5** — real model categorizer with tool-use structured output. Per-call cost.
4. Confidence routing → human review.

Then the existing routing applies: confidence ≥ auto-threshold → auto-approved; mid confidence → review queue; sentinel → uncategorizable. Every state change writes an `AuditEvent` identifying which layer produced the result.

Rules never override correction memory. Rules with confidence below the auto-threshold never auto-apply (they route to review). When two rules match the same input but disagree on the category, the transaction routes to review instead of either auto-applying. The demo stub never auto-approves anything.

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
| Deterministic rules only | 0.0% (see note) | 0.0% | 0.0% | $0.00 |

The eval harness now also emits **routing metrics** (auto-approved rate + auto-approved accuracy + review rate + zero-cost share), **calibration** (ECE / MCE, separated for model-only vs deterministic predictions), and **top confusion pairs**. The frontend `/evals` page surfaces the layered pipeline order, a side-by-side mode comparison, and a calibration warning when high-confidence accuracy materially undershoots its claim. The `evals.compare` CLI rolls existing run artifacts into a reviewer-readable Markdown report (`evals/runs/YYYY-MM-DD-comparison.md`).

The rules-only 0.0% line is a **methodology finding, not a defect**. The bundled rule set targets the default seed COA; the three synthetic eval businesses each use a different COA numbering, so rule predictions that are correct merchant→category mappings score 0% against this dataset's ground truth. The value of the rule layer in production is *cost reduction* (zero model spend on matched rows), not accuracy on this benchmark. Per-tenant rule sets translated against each synthetic business's COA are next-PR work.

What reviewers should look at first:
- **Auto-approved accuracy** — the accuracy of predictions the system would post without a human looking. This is the trust ceiling for the deployed product.
- **Review rate** — the fraction of predictions routed to a human. Lower is cheaper, but only if auto-approved accuracy stays high.
- **Cost per 100** — how much model spend each mode incurs to cover the same workload.
- **Calibration warning** — emitted when the 0.9–1.0 bucket's actual accuracy is materially below 90%. Raw confidence is not a probability without this check.

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
| `GET` | `/corrections` | List learned correction-memory rules |
| `GET` | `/rules` | List active deterministic rules |
| `GET` | `/transactions/{id}/memory-matches` | Show what correction-memory would apply |
| `GET` | `/transactions/{id}/rule-matches` | Show what the rule layer would apply |
| `GET` | `/transactions/{id}/splits` | List split lines + validation status |
| `PUT` | `/transactions/{id}/splits` | Replace split lines (atomic, audited) |
| `DELETE` | `/transactions/{id}/splits` | Remove all split lines |
| `GET` | `/handoff/export.owner-questions.csv` | Owner-question context CSV |
| `GET` | `/handoff/export.splits.csv` | Split transaction lines CSV |
| `GET` | `/handoff/export.package.json` | Export manifest with counts |

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
   ├─ SQLAlchemy 2.0 + SQLite/Postgres (Alembic migrations, business-scoped rows)
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

The categorize endpoints run in **portfolio demo mode** by default (`CATEGORIZER_MODE=demo_stub`). In demo mode the pipeline is `correction memory → deterministic rules → demo stub → human review` and the app never imports or calls Anthropic. To use the real model fallback locally, set `CATEGORIZER_MODE=anthropic` and `ANTHROPIC_API_KEY=...`. See [`docs/PORTFOLIO_DEPLOYMENT.md`](docs/PORTFOLIO_DEPLOYMENT.md) for the recommended Railway configuration.

Evals run via the [`Run eval`](.github/workflows/eval.yml) GitHub Actions workflow — manually triggered for cost control.

CI runs backend tests + ruff + mypy + format check **and** frontend tests + lint + production build on every PR and push to `main`. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml). The public-demo reliability layer (API client timeout / retry, shared loading / empty / error components, smoke checklist) is documented in [`docs/PUBLIC_DEMO_RELIABILITY.md`](docs/PUBLIC_DEMO_RELIABILITY.md) and [`docs/DEPLOYMENT_SMOKE_TEST.md`](docs/DEPLOYMENT_SMOKE_TEST.md).

## What's not in this project (yet)

Calling out gaps because honesty beats overclaiming:

- **No real bank integration.** Synthetic dataset for evaluation, manual CSV import for the product. QuickBooks / Xero is intentionally out of scope for v0.
- **Correction memory uses exact + fingerprint matching, not semantic.** Tier-1 matches on raw merchant/description keys. Tier-2 normalizes both sides via vendor fingerprinting to reuse corrections across noisy bank-description variants. Ambiguous vendors (Amazon, Costco, Home Depot, Walmart, Lowe's, Target) are blocked from fingerprint matching. Embedding-based / fuzzy retrieval remains a deliberate v2.
- **50 rules are manually curated and intent-mapped.** Rules target the default seed COA via intents; per-business maps resolve intents to business-specific COA codes. A multi-tenant deployment will need per-tenant rule packs — that work is documented but not built.
- **Eval-metric upgrades pending.** Sliced per-category metrics, expected calibration error, and a baseline-rule comparison are partially addressed (rules-only run committed under `evals/runs/`, with a methodology caveat: the bundled rules target the default COA, so cross-business code mismatch against the synthetic dataset is expected). Full per-COA rule sets for the eval businesses are next-sprint work.
- **Auth is foundation-only.** User, Tenant, Business, Membership models exist; demo session context works; but there is no login, no JWT, no protected routes, no production auth.
- **Security is guardrail-level.** CSV size/row limits, structured logs with request IDs, PII redaction in audit/log payloads, and narrow-CORS in prod are shipped. This is not SOC2/PCI/HIPAA.

These aren't bugs — they're explicit non-goals documented in [`docs/IMPLEMENTATION_GAP_ANALYSIS.md`](docs/IMPLEMENTATION_GAP_ANALYSIS.md). Each has a position in the priority list.

## Production roadmap

See [`docs/SECURITY_AND_PRODUCTION_READINESS.md`](docs/SECURITY_AND_PRODUCTION_READINESS.md), [`docs/IMPLEMENTATION_GAP_ANALYSIS.md`](docs/IMPLEMENTATION_GAP_ANALYSIS.md), and [`docs/MARKET_POSITIONING_AND_COMPETITIVE_WEDGE.md`](docs/MARKET_POSITIONING_AND_COMPETITIVE_WEDGE.md) for the full roadmap. The practical next work is:

- **Authentication hardening** — real login/session model, protected routes, roles/permissions, and production-grade auth boundaries.
- **Tenant isolation hardening** — continue converting demo assumptions into explicit business/account ownership, permission checks, and operational tests.
- **Sensitive-data pipeline** — expand redaction/detection, add upload-time warnings/blocks, and define model-call safety before real LLM use.
- **Backup/restore + retention** — verified Railway/Postgres backup plan, restore drill, retention scheduler, deletion workflow, and operator runbook.
- **Accounting export readiness** — QBO/Xero-compatible export research, split-transaction support, and accountant import checklist. Vendor normalization is shipped; chart-of-accounts mapping is shipped.
- **Workflow accuracy/efficiency** — per-business rule packs, calibration threshold refinement, and reduced review burden without lowering trust. Vendor normalization, 50 deterministic rules, correction-memory fingerprint matching, and eval safety/coverage/confusion reporting are shipped.

And the small-business UX roadmap ([`docs/SMALL_BUSINESS_UX_ROADMAP.md`](docs/SMALL_BUSINESS_UX_ROADMAP.md)) continues through saved import profiles, mapping previews/apply, mobile review, static handoff fallback, and owner-first onboarding.

## Test / CI status

Recent local/CI proof points from the current repo lineage:

- **Backend** — **414 pytest tests** passing, plus `ruff check`, `ruff format --check`, and `mypy --strict`.
- **Frontend** — **312 Vitest tests** passing, plus `npm run lint`, `npm run build`, and `npm run images:verify`.
- **Evals** — `python -m ledgerlens.evals.run --categorizer <mode>` for rules-only / rules-only-mapped / claude-haiku-v1 / hybrid-rules-model / stub. Committed artifacts under [`evals/runs/`](evals/runs/) (see [`docs/MAPPED_RULE_EVALS.md`](docs/MAPPED_RULE_EVALS.md) + [`docs/MULTI_BUSINESS_MAPPED_RULE_EVALS.md`](docs/MULTI_BUSINESS_MAPPED_RULE_EVALS.md)).
- **Dependabot** — weekly updates for npm (frontend) + pip (backend), monthly for GitHub Actions. Configured in [`.github/dependabot.yml`](.github/dependabot.yml).

## About

Built by [Michael Palmer](https://linkedin.com/in/michael-palmer) (PalmerAI Solutions) as a portfolio project demonstrating AI engineering practice: shipped systems, calibrated metrics, documented decisions, and honest failure modes. See also [VeriFlow](https://github.com/mpalmer79/VeriFlow) (compliance) and [AegisRange](https://github.com/mpalmer79/AegisRange) (SOC simulation).
