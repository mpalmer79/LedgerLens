# Deployment smoke test

A 5-minute manual QA checklist to walk before announcing a deploy
(LinkedIn launch, recruiter share, etc.). Designed for the public
Railway deploy, but works against `localhost:3000` + `localhost:8000`
with the demo-stub backend too.

## Setup

- Open the frontend URL (e.g. `https://ledgerlens.up.railway.app`) in
  a clean browser window.
- Have devtools open. Watch the Network tab for 4xx / 5xx / red
  failures as you walk the list.
- Phone QA: repeat steps 4–11 on iOS Safari at 375px after the
  desktop run.

## Checklist

| # | Step | Pass when |
|---:|---|---|
| 1 | Open the frontend root URL. | Hero loads. Headline names "verified handoff." MarketingNav is visible. No layout shift past 1s. |
| 2 | Hit `GET /health` (curl or browser tab). | Returns `200` `{"status":"ok","service":"ledgerlens-api"}`. |
| 3 | Hit `GET /ready`. | Returns `200` with `ready=true`, `database.ok=true`, `categorizer.mode="demo_stub"`, `anthropic.required_for_current_mode=false`. |
| 4 | Open `/demo`. | "Sample cleanup scenario" card names **Granite State Auto Repair · March 2026** and shows the "Fictional sample data" badge. Sample transactions list is visible. HealthDot in the top-right reads "API: ok". |
| 5 | Click **Reset demo data**. | Button shows "Resetting…" while in flight. Final state shows demo step 1 as ready to seed. |
| 6 | Click **Load sample transactions** / **Run categorization** (steps 1 and 2 of the guided demo). | Status changes to ✓ done. No console errors. |
| 7 | Open `/cleanup`. | "Sample data — Cleaning up March 2026 books for Granite State Auto Repair" badge appears. Six steps render. Counts are not stuck on em-dashes. |
| 8 | Open `/questions`. | At least one owner question is visible (NAPA / OWNER TRANSFER / ACH transfer). Multiple-choice buttons are tappable. Click one. The card disappears or refreshes; no page-level error. |
| 9 | Open `/handoff`. | H1 reads "Granite State Auto Repair — March 2026 handoff". "Sample data" badge present. TrustPanel renders. The two download buttons are visible. |
| 10 | Click **Download handoff summary (markdown)**. | A file `handoff-granite-state-auto-repair-2026-03.md` downloads. Open it: H1 names the business + month; "fictional sample scenario" sub-line present; "not tax advice" disclaimer at the bottom. |
| 11 | Click **Download full ledger CSV**. | A CSV downloads. Open it: contains a `verified` column and a `model_provider` column. |
| 12 | Open `/evals`. | "Raw model accuracy is not the product trust boundary" callout visible. Model accuracy number (≈ 63%) reads from the latest committed eval run. |
| 13 | Open `/walkthrough`. | The 30-second animation plays, ending on "Export the accountant handoff package." Final card reads "100% verified finalized demo ledger." |
| 14 | Resize browser to 375px (or open on a phone). | No horizontal scroll. MarketingNav collapses to hamburger. Hero h1 wraps cleanly. TrustPanel + handoff sections stack vertically. Owner-question answer buttons are tappable. |
| 15 | Search the page source / DOM for "100% accurate AI" or "100% AI accuracy". | Not present anywhere. |
| 16 | Confirm "Fictional sample scenario" / "Sample data" badges. | Present on `/demo`, `/cleanup`, `/handoff`, and the homepage example preview. |
| 17 | Search the rendered pages for email addresses, phone numbers, "tel:" links, or "resume.pdf". | None present. LinkedIn link is fine. |

## Failure-mode spot checks

Optional — do this once per release to confirm the reliability layer
still catches problems gracefully.

| Failure to simulate | How | Expected UI |
|---|---|---|
| Backend cold start / slow | Pause the Railway service for ~10s, then click `/cleanup`. | Loading state appears; auto-retry kicks in; page eventually loads when backend warms up. |
| Backend down completely | Stop the Railway service. Click `/cleanup`. | `ErrorState` with **"Demo backend unavailable"** title, "Try again" button, secondary "Read the technical story" link. No infinite spinner. |
| `/handoff/export.md` returns 500 | Edit the backend export route to raise temporarily. Click "Download handoff summary." | Inline red panel under the download button reads "Could not download the markdown handoff." Other parts of the page still work. |
| `/demo/seed` 503 (`CATEGORIZER_MODE=anthropic`) | Set `CATEGORIZER_MODE=anthropic` (and a fake key) and reload `/demo`. | Reset / seed buttons are disabled. Amber panel explains the demo endpoints require `demo_stub`. |
| Owner-question save fails | Stop the backend, then click an answer on `/questions`. | Inline red panel on that specific card: "Could not save this answer." Other cards remain usable. |

## What "smoke test passed" means

- All 17 steps land green.
- No red console errors in devtools.
- No horizontal scroll on 375px.
- No honesty-contract violations (no "100% AI accuracy", no real PII,
  no missing disclaimers).

If any step fails, fix or revert before announcing the deploy.
