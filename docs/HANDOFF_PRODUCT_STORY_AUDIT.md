# Handoff product-story audit

## 1. What the new /cleanup, /questions, and /handoff PR changed

- Three new routes are live: `/cleanup` (six-step checklist), `/questions` (plain-English review-queue projection), `/handoff` (accountant handoff page + markdown export).
- Backend gained `GET /handoff` + `GET /handoff/export.md`, both derived from existing persisted state — no new tables.
- `CleanupImpactSummary` ships a conservative time-saved estimate everywhere it appears.
- AppShell nav added Cleanup / Questions / Handoff. Backend test count up to 141; frontend up to 106.

The *capabilities* are in place. The *marketing layer* is not.

## 2. Where the homepage still undersells the business value

- Hero headline still says "Turn messy bank transactions into a **verified small-business ledger.**" That's correct but it stops short. The actual deliverable a small-business owner cares about is the **accountant handoff package**.
- Primary CTA is still "Start the 3-minute demo →". Demo-first is right for a recruiter but wrong for a small-business owner — they want "Start monthly cleanup" pointing at the actual workflow.
- There is no visible artefact of the handoff anywhere on `/`. A viewer can't see the deliverable until they click through three pages.
- The "Why a small-business owner cares" section talks about *categorization* (save time, reduce mistakes, learn from corrections) but not about *the handoff*.
- The trust card still ends at "verified finalized demo ledger" — it doesn't connect verification to the handoff destination.

## 3. Where the demo should be reframed around monthly cleanup

- `/demo`'s seven-step narrative ends at "Verified ledger export" (step 6). The handoff doesn't appear at all.
- Step 1's framing is "The bookkeeping mess" — keep that, but the *opening sentence above the steps* should explicitly call out monthly cleanup, not generic "messy transactions."
- The final outcome card needs to point at `/handoff` and `/cleanup` as destinations after the demo, not just `/ledger`.

## 4. Where the app dashboard should prioritize cleanup and handoff

- `/app` empty state currently offers three cards: Start guided demo / Import transactions / View technical story. **Cleanup** is missing entirely. That's the single biggest miss for a small-business owner who opens the deployed app.
- When data exists, the dashboard shows operational tiles (Total / Auto-approved / Corrected / Needs review / Pending / Learned corrections). All useful — but the most actionable signal for an owner is "where am I in the cleanup checklist?", which isn't shown.

## 5. How the verified-ledger trust metric supports the handoff story

The trust metric and the handoff are the same idea told twice:

> A row is *verified* iff it came through review, memory, or rule auto-approval. The handoff package contains the verified rows as "Ready for accountant" and the unverified ones as "Needs review."

The hero trust card should explicitly say *"finalized rows backed by review, correction memory, or deterministic rules before they appear in the handoff package."* That single edit turns the trust metric into a feature of the workflow story instead of an abstract metric.

## 6. How to explain this to small business owners

In one sentence:

> **LedgerLens is a monthly bookkeeping cleanup assistant that produces a verified accountant handoff package.**

The supporting bullets are:

- Import this month's bank CSV.
- Obvious vendors (Comcast, QuickBooks, Shell, payroll) are handled automatically.
- Uncertain rows become **plain-English questions** ("What was this ACH transfer for?") instead of accounting-code dropdowns.
- Your answers become **review notes** for the accountant.
- A **verified ledger** + **markdown handoff** + **CSV export** is the deliverable.

What an owner should *not* see leading the homepage:

- "62.9% accuracy" — that's a model metric, not a business one.
- "AI categorizer" — that's the engine, not the product.
- "Eval harness" — that's developer language.

## 7. How to explain this to recruiters

Recruiters skim `/technical-story` and `/evals`. They want to see:

- Layered AI decisioning (memory → rules → fallback).
- Cost control (demo-stub mode, regression-tested zero spend).
- Workflow-level trust metric (verified ledger).
- Honest evaluation (raw model numbers preserved on `/evals`).
- Full-stack delivery (FastAPI + Next.js + Postgres-ready + Railway).

None of that needs to change. What the recruiter *does* benefit from on `/` is seeing that Michael shipped a **business product**, not just a model wrapper. The accountant-handoff preview card is the visual proof of that.

## 8. What this sprint will implement

Scoped tight:

- **Homepage** — new headline + subheadline; CTA flips to "Start monthly cleanup" → `/cleanup`; secondary CTA "View accountant handoff" → `/handoff`; existing "See the engineering story" preserved; new **Before/After** section; new **Handoff preview** card with clearly-labeled example numbers; trust-card explanation amended to mention the handoff.
- **Demo** — opening "what to look for" panel updated to call out monthly cleanup framing; step 6 outcome card adds a "Open handoff package →" CTA.
- **/cleanup** — short intro paragraph; final "Monthly cleanup outcome" card showing trust + impact summary.
- **/questions** — intro paragraph clarifying that AI shouldn't guess; empty-state card pointing to `/cleanup` + `/handoff`.
- **/handoff** — already strong; add a one-line honesty note ("not tax advice or a substitute for accounting review") + clearer export-area explanations for markdown vs CSV.
- **/app** — empty state gets a fourth card: "Start monthly cleanup" as the primary recommendation.
- **MarketingNav** — add Cleanup + Handoff as top-level items.
- **README** — new opening; "What problem does it solve?" + "What is the handoff package?" sections.
- **LinkedIn doc** — short / long versions + recruiter DM note.
- **Generated walkthrough** — Phase 5 scene-by-scene update is out of scope (it ships in a separate CSS-keyframe component). Document the desired update in `docs/GENERATED_WALKTHROUGH.md` as a follow-up; the existing six-scene story still reads correctly with this sprint's framing.
- **Tests** — page-content contracts for the new copy on `/`, `/demo`, `/cleanup`, `/questions`, `/handoff`, `/app`; nav contract for Cleanup + Handoff. No new backend behavior, no new backend tests.
- **Docs** — `docs/HANDOFF_PRODUCT_STORY_AUDIT.md` (this file) + `docs/HANDOFF_STORY_REVIEW.md` (Phase 17).

## 9. What should wait for later

- **Generated walkthrough rescript.** The CSS-keyframe animation works as-is for the LinkedIn audience and a rescript would require new SVG-timed visuals. Defer; document in `docs/GENERATED_WALKTHROUGH.md`.
- **Full mobile / tablet QA pass on new content.** Phase 15. The previous sprints already pinned the responsive contracts (`MarketingNav.test.tsx`, page-content tests). The new sections add only stacked-grid card components that already follow the existing responsive rhythm. Spot-check in this PR; a dedicated QA sprint can follow if needed.
- **Per-tenant rule generation.** Still the highest-value engineering follow-up.
- **PDF handoff export.** Markdown is sufficient.
- **OwnerQuestion / OwnerAnswer dedicated model.** Notes-on-ReviewDecision is good enough for v1.

## Acceptance criteria

- Homepage hero leads with "monthly bookkeeping cleanup" + "accountant handoff package" wording, with `/cleanup` as the primary CTA.
- A handoff preview card is visible on the homepage with clearly-labeled illustrative numbers.
- `/cleanup` opens with a one-sentence framing line and ends at an outcome card.
- `/handoff` has a one-line honesty note about not being tax advice.
- `/app` empty state includes a "Start monthly cleanup" card.
- MarketingNav exposes Cleanup + Handoff at desktop and inside the mobile sheet.
- README intro is rewritten around the cleanup-assistant identity.
- All existing tests stay green; new tests pin the new copy contracts.
