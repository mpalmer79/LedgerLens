# LedgerLens — LinkedIn project story

Use this doc to seed LinkedIn posts, GitHub README excerpts, and interview talking points. Tone is honest career-changer professional, not VC hype.

## 1. Short project description

LedgerLens is an AI-assisted bookkeeping workflow prototype for small businesses. It turns messy bank transactions into a **verified** categorized ledger by combining deterministic rules, human correction memory, review routing, and an audit trail. The public deploy runs at zero paid spend.

## 2. Business problem

Small-business owners — the same kind of business I worked with for 25 years on the automotive operations side — burn hours every month on bookkeeping cleanup. Bank exports are full of cryptic merchant strings: `COMCAST BUSINESS INTERNET MAR`, `ADP PAYROLL BI-WEEKLY`, `ACH TRANSFER VENDOR REF 99812`. Categorizing them correctly matters because wrong categories propagate into financial statements, tax filings, and audit risk. Most "AI bookkeeping" tools either guess and quietly contaminate the books or wrap a chat UI around a model and call it done.

## 3. What I built

A layered AI workflow that explicitly chooses when *not* to use the model:

1. **Correction memory** — a reviewer's correction becomes a deterministic `(merchant, description) → category` rule. Future matches replay at zero cost.
2. **Deterministic rules** — a curated COA-validated table for vendors that are safe to classify (QuickBooks, Zoom, Staples, Stripe fees). Ambiguous merchants like Amazon are routed to review at low confidence.
3. **Demo stub (or real model)** — in portfolio demo mode the fallback is a zero-cost deterministic stub. Set one env var to switch to Claude Haiku 4.5.
4. **Confidence routing + human review** — only high-confidence predictions auto-approve.
5. **Audit trail + ledger export** — every state change writes an event. The output is a CSV the bookkeeper can hand off.

## 4. Why the verified-ledger metric matters

The product's headline is:

> **100% of finalized guided-demo ledger rows are verified before export.**

A row counts as **verified** only when it has a `ReviewDecision`, was decided by `correction_memory`, or was auto-approved by `rule_categorizer` above the threshold. That's three defensible authorities. Demo-stub results don't qualify. Anthropic auto-approvals don't qualify until a human reviews them.

## 5. Why this is not a 100% AI accuracy claim

It deliberately isn't. Raw model accuracy on adversarial bookkeeping data is around 63% overall and 42% on the hard slice — and that's reported honestly on the eval page. A blanket "100% accurate AI" claim would be dishonest. The verified-ledger metric is a *workflow-level guarantee* — the system refuses to finalize anything that lacks a defensible authority, so the rate is 100% by construction.

## 6. Why this is better than an LLM wrapper

- Deterministic rules and correction memory run *before* the model fallback.
- Confidence routing pushes uncertain rows to humans.
- The verified-ledger metric is workflow-level, not model-level.
- Every state change writes an `AuditEvent`. Provider attribution is preserved.
- A demo-stub mode keeps the public deploy at $0 paid spend. A regression test asserts the `anthropic` SDK is never imported in that mode.
- The eval harness reports ECE / MCE / confusion pairs / routing metrics, with model-only vs deterministic calibration separated honestly.

## 7. What technical skills it demonstrates

- **Full-stack engineering** — FastAPI + SQLAlchemy 2.0 + Postgres-ready persistence; Next.js 14 + typed API client; Dockerfile-based Railway deploys.
- **AI systems design** — layered decision logic, model fallback gated by config, deterministic correction memory, rule layer with safety filters, confidence routing.
- **Reliability & auditability** — `AuditEvent` on every state change; `/health` and `/ready` separated; structured error envelopes; mode-aware readiness reporting.
- **Cost & operational thinking** — demo-stub mode; regression test that asserts the Anthropic SDK is never imported; lazy provider construction; deploy doc with the exact Railway env vars.
- **Evaluation literacy** — sliced metrics fix, F1 + confusion pairs + routing + calibration blocks, simulated train/test split for memory eval with leakage guard.

## 8. What product-owner skills it demonstrates

- Picked a real problem (bookkeeping cleanup) over a generic "AI productivity" pitch.
- Designed the headline metric around the workflow, not the model.
- Built a guided 3-minute demo so cold visitors can self-serve the story.
- Added a recruiter-facing About page and a Technical Story page with the architecture pipeline diagrammed.
- Wrote honest limitations: per-tenant COA mismatch, raw model accuracy, demo-mode caveats.

## 9. Suggested launch post

> I just shipped LedgerLens — an AI-assisted bookkeeping workflow prototype that demonstrates AI-systems engineering, not LLM-wrapping.
>
> The headline metric isn't "X% accurate AI." It's: **100% of finalized guided-demo ledger rows are verified before export.** A row only counts as verified if it was decided by human review, by correction memory built from a prior human decision, or by a deterministic rule above threshold. Demo-stub results never qualify. Unreviewed model auto-approvals never qualify.
>
> Raw model accuracy on adversarial bookkeeping data is around 63%. That number is reported honestly on the eval page — it's just not the right number for evaluating a financial-workflow product.
>
> Three-minute guided demo at the link — real backend calls, no mocked state, end-to-end through a verified ledger export.
>
> Stack: FastAPI · SQLAlchemy · Postgres-ready · Next.js · TypeScript · Docker · Railway · Anthropic (opt-in) · pytest · vitest · mypy --strict.
>
> Built as the next step in my pivot from automotive operations into AI software. Code, ADRs, eval artifacts, and the trust-metric doc are all on GitHub.

## 10. Suggested first comment with GitHub link

> Source, ADRs, and the trust-metric doc: https://github.com/mpalmer79/LedgerLens

## 11. Ten hashtags

`#AIEngineering` · `#SoftwareEngineering` · `#FullStack` · `#SmallBusiness` · `#FastAPI` · `#NextJS` · `#Anthropic` · `#HumanInTheLoop` · `#PortfolioProject` · `#CareerChange`

## Suggested GitHub README excerpt

> **LedgerLens** is an AI-assisted bookkeeping workflow prototype for small businesses. It turns messy bank transactions into a verified categorized ledger by combining deterministic rules, human correction memory, review routing, and audit trails.
>
> The headline metric is workflow-level, not model-level: **100% of finalized guided-demo ledger rows are verified before export.** Raw model accuracy (~63% overall) is reported honestly on `/evals` — see [`docs/TRUST_METRIC.md`](docs/TRUST_METRIC.md) for the precise contract.
>
> **Start with the 3-minute guided demo at `/demo`.**
