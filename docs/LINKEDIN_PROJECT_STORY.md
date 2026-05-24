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

## 9. Main LinkedIn launch post (long version)

> I started LedgerLens with a simple question: how can AI help a small business owner clean up monthly bookkeeping without blindly trusting the model?
>
> Most "AI bookkeeping" tools either guess the category (and quietly contaminate the books) or wrap a chat UI around a model and call it done. Neither helps the owner produce something an accountant can actually use.
>
> So I built a **monthly cleanup assistant**. The deliverable is a **verified accountant handoff package** — markdown summary + CSV ledger — that the owner sends to their bookkeeper or CPA at month-end.
>
> The workflow:
> 1. Import this month's messy bank activity.
> 2. Obvious vendors (Comcast, QuickBooks, payroll, fuel, Stripe fees) are handled automatically by deterministic rules + correction memory.
> 3. Uncertain transactions become **plain-English questions** ("What was this ACH transfer for?" — not "pick a COA code").
> 4. Owner answers become **review notes for the accountant**.
> 5. The handoff package separates verified rows from unresolved items.
> 6. Export. Done.
>
> The product's headline metric is **workflow-level**, not model-level: **100% of finalized guided-demo ledger rows are verified before export.** A row only counts as verified if it was decided by review, by correction memory, or by a deterministic rule above threshold. Raw model accuracy on adversarial bookkeeping data is ~63% — reported honestly on the eval page; it's just not the right number for a financial-workflow product.
>
> The deployed instance runs at $0 paid spend (demo-stub mode; the Anthropic SDK is never imported — there's a regression test for that).
>
> Stack: FastAPI · SQLAlchemy · Postgres-ready · Next.js · TypeScript · Docker · Railway · Anthropic (opt-in) · pytest · vitest · mypy --strict.
>
> Built as the next step in my pivot from automotive retail / enterprise implementation into AI software. Code, ADRs, eval artifacts, and the verified-ledger trust contract — all on GitHub. Open to AI engineering / applied AI / solutions engineering / full-stack / AI workflow automation roles.

## 9b. Short version (LinkedIn-skim friendly)

> New project — LedgerLens, a monthly bookkeeping cleanup assistant for small businesses.
>
> Owner imports bank CSV → obvious vendors auto-classified by rules + correction memory → uncertain rows become plain-English questions → out comes a **verified accountant handoff package** (markdown + CSV).
>
> The headline metric is workflow-level, not model-level: 100% of finalized demo-ledger rows are verified before export. Raw model accuracy is reported honestly (~63%) on the eval page — but it's not the trust boundary for a financial workflow.
>
> Stack: FastAPI · Next.js · Postgres-ready · Docker · Railway · pytest · vitest · mypy --strict. $0 paid API spend on the public deploy.
>
> Three-minute guided demo + the live cleanup + handoff pages at the link. GitHub in the comments.

## 10. First comment with GitHub link

> Source, ADRs, eval artifacts, and the trust-metric doc: https://github.com/mpalmer79/LedgerLens
>
> About me: https://ledgerlens.up.railway.app/about
> Engineering story: https://ledgerlens.up.railway.app/technical-story

## 11. Line to add after recording the Loom

Drop this in as the second-to-last paragraph of the post once `NEXT_PUBLIC_LOOM_URL` is set on Railway:

> Watch it in 30 seconds: [Loom URL]

## 12. Screenshot / OG image guidance

The deployed page generates a 1200×630 social preview automatically (`/og-ledgerlens.png`). Verify it renders correctly in LinkedIn's Post Inspector before posting. If you want a manual screenshot for an in-line image:

- Capture the trust card moment at the end of `/demo` step 6 (when the page shows "Every finalized row in this demo ledger is verified before export").
- Or capture the hero with the trust card visible at desktop width.
- Avoid screenshotting `/evals` for the launch post — the eval page is for the engineering audience and the 63% number is best read in context, not as a standalone image.

## 13. Ten hashtags

`#AIEngineering` · `#SoftwareEngineering` · `#FullStack` · `#SmallBusiness` · `#FastAPI` · `#NextJS` · `#Anthropic` · `#HumanInTheLoop` · `#PortfolioProject` · `#CareerChange`

## 14. Three alternate hooks

If the main hook doesn't fit your voice, try one of these instead. Each one leads with a different angle.

1. **The cost-control hook.** "I built an AI bookkeeping prototype that runs at $0 on the public demo deploy. The model is never imported in demo mode — there's a regression test that fails if it ever is. Here's how the trust boundary works without it."

2. **The career-pivot hook.** "After 25 years in automotive retail and enterprise implementation, I shipped my first portfolio AI product. LedgerLens turns messy bank transactions into a verified ledger by combining deterministic rules, correction memory, review routing, and human-in-the-loop. The architecture story is the part I'm proudest of."

3. **The honest-AI hook.** "Most 'AI bookkeeping' tools either guess and quietly contaminate the books or wrap a chat UI around a model and call it done. LedgerLens does neither — it routes uncertainty to a human and only counts a row as 'finalized' when it was decided by a defensible authority. Three-minute guided demo at [link]."

## 15. Recruiter DM follow-up template

Use this after the post is published if a recruiter likes or comments. Personalise the first sentence.

> Hi [Name] — thanks for the comment on the LedgerLens post. Quick context: I'm in the middle of pivoting from automotive operations / enterprise implementation into AI software, and LedgerLens is the portfolio piece that demonstrates the kind of work I want to do — layered AI workflows with cost control and a real trust boundary, not chatbot demos.
>
> If you're hiring for AI engineering, applied AI, solutions engineering, or AI workflow automation roles, I'd love to chat. About page: https://ledgerlens.up.railway.app/about — GitHub: https://github.com/mpalmer79

## 16. Short explanation of the verified-ledger metric

If anyone asks "what does 100% verified actually mean?", use this exact answer:

> It's a workflow-level metric, not a model-level one. LedgerLens refuses to mark a ledger row as "finalized" unless one of three things is true: a human reviewed it, it was decided by correction memory that was originally seeded by a human, or it was auto-approved by a deterministic rule above the confidence threshold. Demo-stub results and unreviewed model auto-approvals never qualify. So 100% is true by construction — the system simply doesn't allow finalized rows that lack a defensible authority. Raw model accuracy is a different number (~63%) and is published honestly on the evals page.

## Suggested GitHub README excerpt

> **LedgerLens** is an AI-assisted bookkeeping workflow prototype for small businesses. It turns messy bank transactions into a verified categorized ledger by combining deterministic rules, human correction memory, review routing, and audit trails.
>
> The headline metric is workflow-level, not model-level: **100% of finalized guided-demo ledger rows are verified before export.** Raw model accuracy (~63% overall) is reported honestly on `/evals` — see [`docs/TRUST_METRIC.md`](docs/TRUST_METRIC.md) for the precise contract.
>
> **Start with the 3-minute guided demo at `/demo`.**
