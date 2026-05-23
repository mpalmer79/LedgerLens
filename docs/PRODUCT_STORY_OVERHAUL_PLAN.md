# Product story overhaul — plan

## What's wrong today

The app *works* end-to-end (import → categorize → review → corrections → rules → ledger → eval) but the **story** is invisible. A first-time visitor on the landing page sees a generic "AI engineering portfolio project" headline, three abstract pillars about calibration / auditability / failure modes, and a "Open the app" button that dumps them into a workflow dashboard with no narrative. The seven workflow pages are each useful in isolation, but none of them say *why a small-business owner would care about LedgerLens specifically*.

Concretely:

1. **Landing page (`/`)** opens with "Categorization you can trust. Calibration you can prove." — true, but it talks to engineers, not bookkeepers. There is no business problem statement, no value cards in business language, no recruiter-facing technical-credibility section, and the primary CTA goes to `/evals` (an eval dashboard, not the product).
2. **No guided demo.** A viewer has to know to upload a CSV, run categorization, then go to review, then to corrections, then to ledger. They will not stay long enough to discover this flow on their own.
3. **`/app` dashboard** is operational ("Workflow dashboard. Import bank transactions, run the categorizer …") with no "why this matters" framing and a dead empty state when there are zero transactions.
4. **Page copy is functional, not narrative.** Review queue is a list. Corrections is a table. Rules is a table. Ledger is a table. None of them open with a one-line statement of what role they play in the bookkeeping workflow.
5. **Recruiter signal is buried** in the eval page, the README, and the gap-analysis doc. There is no "what skills does this demonstrate?" section anywhere on the deployed site.

## Strengths to preserve

- The full backend pipeline (memory → rules → demo-stub-or-anthropic → routing → review → audit) is real and works.
- The eval harness emits routing / calibration / confusion metrics honestly.
- The demo-stub mode guarantees zero paid spend for the public Railway deploy.
- All seven workflow pages exist and are functional; they just need framing copy.

## Audiences

| Primary | Secondary | Tertiary |
|---|---|---|
| Small-business owner (bookkeeping pain) | Technical recruiter / hiring manager | Engineering reviewer evaluating the codebase |

The same page sequence must read sensibly to all three — business-first headlines, with the engineering depth visible enough that a recruiter who scrolls picks it up.

## The new demo journey

A single guided route at `/demo` walks the viewer through the story in seven narrative steps, each backed by a real backend call:

1. **The bookkeeping mess** — list 10–12 realistic messy transactions (Comcast, QuickBooks, Stripe, Shell, ADP, Sysco, Costco Business, vague ACH …) with a paragraph explaining the cleanup problem.
2. **Import** — one-click "Load sample transactions" calls `POST /demo/seed` (or, if backend not yet wired, `POST /transactions/batch`).
3. **Layered categorization** — `POST /categorize/batch`. Show the results grouped by source: Memory / Rule / Demo Stub / Model. Tell the viewer the model is *not* called when memory or a rule already decides.
4. **Trust and review** — surface the items that landed in `needs_review` with a paragraph explaining *why* review is a feature, not a bug.
5. **Human correction becomes memory** — guide the viewer through a real `POST /review-queue/{id}/correct`, then trigger a second categorize and show that the second transaction was decided by memory at zero cost.
6. **Final ledger** — pull `/ledger` and offer the existing CSV export.
7. **Engineering proof** — a final pane that names the full-stack + AI-systems-design + auditability + cost-control skills demonstrated.

## Demo backend support

Three small endpoints, all gated to `CATEGORIZER_MODE=demo_stub` so they can never wipe real data:

- `GET /demo/status` — returns counts (transactions, results, review queue, corrections) so the frontend can render the demo state cleanly.
- `POST /demo/seed` — imports a bundled 12-row sample CSV through the same `POST /transactions/batch` path the import page uses. Returns the created transaction list.
- `POST /demo/reset` — deletes only rows tagged `source="demo"`. Never touches anything else.

Outside demo mode these endpoints return `503 demo_mode_only` so they're inert in production.

## Page-by-page copy upgrades

Each existing page gets a header rewrite (no layout churn) plus 1–2 short framing paragraphs:

| Page | Old framing | New framing |
|---|---|---|
| `/app` | "Workflow dashboard." | "Small-business bookkeeping cleanup, with human oversight." + "Why this matters" panel + Next-best-action chip. |
| `/transactions` | (no framing) | One-line explanation that this is the workflow inbox. |
| `/review` | "Review queue" | "Review is the safety layer." + "What happens when you correct?" side note. |
| `/corrections` | "Learned corrections" | "Human corrections become reusable bookkeeping memory." + "Why this matters" bullets. |
| `/rules` | "Deterministic rules" | "Obvious vendors should not require AI." |
| `/ledger` | "Ledger" | "Reviewed ledger export." + unresolved warning. |
| `/evals` | already engineering-focused | Add "What this proves" plain-English block. |

## Honesty rules (do not break)

- The demo stub is **not** AI. Source tags continue to read "Demo Stub" with the existing explanation: "routed to review without using a paid model provider."
- No accuracy or cost number gets inflated. All comparison numbers come from committed JSON artifacts.
- Portfolio-demo framing stays visible. Removing the "Demo prototype" chip would mislead.
- Per-tenant COA limitation stays documented on the eval page and in the demo step that talks about rules.

## Deliverables

1. `docs/PRODUCT_STORY_OVERHAUL_PLAN.md` (this file).
2. Landing page rewrite (`/`): business-first headline, three business value cards, recruiter-credibility section, primary CTA → `/demo`, secondary CTA → architecture doc.
3. New guided route `/demo` with the seven narrative steps, driven by real backend calls.
4. Backend `/demo/{status,seed,reset}` endpoints, gated to demo mode.
5. Header-copy upgrade on all six workflow pages.
6. `/app` dashboard: outcome-focused title, "Why this matters" panel, next-best-action card.
7. `docs/LINKEDIN_PROJECT_STORY.md` and `docs/PRODUCT_OWNER_REVIEW.md`.
8. README intro rewritten around the product story.
9. Vitest + pytest coverage for the new endpoints and the demo page's data-driven rendering.

## Acceptance

- A small-business owner can read the landing page and articulate the value in one sentence within 15 seconds.
- A recruiter can scroll one screen and see "full-stack + AI systems + audit/cost design."
- A viewer can complete `/demo` in under 3 minutes and end up at the ledger export.
- Every existing test still passes; every new load-bearing behavior has a test.
- `/demo/reset` only deletes demo-tagged rows. Outside demo mode the endpoints are 503.
- The deploy still uses no paid-API spend.
