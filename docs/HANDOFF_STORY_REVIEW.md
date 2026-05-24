# Handoff story review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Homepage headline | "Turn messy bank transactions into a verified small-business ledger." | "Clean up this month's books and send your accountant a **verified handoff**." |
| Homepage eyebrow | "For small-business bookkeeping cleanup" | "Monthly bookkeeping cleanup assistant" |
| Primary CTA | `Start the 3-minute demo →` → `/demo` | **`Start monthly cleanup →` → `/cleanup`** |
| Secondary CTA | "Read the technical story" | **`View accountant handoff` → `/handoff`** (heavier outline button) |
| Tertiary links | Demo / Tech story / About / GitHub | Same, plus the demo link is now a smaller text link rather than a button |
| Trust card explainer | "Finalized rows are backed by … before export." | "… **before they appear in the handoff package.**" |
| Before / After section | Did not exist | New section: "From messy transactions to accountant-ready handoff" + "What you get in the handoff package" card. |
| Handoff preview | Did not exist | Full **Example handoff preview** card with six labelled tiles (illustrative numbers explicitly tagged), four section blocks (Ready for accountant / Needs review / Owner answers / Corrections learned), and CTAs to `/handoff` and `/cleanup`. |
| MarketingNav | Demo as primary CTA + 4 secondary links | **Cleanup as primary CTA** + Handoff + Demo + Technical story + Evals + About + GitHub. Mobile sheet adds Cleanup and Handoff. |
| `/cleanup` intro | "Turn this month's messy transactions into a verified ledger package…" | "**Use this checklist once a month** to move from messy bank activity to a verified handoff package." |
| `/handoff` export area | Two flat buttons | Two-card grid: each export gets a button + a one-sentence explanation ("for accountant context or email handoff" vs "for ledger import or spreadsheet review"). New honesty line: **"This is not tax advice or a substitute for accounting review."** |
| `/app` empty state | Three cards (Demo / Import / Technical story) | **Four cards** with **Open cleanup assistant** as the primary brand-bordered CTA. Header reads "Start monthly cleanup." |
| README | "An AI-assisted bookkeeping workflow prototype for small businesses." | "A **bookkeeping cleanup assistant** for small businesses." + new "What problem does it solve?" + "What is the handoff package?" sections. |
| LinkedIn doc | One launch post | Long version (rewritten around the cleanup → handoff narrative) + short LinkedIn-skim version. |
| Honesty | "Trust metric, not raw model accuracy" everywhere. | Preserved — plus an explicit "**not tax advice or a substitute for accounting review**" line on `/handoff`. |

## 2. How the homepage now explains the value

A small-business owner reads, top to bottom:

1. **Eyebrow:** "Monthly bookkeeping cleanup assistant" — names the product category.
2. **Headline:** "Clean up this month's books and send your accountant a verified handoff." — names the *outcome*.
3. **Subhead:** owner imports bank activity, classifies obvious vendors, answers plain-English questions, exports a verified ledger package.
4. **Primary CTA:** "Start monthly cleanup →" — points at the actual workflow page.
5. **Secondary CTA:** "View accountant handoff" — surfaces the deliverable.
6. **Trust card:** 100% verified … *before they appear in the handoff package*.
7. **Before / After:** the Monday-of-the-month pain on the left, the LedgerLens outcome on the right, and a "what you get" card listing all six artefacts.
8. **Example handoff preview:** a polished mock of the handoff page with clearly-labelled illustrative numbers.
9. **30-second walkthrough** (preserved).
10. **Three business value cards** (preserved).
11. **Six tech-credibility cards** (preserved).
12. **About strip + recruiter-relevance line + footer** (preserved).

A recruiter still gets `/technical-story` → engineering depth + LLM-wrapper comparison + the trust model in 60 seconds. A small-business owner now gets the *business outcome* in 15.

## 3. How /cleanup supports the monthly workflow

The page intro now reads "**Use this checklist once a month** to move from messy bank activity to a verified handoff package." The six steps (import → classify → review → questions → verify → export handoff) drive off the real backend state, and the final action button on step 6 routes straight to `/handoff`. The `CleanupImpactSummary` shows a conservative estimated time saved with explicit "estimate" framing.

## 4. How /questions supports owner context

