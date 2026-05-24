# Walkthrough rescript — story review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Scene 1 (0–5s) | "LedgerLens / AI-assisted bookkeeping workflow for small businesses." | **"Monthly bookkeeping cleanup / Start with messy bank activity from this month."** + messy-transaction list. |
| Scene 2 (5–10s) | "Messy bank activity" + messy-tx list. | **"Obvious vendors handled first / Rules and correction memory classify repeatable items before AI fallback."** + four classified rows with `Rule` / `Memory` tags. |
| Scene 3 (10–15s) | "Layered decisioning" + memory → rules → review pipeline. | **"Uncertain rows become owner questions / AI should not guess what the owner knows."** + an owner-question card with five plain-English choices. |
| Scene 4 (15–21s) | "Review is the safety layer" + Needs-Review pill. | **"Answers create accountant context / Plain-English answers are saved as review notes for the handoff."** + two answer rows. |
| Scene 5 (21–26s) | "Corrections become memory" + memory-mapping card. | **"Verified rows stay separated from unresolved items"** + a side-by-side **Ready for accountant** vs **Needs review** split + footer line "Workflow-level verification, not raw model accuracy." |
| Scene 6 (26–30s) | "Verified ledger export" + 100% trust card. | **"Export the accountant handoff package"** + `handoff-2026-03.md` preview + the same 100% trust card. Final note unchanged: "0 uncertain rows silently finalized · workflow-level trust metric, not raw model accuracy." |
| Section header | "Watch LedgerLens in 30 seconds" | **"Watch the cleanup-to-handoff flow"** |
| Supporting copy | "See messy transactions move through rules, review routing, correction memory, and verified ledger export." | "See messy monthly transactions become a verified accountant handoff package — through obvious-vendor rules, owner questions, and verified-vs-review separation." |
| Primary CTA | `Start the live demo →` → `/demo` | **`Start monthly cleanup →` → `/cleanup`** |
| Secondary CTA | `Read the technical story` → `/technical-story` (outline button) | **`View accountant handoff` → `/handoff`** (outline button); `/technical-story` retained as a smaller text link. |
| Mini storyboard | "Import messy transactions / Classify obvious vendors / Route uncertain items to review / Save correction memory / Export verified ledger" | **Six scenes that match the new animation** ending at "Export the accountant handoff package." |
| `/walkthrough` helper | "capture only the card below" | **"monthly cleanup to accountant handoff"** |
| `docs/LOOM_WALKTHROUGH_SCRIPT.md` | Six steps ending on `/demo` verified ledger export. | **Six steps ending on `/handoff` accountant handoff package**, with the original "verified ledger" script archived as Option C. |
| `docs/GENERATED_WALKTHROUGH.md` | Six-scene table ending on "Verified ledger." | **Six-scene table ending on "Handoff package"** + a "Why it ends at the accountant handoff" paragraph. |
| Honesty | Trust phrasing preserved everywhere. | Preserved — plus the `/handoff` "not tax advice" disclaimer from PR #37 remains the authoritative surface. No model-accuracy claim added. |

## 2. How the animation now tells the cleanup → handoff story

A viewer reads, scene by scene:

1. **Step 1 — Monthly bookkeeping cleanup.** The messy bank-activity list anchors the viewer in the owner's actual problem.
2. **Step 2 — Obvious vendors handled first.** Comcast / QuickBooks / ADP / Shell are classified by `Rule` or `Memory`. The viewer sees that AI is not the first authority.
3. **Step 3 — Uncertain rows become owner questions.** The unknown ACH transfer surfaces as a plain-English question with five owner-friendly choices (no COA codes).
4. **Step 4 — Answers create accountant context.** Owner answers attach as review notes — the same `reviewer_note` mechanism the live `/questions` route uses.
5. **Step 5 — Verified vs unresolved.** A side-by-side split shows the same separation the `/handoff` page renders live: Ready for accountant vs Needs review.
6. **Step 6 — Export the accountant handoff package.** The `handoff-2026-03.md` preview names the deliverable. The trust card lands the same 100% workflow-level number.

The progress bar still spans 30s; reduced-motion users still see the final handoff scene as a static frame.

## 3. Honesty preservation

