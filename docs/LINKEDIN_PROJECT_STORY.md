# LedgerLens — LinkedIn project story

Use this doc to seed LinkedIn posts, GitHub README excerpts, and interview talking points. Tone is honest career-changer professional, not VC hype.

## Project description (one paragraph)

LedgerLens is an AI-assisted bookkeeping workflow prototype for small businesses. It turns messy bank transactions into a reviewed, categorized ledger by combining deterministic rules, human correction memory, review routing, and an audit trail. The deployed instance runs in a zero-cost demo mode so the public site stays free indefinitely without disabling the workflow.

## Problem statement

Small-business owners — including the ones I worked with for years on the automotive operations side — burn hours every month on bookkeeping cleanup. Bank exports are full of cryptic merchant strings: `COMCAST BUSINESS INTERNET MAR`, `ADP PAYROLL BI-WEEKLY`, `ACH TRANSFER VENDOR REF 99812`. Categorizing them correctly matters because wrong categories propagate into financial statements, tax filings, and audit risk. Most "AI bookkeeping" tools either guess and quietly contaminate the books or wrap a chat UI around a model and call it done.

## What I built

A layered AI workflow that explicitly chooses when *not* to use the model:

1. **Correction memory** — when a reviewer corrects a transaction, LedgerLens stores a deterministic `(merchant, description) → category` rule. The next matching transaction is categorized from memory at zero cost.
2. **Deterministic rules** — a curated, COA-validated table for vendors that are safe to classify (QuickBooks, Zoom, Staples, Stripe fees). Ambiguous merchants like Amazon are routed to review at low confidence instead of guessed.
3. **Demo stub (or real model)** — in portfolio demo mode the fallback is a deterministic zero-cost stub that routes to review. Switch the env var and the same slot becomes Claude Haiku 4.5.
4. **Confidence routing + human review** — only high-confidence predictions auto-approve. Everything else lands in a review queue.
5. **Audit trail + ledger export** — every state change writes an event. The final deliverable is a CSV the bookkeeper can hand off.

The deployed Railway site runs in demo mode (`CATEGORIZER_MODE=demo_stub`); the `anthropic` SDK is never even imported. A regression test asserts that.

## Why the architecture matters

- **Cost control is a design choice.** A reviewer who clicks through the entire workflow on the public deploy spends $0 on model APIs. The categorize endpoint still works because the rule layer handles the obvious vendors and the stub handles the rest.
- **Trust is auditable.** Every result records which layer decided (`correction_memory` / `rule_categorizer` / `demo_stub` / `anthropic`) and writes an `AuditEvent`. The UI displays the source. The stub is never claimed as AI.
- **The model is one layer, not the whole product.** Memory and rules run first. Confidence routing decides whether to auto-approve. Humans see the uncertain cases. Review decisions feed correction memory. That loop is the actual product.
- **Eval is honest.** The harness reports auto-approved accuracy, review rate, cost per 100, and calibration (ECE / MCE) — separated by model-only vs deterministic predictions. The rules-only run on the synthetic dataset is 0% accurate by design (tenant-COA mismatch), and the eval report says exactly that.

## Skills demonstrated

- **Full-stack engineering** — FastAPI + SQLAlchemy 2.0 + Postgres-ready persistence; Next.js 14 App Router with a typed API client; Dockerfile-based Railway deploys for both services.
- **AI systems design** — layered decision logic, model fallback gated by config, deterministic correction memory, rule layer with safety filters, confidence routing.
- **Reliability & auditability** — `AuditEvent` on every state change, `/health` and `/ready` separated, structured error envelopes, mode-aware readiness reporting.
- **Cost & operational thinking** — demo-stub mode, regression test that asserts the Anthropic SDK is never imported, lazy provider construction, deploy doc with the exact Railway env vars.
- **Evaluation literacy** — sliced metrics fix, F1 + confusion pairs + routing + calibration blocks, simulated train/test split for correction-memory eval with explicit label-leakage guard.
- **Product ownership** — guided 3-minute demo, story-driven landing page, page-level copy that explains *why* each tab exists, not just *what* it does.

## What I learned

- The biggest accuracy lever wasn't a better prompt — it was *not calling the model* when memory or a rule could decide. Cost dropped to $0 on a meaningful fraction of transactions before the model ever ran.
- Tenant-specific rules are a real limitation. The same code (`6070`) means "Software" in one business's chart of accounts and "Payroll Fees" in another. The eval surfaced that as a 0% rules-only accuracy and forced honest documentation.
- Demo-safe modes are worth designing in from the start. Stripping the Anthropic dependency from the deployed path turned a $/month risk into $0 with no behaviour change to the workflow.
- A workflow with five tabs is invisible to a recruiter until you put a guided demo and a problem statement at the front door.

## Suggested LinkedIn post draft

> I just shipped LedgerLens — an AI-assisted bookkeeping workflow prototype I built to demonstrate AI-systems engineering, not LLM-wrapping.
>
> Small-business bookkeeping cleanup is repetitive and risky. A blind AI guess on a payroll run or a State Farm payment quietly contaminates the books. LedgerLens layers correction memory, deterministic rules, and a configurable fallback (with a zero-cost stub for the public demo) so the model only fires when the earlier layers can't decide safely.
>
> A reviewer can walk a 3-minute guided demo at [link]: import messy transactions, watch the pipeline categorize obvious vendors at zero cost, route ambiguous ones to human review, correct one, and watch the correction become reusable memory for the next matching vendor.
>
> What the architecture demonstrates:
> - Layered AI decision logic with confidence routing
> - Cost control built in (zero paid spend on the public deploy)
> - Audit trail on every state change
> - Honest evaluation harness (auto-approved accuracy, review rate, calibration)
> - Full-stack FastAPI + Next.js + Postgres-ready on Railway
>
> Built as the next step in my pivot from automotive operations into AI software. Code, ADRs, and eval artifacts are on GitHub.
>
> #AIEngineering #SoftwareEngineering #SmallBusiness #FullStack #FastAPI #NextJS #Anthropic #Claude #PortfolioProject #CareerChange

## Suggested GitHub README excerpt

> **LedgerLens** is an AI-assisted bookkeeping workflow prototype for small businesses. It turns messy bank transactions into a reviewed, categorized ledger by combining deterministic rules, human correction memory, review routing, and audit trails.
>
> The deployed instance runs in a zero-cost demo mode — the `anthropic` SDK is never imported. Set `CATEGORIZER_MODE=anthropic` for local testing with the real Claude Haiku 4.5 fallback.
>
> **Start with the 3-minute guided demo at `/demo`.**

## Suggested 10 hashtags

`#AIEngineering` · `#FullStack` · `#SoftwareEngineering` · `#SmallBusiness` · `#FastAPI` · `#NextJS` · `#Anthropic` · `#Claude` · `#PortfolioProject` · `#CareerChange`
