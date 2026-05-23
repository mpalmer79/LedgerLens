# LedgerLens — 30-second Loom walkthrough script

Total run-time: **30 seconds**. Record in one take. Conversational, not breathless. Capture the browser at 1080p; mouse-over the trust panel deliberately so it lands in the recording.

## Recording setup

- Open `https://ledgerlens.up.railway.app/demo` in a clean browser window.
- Click **Reset demo data** before recording so the storyboard plays from a clean state.
- Have the dashboard health dot green before you start.
- Camera off; just narration + screen capture.

## Script

| Time | Narration | On screen |
|---:|---|---|
| **0:00 – 0:05** | "This is LedgerLens, an AI-assisted bookkeeping workflow for small businesses." | Land on `/demo`, scroll to Step 1 — the messy-transactions list. |
| **0:05 – 0:10** | "Messy bank transactions come in from a CSV: payroll, subscriptions, fuel, vendors, and vague ACH transfers." | Hover over the sample list — Comcast, QuickBooks, ADP, ACH transfer. |
| **0:10 – 0:16** | "LedgerLens checks prior human corrections and deterministic rules before relying on model fallback." | Click **Load sample transactions**, then **Run categorization**. Cursor sweeps the Memory / Rule / Demo Stub grouping. |
| **0:16 – 0:22** | "Uncertain items are routed to review instead of being silently finalized." | Scroll to Step 4 — the review-queue example. Pause on the Amazon row. |
| **0:22 – 0:27** | "When a human corrects a transaction, LedgerLens remembers that decision for similar future rows." | Click **Correct the top review item**, then **Re-categorize the same transaction**. Cursor lands on the Memory badge. |
| **0:27 – 0:30** | "The output is a verified ledger export, not just an AI answer." | Scroll to Step 6, click **Load the ledger**. Cursor rests on the **100% verified** trust panel. |

## Delivery notes

- Pause for a beat between sentences. Thirty seconds feels short but you have time.
- The trust panel is the money shot. Do not rush past it.
- Do **not** say "100% accurate" or "the AI is right every time" — the metric is verified-before-export, not raw model accuracy. Stick to the script's exact phrasing.
- If the export step fails on the live deploy, finish anyway — the storyboard still tells the story.

## Publishing checklist

- Upload to Loom.
- Set the thumbnail to the trust-panel moment (last 3 seconds).
- Copy the embed URL.
- Set `NEXT_PUBLIC_LOOM_URL=<url>` on the Railway frontend service.
- Redeploy. The placeholder will swap out for the live embed automatically.

## What to do if the recording is awkward

It will be. Re-record once. Two takes max — the storyboard is the same as the live demo, so the worst case is "viewer walks the live demo instead." That is acceptable.