Unchanged in this PR — the four pattern-matched question templates (ACH transfer / Amazon-Costco / fuel-gas / subscription) plus the default template already use plain-English answers that route to the existing review-correct / approve / mark-uncategorizable endpoints. Owner answers are stored in `reviewer_note` and surface on `/handoff`.

## 5. How /handoff creates a tangible business output

- Two clearly-labelled exports: **markdown** for accountant email context, **CSV** for ledger import. Each carries a one-sentence "use this for X" explanation directly under the button.
- Five sections: cleanup summary (TrustPanel + CleanupImpactSummary) / ready for accountant / needs review / owner answers / corrections learned.
- Explicit honesty footer: "This is **not tax advice or a substitute for accounting review**. It is a cleanup and handoff aid."
- The audit trail records every export (`AuditEvent` with `entity_type="handoff"`, `action="exported"`).

## 6. How trust metric supports the business story

The trust card on the homepage now says rows are verified *before they appear in the handoff package*. The trust panel on `/handoff` itself shows the same numbers next to the CleanupImpactSummary. A row that's "verified" on the trust panel is the same row that lands in "Ready for accountant" — one definition, three surfaces.

## 7. Remaining product weaknesses

- ~~**Generated walkthrough still narrates "verified ledger export," not "accountant handoff."**~~ **Resolved in PR #38** — the six-scene animation now ends on "Export the accountant handoff package" with the same trust card. See `docs/WALKTHROUGH_HANDOFF_RESCRIPT_AUDIT.md` and `docs/WALKTHROUGH_HANDOFF_STORY_REVIEW.md`.
- ~~**Demo data feels synthetic — generic transactions don't pattern-match as a real business.**~~ **Resolved in PR #39** — the demo seeds the fictional **Granite State Auto Repair** monthly cleanup scenario (42 March 2026 transactions covering parts, payroll, utilities, software, fuel, insurance, deposits, and the ambiguous rows a real cleanup turns up). The homepage example preview, `/demo`, `/cleanup`, and `/handoff` all surface the scenario name when demo data is present. See `docs/SAMPLE_BUSINESS_SCENARIO.md`.
- **The handoff preview card uses static numbers.** Pulling live `/handoff` data into the homepage would mean a network call on a marketing page; the static preview with the "illustrative" badge is the right tradeoff for v1.
- **No PDF handoff export.** Markdown is more useful for pasting into emails; PDF can come later if a user asks.
- **No QuickBooks IIF / QBO XML export.** Out of scope for v1.
- **`/questions` empty state could be friendlier.** It already shows a CTA to `/handoff`, but the headline ("No open questions.") is functional rather than celebratory. Minor.
- **Per-tenant rule generation** remains the highest-value engineering follow-up.

## 8. Next recommended product PR

**Rescript the generated walkthrough animation** to end at the accountant handoff package, not the ledger export. Add a sixth scene with a mock of the handoff markdown report being copied into an email. This closes the loop between the homepage preview, the live `/handoff` page, and the 30-second auto-playing animation — they would all tell the same story.

## 9. Staff-level product score before / after

| Dimension | Before PR | After PR |
|---|---|---|
| Hero outcome clarity (small-biz owner) | C+: "verified ledger" is correct but stops short of the deliverable | A-: headline names the actual deliverable (verified handoff for the accountant) |
| Primary CTA alignment | C: demo-first, business workflow buried | A: `/cleanup` first; demo demoted to text link |
| Visible deliverable | F: handoff was a third-click destination | B+: example preview card on the homepage, real handoff page one click away |
| Trust-metric-to-deliverable connection | C: trust card stops at "verified ledger" | A: trust card explicitly connects verification to the handoff package |
| Honesty preservation | A | A (added explicit "not tax advice" disclaimer) |
| Recruiter signal | A- (preserved from earlier sprints) | A- (engineering depth unchanged, still one click away on `/technical-story` and `/evals`) |
| Code quality | A | A: 141 backend + 110 frontend tests, ruff/format/mypy/lint/build all clean |

## 10. Launch recommendation

**Ready to ship this PR.** The product story is now coherent end-to-end: hero → before/after → handoff preview → walkthrough → value cards → tech cards → About strip → footer. Every public surface uses the same product identity. Honesty is intact. Tests cover the contracts.

The next sprint should be the **generated walkthrough rescript** (Phase 5 above, documented as follow-up). A separate sprint can do **per-tenant rule generation** so the eval numbers reflect the rule layer's real production value. Neither blocks shipping this PR.
