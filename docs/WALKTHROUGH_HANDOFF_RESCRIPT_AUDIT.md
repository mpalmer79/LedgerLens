# Walkthrough rescript audit

## 1. Why the walkthrough must end at "accountant handoff"

PR #36 introduced the `/cleanup`, `/questions`, and `/handoff` routes that
reframe LedgerLens from "AI-assisted ledger" to "monthly bookkeeping cleanup
assistant that produces a verified accountant handoff package." PR #37 then
rewrote the homepage, MarketingNav, and `/app` empty state to lead with the
same identity: primary CTA is **Start monthly cleanup → `/cleanup`**, the
visible deliverable is the **accountant handoff package**, and the trust
card promises verification *before rows appear in the handoff*.

The 30-second generated walkthrough — used as the homepage video fallback
when `NEXT_PUBLIC_LOOM_URL` is empty, and embedded full-screen at
`/walkthrough` — still ends at "**Verified ledger export.**" That was the
right ending two sprints ago. It is no longer the right ending today.

Concretely the mismatch produces three problems:

1. **Hero → walkthrough → CTA flow now breaks.** The hero promises a
   "verified handoff." The walkthrough crescendos on "verified ledger
   export." A reader scrolling through the page hears the noun change
   underfoot and concludes the surface text and the animation were written
   by two different people.
2. **The handoff package, the actual product deliverable, never appears
   in the 30-second story.** A small-business owner who only watches the
   walkthrough cannot see the artefact they are meant to send to their
   accountant.
3. **Scene 4 ("Review is the safety layer") and scene 5 ("Corrections
   become memory") describe the engineering plumbing, not what an owner
   experiences.** A small-business viewer is not the right audience for
   "correction memory" language; they're the audience for "answer a
   plain-English question, save the answer as accountant context."

## 2. The rescript at a glance

| # | Window | Old scene | New scene |
|---|---|---|---|
| 1 | 0–5s | "LedgerLens / AI-assisted bookkeeping workflow for small businesses." | "Monthly bookkeeping cleanup / Start with messy bank activity from this month." |
| 2 | 5–10s | "Messy bank activity" | "Obvious vendors handled first / Rules and correction memory classify repeatable items before AI fallback." |
| 3 | 10–15s | "Layered decisioning" | "Uncertain rows become owner questions / AI should not guess what the owner knows." |
| 4 | 15–21s | "Review is the safety layer" | "Answers create accountant context / Plain-English answers are saved as review notes for the handoff." |
| 5 | 21–26s | "Corrections become memory" | "Verified rows stay separated from unresolved items / Finalized rows are backed by review, rules, or correction memory." |
| 6 | 26–30s | "Verified ledger export" + 100% trust card | "Export the accountant handoff package" + the same 100% trust card |

The progress bar still spans the full 30 seconds; the timing windows are
re-tiled from `5+5+6+6+5+3` to `5+5+5+6+5+4`. The honesty contract is
preserved verbatim — final card still reads **"100% verified finalized
demo ledger"** with the workflow-level disclaimer.

## 3. What stays the same

- **The "Generated walkthrough" badge** on the homepage. The animation
  is still not a screen recording, and the host component continues to
  say so.
- **The Loom override path.** If `NEXT_PUBLIC_LOOM_URL` is set, the
  iframe still replaces the animation. The rescript only changes the
  fallback.
- **The "100% verified finalized demo ledger" framing** on scene 6 — the
  one trust number that has carried through every sprint.
- **`prefers-reduced-motion`** support — the final scene still renders
  as a static frame for users who don't want motion.
- **Zero new runtime dependencies.** Still pure CSS keyframes.
- **`/walkthrough` route** remains a clean full-screen render with
  `robots: noindex, nofollow`.

## 4. What changes elsewhere

- `frontend/src/components/VideoDemo.tsx` — fallback supporting copy and
  CTA targets flip from `/demo` + `/technical-story` to `/cleanup` +
  `/handoff` (technical-story remains as a smaller secondary text link
  so the recruiter doorway is still one hop away). The badge stays
  "Generated walkthrough." The mini-storyboard relabels itself around
  the new six-scene story.
- `frontend/src/app/walkthrough/page.tsx` — helper sub-line now reads
  "Recording helper for the monthly cleanup → accountant handoff
  walkthrough."
- `frontend/src/app/page.tsx` — the section header above `<VideoDemo />`
  shifts from "Watch LedgerLens in 30 seconds" to "Watch the cleanup-to-
  handoff flow."
- `docs/LOOM_WALKTHROUGH_SCRIPT.md` — primary script is replaced with
  the new six-step narration ending on `/handoff`. The original ledger-
  export script is preserved as "Option C (legacy)" for reference.
- `docs/GENERATED_WALKTHROUGH.md` — scene table updated to the six new
  titles + new explanation of why the story ends at the handoff package.

## 5. Honesty constraints (preserved)

- **No "100% AI accuracy" wording anywhere.** Asserted in
  `GeneratedWalkthrough.test.tsx`.
- **No "raw model accuracy" claim on the trust card.** Still says
  "workflow-level trust metric, not raw model accuracy."
- **No suggestion the animation is a real screen recording.** Badge
  stays. The `/walkthrough` route is still tagged as a recording helper.
- **No tax advice.** The "not tax advice or a substitute for accounting
  review" line lives on `/handoff` (added in PR #37) and remains the
  authoritative disclaimer surface.

## 6. Acceptance criteria

1. Reading the homepage top to bottom — eyebrow → headline → CTAs →
   trust card → before/after → handoff preview → walkthrough video —
   the noun on every surface is **"verified handoff"** or its near
   synonyms, never just "verified ledger export."
2. The 30-second animation tells the same six-step monthly-cleanup
   story the hero promises, in the same order, with the same vocabulary.
3. The Loom override path still works: setting
   `NEXT_PUBLIC_LOOM_URL=https://www.loom.com/embed/<id>` swaps the
   animation for the iframe, no other code changes required.
4. All 110 frontend tests still pass after the rescript (with assertions
   updated to match the new scene titles).
5. The trust contract (`docs/TRUST_METRIC.md`) is unchanged. The
   walkthrough rescript is a marketing-copy change; it doesn't change
   what verification means or how it's measured.
