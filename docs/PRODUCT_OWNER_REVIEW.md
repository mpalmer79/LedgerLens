# Product owner review — session 17

## 1. The original problem

LedgerLens worked end-to-end (import → categorize → review → corrections → rules → ledger → eval) and ran in zero-cost demo mode, but the *story* was invisible. A first-time visitor saw a developer-facing landing page ("Categorization you can trust. Calibration you can prove."), three abstract pillars about calibration and auditability, and an `Open the app` button that dumped them into seven tabs with no narrative thread. There was no business problem statement, no guided path, no "why a small-business owner would care," and no recruiter-facing technical credibility section.

## 2. Why the old experience felt like a shiny penny

- The headline talked to engineers, not bookkeepers.
- The primary CTA pointed at `/evals` — an eval dashboard, not the product workflow.
- Workflow pages had no framing copy; each was a functional table.
- The dashboard empty state was inert — "Total: 0, Auto-approved: 0…" without a next action.
- There was no guided walk-through. A viewer who didn't already know the bookkeeping flow had to puzzle out which tab to click first.
- The recruiter signal (Audit-event-on-every-state-change, demo-stub regression test, eval calibration) was buried in docs.

## 3. What changed in this PR

| Surface | Before | After |
|---|---|---|
| Landing `/` | "Categorization you can trust." + abstract pillars + CTA to /evals. | "Turn messy bank transactions into a reviewed small-business ledger." + 3 business value cards + recruiter-facing tech-credibility section + primary CTA to `/demo`. |
| New `/demo` | (didn't exist) | Seven-step guided journey backed by real backend calls: the mess → seed → categorize → review → correct → memory replay → ledger. ~3 minutes end to end. |
| Backend | (no demo support) | `GET /demo/status` · `POST /demo/seed` · `POST /demo/reset` · `GET /demo/sample-transactions`. All guarded to `CATEGORIZER_MODE=demo_stub`. Reset only deletes `source="demo"` rows. |
| Dashboard `/app` | "Workflow dashboard." + "Import bank transactions, run the categorizer…" | "Small-business bookkeeping cleanup, with human oversight." + first-time empty state pointing to `/demo` + "Why this matters" panel. |
| Review queue | "Review queue. Transactions whose latest categorization needs a human." | "Review is the safety layer." + "What happens when you correct?" side note. |
| Corrections | "Learned corrections. Deterministic correction memory…" | "Human corrections become reusable bookkeeping memory." + "Why this matters" bullets. |
| Rules | "Deterministic rules." | "Obvious vendors should not require AI." + tenant note. |
| Ledger | "Ledger. Finalized categorized transactions…" | "Reviewed ledger export." + "the final product is not an AI response." |
| Nav | seven workflow tabs | adds **Guided demo** as the first tab. |
| Docs | (no LinkedIn story, no product review) | New `LINKEDIN_PROJECT_STORY.md`, this `PRODUCT_OWNER_REVIEW.md`, `PRODUCT_STORY_OVERHAUL_PLAN.md`. README intro rewritten around the product story. |

## 4. New target user journey

**Recruiter or small-business owner (cold, no context):**

1. Lands on `/`. Reads "Turn messy bank transactions into a reviewed small-business ledger." in 5 seconds.
2. Scans the three value cards — *save time, reduce mistakes, learn from corrections* — in 10 more seconds.
3. Clicks "Start the 3-minute demo →".
4. On `/demo`, sees a list of realistic messy transactions (Comcast, ADP, ACH transfer, …) with a paragraph explaining the cleanup problem.
5. Clicks "Load sample transactions" (real `POST /demo/seed`).
6. Clicks "Run categorization" (real `POST /categorize/batch`). Sees results grouped by source: Memory / Rule / Demo Stub.
7. Reads the routing-to-review explainer; sees the first item in review.
8. Clicks "Correct the top review item" (real `POST /review-queue/.../correct`).
9. Clicks "Re-categorize the same transaction" (real `POST /categorize`). Sees the same transaction now decided by `correction_memory` at zero cost.
10. Clicks "Load the ledger" → "Export ledger CSV ↓".
11. Reads the "what this demonstrates" pane: full-stack, AI-safe routing, cost control, human-in-the-loop, eval awareness, honest scope.

End-to-end in under three minutes, every step backed by the real backend.

## 5. Business value

The viewer can articulate, without help:

- **What problem** — small-business bookkeeping cleanup.
- **Why it matters** — wrong categories propagate to financial statements and tax filings.
- **How LedgerLens helps** — rules for obvious vendors, review for ambiguous ones, memory for repeat corrections.
- **What they get** — a reviewed ledger CSV, not an AI hallucination.

## 6. Technical value

The recruiter can articulate, without help:

- **Layered AI architecture** — memory → rules → fallback → routing → review.
- **Cost control** — demo-stub mode with a regression test that asserts the Anthropic SDK is never imported.
- **Auditability** — every state change writes an `AuditEvent`; the UI shows provider attribution per result.
- **Honest evaluation** — auto-approved accuracy, review rate, calibration ECE/MCE, separated model-only vs deterministic.
- **Full-stack chops** — FastAPI + SQLAlchemy 2.0 + Next.js 14 + typed client + Dockerfile builds + Railway deploy.
- **Operational discipline** — `/demo/*` endpoints gated to demo mode, `/demo/reset` scoped to `source="demo"` only, demo seed reuses the production write path.

## 7. Remaining weaknesses

- **Per-tenant rule generation is still missing.** Rules-only and hybrid eval modes show 0% on the synthetic dataset because the bundled rules target the default seed COA. Each synthetic business has different code numberings. The README and eval page both say so, but the right fix is to ship a small per-tenant rule translator.
- **No semantic correction matching.** Adobe and "Adobe Inc" still need a fresh correction. Embedding-based retrieval is documented as v2 work.
- **The 3D transaction-carousel hero was retired** in favour of a simpler business-first hero. Some of that visual polish is gone. If the next sprint wants the carousel back, it should live below the headline, not next to it.
- **No on-deploy verification harness.** The Railway deploy still needs a human to confirm `CATEGORIZER_MODE=demo_stub` and that `ANTHROPIC_API_KEY` is unset. A scheduled job that pings `/ready` and posts to a status channel would catch a misconfiguration sooner.
- **The `/app` empty state still relies on the user clicking the "Start here" card.** A real product would auto-redirect first-time visitors to `/demo`.

## 8. Next best improvements

1. **Per-tenant rule generation.** A small CLI that maps bundled rules' default-COA codes to each eval business's COA by name-match, then re-runs the rules-only and hybrid evals. Turns 0% into something meaningful and proves the rule layer's real value.
2. **Structured logs + request IDs.** Every endpoint should log with a request ID; the ledger and audit endpoints should include it in their error envelope. Operational basics.
3. **Log-redaction utility.** Raw transaction descriptions should never land in unsafe logs. The existing `services/normalize.py` is one half; a redaction utility for error paths is the other.
4. **A real product-mode switcher in the UI.** "Demo mode" is currently surfaced as a banner; making it a deliberate one-click toggle for local dev would close the demo-vs-anthropic loop visibly.
5. **Carousel revival.** Bring back the 3D transaction carousel as a below-fold animation on the landing page, not as the hero.

## 9. LinkedIn positioning

See `docs/LINKEDIN_PROJECT_STORY.md`. The short version: this PR makes the project a credible portfolio centrepiece. The story now reads consistently for three audiences (small-business owner, recruiter, engineering reviewer), and the guided demo is the canonical first impression. The previous landing page was talking past everyone.

## 10. Final self-grade

| Dimension | Before this PR | After |
|---|---|---|
| Business problem clarity | C-: needed the reader to infer | B+: stated in the headline |
| First-time-visitor path | D: tab maze | A-: 3-minute guided demo |
| Recruiter technical signal | C: buried in docs | B+: six cards above the fold + eval evidence link |
| Honest framing | A-: already strong | A: preserved and reinforced |
| Production-readiness positioning | B: portfolio chip present | A-: chip + demo banner + ready-state-reflects-mode |
| Code quality | A: existing standard | A: 128 backend / 21 frontend tests, ruff/format/mypy/lint clean |

Overall: the product now tells a clear story. The thing it most still needs is per-tenant rule generation so the eval numbers reflect the rule layer's real production value rather than the synthetic-COA artefact. That's the next PR.
