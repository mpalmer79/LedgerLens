# Generated walkthrough

A code-generated, ~30-second animated story of the LedgerLens **monthly
cleanup → accountant handoff** workflow. Lives at
`frontend/src/components/marketing/GeneratedWalkthrough.tsx` and is
rendered automatically on the homepage when no Loom URL is configured.

## What it is

Six CSS-keyframe scenes that loop on a single 30-second timeline:

| t (s) | Scene | Visual headline |
|---:|---|---|
| 0 – 5 | Monthly cleanup intro | "Start with messy bank activity from this month." + the messy-transactions list (Comcast, QuickBooks, ADP, Shell, Amazon, ACH transfer). |
| 5 – 10 | Obvious vendors handled first | "Rules and correction memory classify repeatable items before AI fallback." + four classified rows tagged `Rule` or `Memory`. |
| 10 – 15 | Owner questions | "AI should not guess what the owner knows." + an owner question card for the unknown ACH transfer with five plain-English choices. |
| 15 – 21 | Accountant context | "Plain-English answers are saved as review notes for the handoff." + two answer rows (ACH → Needs accountant review; Amazon → Office supplies). |
| 21 – 26 | Verified vs review | "Finalized rows are backed by review, rules, or correction memory." + a side-by-side **Ready for accountant** vs **Needs review** split. |
| 26 – 30 | Handoff package | "Verified ledger, owner answers, unresolved items, and learned corrections in one package." + `handoff-2026-03.md` preview + the trust card. Final card: **100% verified finalized demo ledger** + "0 uncertain rows silently finalized." |

A progress bar across the bottom advances over the full 30 seconds; the
animation loops infinitely. Reduced-motion users see the final
"accountant handoff" frame as a static image (no motion, no loop).

The keyframe windows are tiled as `5 + 5 + 5 + 6 + 5 + 4 = 30s` — see
`GeneratedWalkthrough.module.css` for exact percentages.

## What it is *not*

- It is **not** a real screen recording of the live app. The host
  component (`VideoDemo`) marks the surface with a "Generated
  walkthrough" badge so no one can mistake the two.
- It is **not** a claim about raw model accuracy. The trust card uses
  the same workflow-level phrasing as the rest of the product: "100%
  verified finalized demo ledger — workflow-level trust metric, not raw
  model accuracy."
- It does **not** add any new runtime dependencies. Pure CSS keyframes
  + inline JSX. No Framer Motion, no Remotion, no `<video>` element.
- It does **not** give tax advice. The honesty disclaimer ("not tax
  advice or a substitute for accounting review") lives on `/handoff`
  itself, which the final scene points to.

## Why it ends at the accountant handoff

PR #36 reframed LedgerLens as a monthly bookkeeping cleanup assistant
that produces a verified accountant handoff package. PR #37 rewrote the
homepage and primary CTAs around the same identity. The walkthrough was
rescripted in PR #38 so the 30-second animation tells the same story the
hero promises and points at the same deliverable a real owner would
send to their accountant. See
`docs/WALKTHROUGH_HANDOFF_RESCRIPT_AUDIT.md` for the rationale.

## Where it appears

- **Homepage** — embedded via `VideoDemo` when `NEXT_PUBLIC_LOOM_URL`
  is empty. The component swaps to a Loom iframe the moment that env
  var is set. The section header reads "Watch the cleanup-to-handoff
  flow."
- **`/walkthrough`** — a clean full-screen render of the animation with
  no nav and no marketing chrome. Designed to be screen-captured by
  Loom, OBS, or QuickTime; not linked from the public nav. Returns
  `robots: noindex, nofollow` so search engines don't surface it.

## How it differs from a Loom recording

| | Generated walkthrough | Loom recording |
|---|---|---|
| Where it runs | In the browser, inline | Embedded iframe |
| Audio | None — silent animation | Michael's narration |
| Pace | Fixed 30-second loop | User scrubs |
| Setup cost | Zero — already deployed | Record once, set env var |
| Risk of looking faked | Zero — badge says "Generated walkthrough" | Zero |
| Recruiter polish | High | Highest |

The trade is real: a real Loom is more compelling because it's a real
human walking the live app. The generated walkthrough exists so the
homepage doesn't look unfinished while Michael decides when to record.

## How to replace it with Loom

1. Open `/walkthrough` on the deploy. Optionally record from this
   page; it's a clean canvas with no nav.
2. Or follow `docs/LOOM_WALKTHROUGH_SCRIPT.md` and record the live
   workflow on `/cleanup` ending at `/handoff`.
3. Upload to Loom; copy the embed URL.
4. On the Railway *frontend* service, set
   `NEXT_PUBLIC_LOOM_URL=https://www.loom.com/embed/<id>`.
5. Redeploy. `VideoDemo` will pick up the URL at build time and the
   generated animation disappears on the homepage automatically.

## How to record or export it manually

There is no built-in export to MP4 or WebM — the component is rendered
in the browser, not pre-rendered. To capture:

1. Open `https://<deploy-url>/walkthrough` at 1280×720 or larger.
2. Wait one full loop for the animation to settle.
3. Start a screen recorder (Loom, OBS, QuickTime).
4. Record for exactly 30 seconds, starting at the first appearance of
   the "Monthly bookkeeping cleanup" intro scene.
5. Trim, upload, embed. Same as a real Loom.

## Why this avoids fake claims

- The component carries an explicit "Generated walkthrough" badge on
  the homepage. A viewer who reads the page sees the framing.
- The final-frame trust card uses the same wording as the product:
  "100% verified finalized demo ledger" with the workflow-level
  disclaimer immediately below.
- The animation does not include any model-accuracy claim. Raw model
  numbers continue to live only on `/evals`.
- A regression test (`GeneratedWalkthrough.test.tsx`) asserts that the
  rendered markup contains the cleanup-to-handoff scene titles and
  does not contain "100% AI" / "100% accurate AI" / "raw model
  accuracy of 100".
