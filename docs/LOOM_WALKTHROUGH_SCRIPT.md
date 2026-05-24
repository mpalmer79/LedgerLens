# LedgerLens — 30-second Loom walkthrough script

Total run-time: **30 seconds**. Record in one take. Conversational, not breathless. Capture the browser at 1080p; mouse-over the trust panel deliberately so it lands in the recording.

The story ends at the **accountant handoff package**, matching the homepage hero and the generated walkthrough animation (`docs/GENERATED_WALKTHROUGH.md`).

## Recording setup

- Open `https://ledgerlens.up.railway.app/cleanup` in a clean browser window.
- Reset demo data on `/demo` first if needed so the cleanup checklist plays from a clean state.
- Have the dashboard health dot green before you start.
- Camera off; just narration + screen capture.

## Script — cleanup → handoff (primary)

| Time | Narration | On screen |
|---:|---|---|
| **0:00 – 0:05** | "This is LedgerLens — a monthly bookkeeping cleanup assistant for small businesses. Start with messy bank activity from this month." | Land on `/cleanup` step 1; the bank-import list with cryptic merchant strings is visible. |
| **0:05 – 0:10** | "Obvious vendors — Comcast, QuickBooks, payroll, fuel, Stripe fees — are handled first by deterministic rules and correction memory, before any AI fallback." | Move through `/cleanup` step 2; hover the auto-classified rows. |
| **0:10 – 0:15** | "Uncertain rows become plain-English questions for the owner. The AI doesn't guess what the owner already knows." | Open `/questions`. Pause on the ACH-transfer question card. |
| **0:15 – 0:21** | "Owner answers are saved as review notes for the accountant — not as forced category guesses." | Pick a choice like "Needs accountant review" or "Office supplies." Show the note attaching to the row. |
| **0:21 – 0:26** | "Verified rows stay separated from unresolved items. Finalized rows are backed by review, deterministic rules, or correction memory — workflow-level verification, not raw model accuracy." | Move to `/handoff`. Hover the **Ready for accountant** and **Needs review** columns. Trust panel visible. |
| **0:26 – 0:30** | "Export the accountant handoff package — verified ledger, owner answers, unresolved items, and learned corrections in one file. 100% verified before export." | Click **Download handoff summary** (or hover the export buttons). Cursor rests on the **100% verified** trust panel. |

## Delivery notes

- Pause for a beat between sentences. Thirty seconds feels short but you have time.
- The trust panel on `/handoff` is the money shot. Do not rush past it.
- Do **not** say "100% accurate" or "the AI is right every time" — the metric is verified-before-export, not raw model accuracy. Stick to the script's exact phrasing.
- Do **not** say "tax advice." The `/handoff` page is explicit that this is not tax advice or a substitute for accounting review.
- If the export step fails on the live deploy, finish anyway — the storyboard still tells the story.

## Publishing checklist

- Upload to Loom.
- Set the thumbnail to the trust-panel moment on `/handoff` (last 3 seconds).
- Copy the embed URL.
- Set `NEXT_PUBLIC_LOOM_URL=<url>` on the Railway frontend service.
- Redeploy. The generated animation will swap out for the live embed automatically.

## What to do if the recording is awkward

It will be. Re-record once. Two takes max — the storyboard is the same as the live `/cleanup` + `/handoff` workflow, so the worst case is "viewer walks the live workflow instead." That is acceptable.

## Option B: use the generated walkthrough

The homepage already renders a polished, code-generated walkthrough animation when `NEXT_PUBLIC_LOOM_URL` is empty — see `docs/GENERATED_WALKTHROUGH.md`. That means the launch can ship without a real Loom recording and the homepage still looks intentional, not "coming soon."

- To capture a real video from the generated walkthrough, open `/walkthrough` on the deploy. It's a clean full-screen render with no nav.
- Use Loom, OBS, QuickTime, or any screen recorder. Capture the inner card; the animation auto-loops every 30 seconds, so start recording at the first appearance of the "Monthly bookkeeping cleanup" intro scene.
- Upload, copy the embed URL, set `NEXT_PUBLIC_LOOM_URL` on the Railway frontend service, redeploy. The Loom replaces the generated animation on the next build.

You can record the live `/cleanup` + `/handoff` workflow (Option A above) **or** the generated walkthrough (Option B). Either one swaps in when the env var is set; the placeholder swaps out.

## Option C: legacy "verified ledger export" script (archived)

The earlier 30-second script ended at `/demo` step 6 and the verified ledger CSV export. It's still a valid story for engineering audiences, but the **primary** script above tells the small-business-owner story and is what the marketing surfaces now reinforce. Find it in `git log -- docs/LOOM_WALKTHROUGH_SCRIPT.md` before PR #38 if you need to reference it.
