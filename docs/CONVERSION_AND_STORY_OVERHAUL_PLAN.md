# Conversion + story overhaul plan

## 1. What works now

- The layered AI workflow is real and deployable: memory → rules → demo-stub / Anthropic → review → audit → ledger.
- The verified-ledger trust metric is wired end-to-end (backend `LedgerTrust`, `TrustPanel` on `/demo` and `/ledger`, CSV export with `verified` column, audit event captures the rate).
- `/evals` reports raw model accuracy honestly (~63% overall, ~42% adversarial) with ECE / MCE / routing / confusion-pair blocks.
- Portfolio demo mode keeps the Railway deploy at $0 paid spend, with a regression test that asserts the `anthropic` SDK is never imported in demo mode.
- The guided `/demo` route already walks the seven-step story.
- The README has a TL;DR and the trust metric is documented in `docs/TRUST_METRIC.md`.

## 2. What is still weak

This is a recruiter-conversion problem, not a feature problem.

- **The homepage hero still reads like an engineering portfolio, not a product.** Headline is "Turn messy bank transactions into a reviewed small-business ledger" — close, but the hero has no visual pipeline, no trust card, no video / placeholder, and the previous "current Claude Haiku 4.5: X% accuracy" line is gone but nothing premium replaced it.
- **There is no `/about`.** A recruiter who lands on the site cannot tell who built it, what they're looking for, or how to contact them on LinkedIn / GitHub.
- **There is no `/technical-story`.** The engineering depth is buried in `/evals` and the README.
- **The homepage has no 30-second walkthrough surface.** Recruiters skim videos. We have nothing to drop a Loom into.
- **The empty `/app` state is functional but anticlimactic.** First-time visitors land on a "0 transactions" dashboard that asks them to click into another tab.
- **`/ledger` export does not warn** when unverified finalized rows exist — the trust panel surfaces the number but the export button gives no friction.
- **Favicon 404, no Open Graph metadata.** The browser tab and any LinkedIn share preview look unfinished.
- **PalmerAI Solutions framing is ambiguous** — the footer reads like a company. It is Michael's personal brand for portfolio work.
- **No reusable visual pipeline.** Every page describes the layered architecture in prose. The same component used three times would carry the story.

## 3. How the trust metric changes the story

Before this sprint, the headline metric was raw model accuracy (~63%). The verified-ledger metric is qualitatively different and better suited to the recruiter narrative:

- **It is workflow-level**, not model-level. It says what the *system* guarantees, not what the *model* gets right.
- **It is defensible.** "100% of finalized rows backed by a defensible authority" is true by construction — the workflow refuses to count anything else as finalized.
- **It survives model regressions.** If Anthropic returns a worse model tomorrow, the trust metric is still 100% because the workflow still refuses to auto-finalize without a defensible authority. The model just routes more work to review.
- **It is recruiter-legible.** A non-engineer reads "100% verified" and gets the value in three seconds.
- **It does not lie.** The eval page keeps the 63% number visible, and the trust metric explicitly is *not* about model accuracy.

The hero of every public surface must lead with the trust metric, not raw model accuracy.

## 4. Homepage changes needed

- Hero rebuild around the verified-ledger value statement.
- New trust-boundary card in the hero.
- Reusable visual `TrustPipeline` component.
- 30-second Loom walkthrough section (or premium placeholder if no URL yet).
- Compact "About Michael" strip pointing to `/about`.
- Footer + nav cleanup (Demo, Technical Story, Evals, App, About).
- Favicon + Open Graph metadata fix.

## 5. Guided demo changes needed

- Step 6 (final ledger) gets a bigger trust panel and a verification-status card.
- Outcome copy: "Every finalized row in this demo ledger is verified before export" when rate is 100%; "Finish review to reach a fully verified demo ledger" when not.
- A note that explicitly says "LedgerLens does not claim the model is perfect. It verifies what becomes final."

## 6. About / Hire Me requirements

- New `/about` route.
- Michael's name, role targets, background bullets.
- GitHub + LinkedIn only. No email, phone, or resume link.
- Connect background to LedgerLens.
- Compact About strip on the homepage too, linking to `/about`.

## 7. Technical story requirements

- New `/technical-story` route.
- Six sections: product problem, system architecture (uses `TrustPipeline`), why-not-an-LLM-wrapper bullets, stack list, trust model, what this demonstrates.
- Lives at the URL recruiters share, not buried in docs.

## 8. Loom walkthrough integration plan

- `VideoDemo` component takes a Loom embed URL from `NEXT_PUBLIC_LOOM_URL` (or a config constant).
- If empty, render a premium placeholder with a mini storyboard list.
- Build never fails because the URL is missing.
- A `docs/LOOM_WALKTHROUGH_SCRIPT.md` ships in this PR so Michael can record on his own time.

## 9. Empty-state improvements

- `/app` empty state already has a "Start here" card, but it should explicitly say "guided bookkeeping cleanup demo" and offer three actions (demo, import, technical story).
- `/ledger` empty / partial states get framed copy.
- `/demo` step 6 reads the trust rate and emits an explicit conclusion line.

## 10. Acceptance criteria

- A small-business owner can articulate the value in one sentence within 10 seconds of landing on `/`.
- A recruiter sees: trust card, layered pipeline, 30-second video (or polished placeholder), engineering story link, about page, GitHub + LinkedIn. No email / phone / resume link.
- The raw 63% accuracy is gone from `/` but still honestly visible on `/evals`.
- Ledger CSV export carries a clear warning when verification is incomplete.
- `/app` empty state directs first-time visitors into the guided demo.
- Favicon 404 is gone; Open Graph preview is set.
- All 134 backend tests still pass. Frontend tests still pass; `next build` clean. Demo mode stays at $0 paid spend.