- ✅ Trust card still reads **"100% verified finalized demo ledger"** + "workflow-level trust metric, not raw model accuracy."
- ✅ "Generated walkthrough" badge unchanged on the homepage.
- ✅ Scene 5 carries an explicit footer line: "Workflow-level verification, not raw model accuracy."
- ✅ No "100% AI accuracy" / "100% accurate AI" / "raw model accuracy of 100" anywhere — asserted in `GeneratedWalkthrough.test.tsx`.
- ✅ `/handoff` honesty disclaimer ("not tax advice or a substitute for accounting review") is unchanged and remains the authoritative surface.
- ✅ Loom override path intact — setting `NEXT_PUBLIC_LOOM_URL` still replaces the animation with the iframe.

## 4. Tests

| Test file | Change |
|---|---|
| `frontend/src/components/marketing/GeneratedWalkthrough.test.tsx` | Rewritten — 9 assertions covering all six new scene titles, step labels, owner-question choices, owner-answer rows, ready/needs-review split, handoff-package preview, and the workflow-trust phrasing. Still asserts no "100% AI" / "100% accurate AI" / "raw model accuracy of 100." |
| `frontend/src/components/VideoDemo.test.tsx` | Rewritten — 5 assertions covering Loom fallback, Loom iframe path, new `/cleanup` + `/handoff` CTAs, "Watch the cleanup-to-handoff flow" section title, and the six-step storyboard. |
| Everything else | Unchanged. The other 99 frontend tests still pass without modification. |

Test results: **113 passed (113)** — up from 110 (added 3 net new assertions).
Build: **clean** — `npm run build` produces all routes including `/walkthrough` at 1.04 kB.
Lint: **clean** — `npm run lint` returns 0 warnings / 0 errors.

## 5. Responsive QA

The walkthrough card aspect ratio is locked at 16:9 by `VideoDemo`. Per the new CSS module:

| Viewport | Behavior |
|---|---|
| 360–430px | `@media (max-width: 480px)` collapses the obvious-vendor row, the answer row, and the verified-vs-review grid to single-column. Step labels and titles use `clamp()` for readable scaling. Padding tightens to 14px so cards never touch the edge. |
| 768px (tablet) | Two-column verified-vs-review split renders comfortably; messy-tx list is readable at 11.5px monospace. |
| 1024–1280px+ | Original two-column layouts render at intended size; trust card spans 520px max. |

`prefers-reduced-motion` still renders Scene 6 statically — the handoff package + trust card — so the new ending is still the punchline for motion-sensitive viewers.

## 6. Recommended next PR

> **Update (PR #39):** The next-PR recommendation in this section
> ("Sample handoff package fixture / realistic sample data") shipped as
> the **Granite State Auto Repair** monthly cleanup scenario — 42
> realistic March 2026 transactions plus the fictional business
> identity surfaced on the homepage, `/demo`, `/cleanup`, `/handoff`,
> and the walkthrough animation. See
> `docs/SAMPLE_BUSINESS_SCENARIO.md` and
> `docs/SAMPLE_SCENARIO_REVIEW.md`.

### Original recommendation (preserved for traceability)

The strongest follow-ups, in priority order:

1. **Polish `/questions` with an optional free-text note field** so owners can attach context the multiple-choice answers can't capture. This deepens the "accountant context" promised by Scene 4 of the new walkthrough.
2. **Ship a sample handoff package fixture** at `/handoff?demo=1` (or as a downloadable static file) so cold visitors can see a real, complete handoff package without going through the full cleanup flow.
3. **Per-tenant rule generation** — the highest-value engineering follow-up still standing. Today the rules are global; production users would benefit from learned tenant-specific rules after enough corrections.
4. **CI frontend test enforcement** — the frontend tests pass locally but aren't gated in CI yet. A GitHub Action that runs `npm test` + `npm run lint` on every PR would close the loop the way the backend ruff/format/mypy gates already do.
5. **API client timeout/retry** — small reliability improvement; not blocking.

The animation rescript is the last big piece of the marketing-narrative arc. Subsequent sprints should focus on product depth (#1, #2) and engineering hygiene (#3, #4).

## 7. Launch recommendation

**Ready to ship this PR.** The 30-second animation now tells the same story the homepage tells in the hero, the trust card, the before/after section, and the example handoff preview. Honesty constraints are intact. Tests cover the contracts. The Loom override path still works.
