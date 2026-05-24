# Small-business value audit

## 1. Current small-business value

LedgerLens already has the bones of a useful product:

- **Import** — CSV upload + sample CSV available.
- **Categorize** — the layered pipeline (memory → rules → fallback) takes obvious vendors off the owner's plate.
- **Review** — uncertain transactions land in `/review` for human sign-off.
- **Correct** — corrections become reusable memory for next month.
- **Verify** — the trust metric distinguishes "finalized" from "merely auto-approved."
- **Export** — `/ledger` produces a CSV with a per-row `verified` column.

For an engineering audience, that's a complete story. The recruiter-facing surface (homepage, `/about`, `/technical-story`, `/demo`) has been polished hard.

## 2. Current weaknesses (from a real owner's view)

The workflow is shaped like an *engineering* dashboard, not a *month-end task list*:

| Symptom | Why it's a problem |
|---|---|
| The dashboard is a status console (counts, tiles, "next best action" links) | A bookkeeper/owner wants a stepwise checklist: "what do I still owe this month?" — not a count of "auto-approved." |
| Review queue forces accounting jargon ("[6080] Professional Services") at the moment of correction | A real owner thinks "what was that vague ACH transfer for?", not "which COA code applies?" |
| There is no "I'm done" output — the ledger CSV is technically the deliverable, but there's no narrative wrapper around it | A handoff package — what's verified, what's still open, what corrections were learned — is what the owner actually emails the accountant. |
| Time-saved or impact framing is absent | The owner has no way to answer "what did this save me?" |
| Pipeline is labeled in machine terms (memory, rules, model fallback) | The owner cares about *outcomes* (obvious vendors classified, uncertain items flagged, corrections remembered). |

## 3. Why "AI transaction categorizer" is not enough

"AI categorizer" sells the engine; small-business owners need the *appliance*. They don't want a categorization tool, they want monthly bookkeeping done — and the safe parts done without their attention. The current product surface tells engineers "we have memory + rules + a verified-ledger metric." A bookkeeper reads the same surface and asks "OK, but where do I *start* on Monday morning?"

## 4. Better product identity

> **LedgerLens is a bookkeeping cleanup assistant** that helps small business owners review messy transactions, answer plain-English questions about uncertain items, and export a verified ledger handoff package for their accountant or internal records.

What changes:

- The product surface frames work as a **monthly cleanup** task, not a generic workflow.
- Review steps ask **plain-English questions** before showing accounting jargon.
- The end state is a **handoff package**, not a CSV.
- Saved time is **estimated and labeled honestly**, not boasted about.

## 5. Target user

- **Primary:** small-business owner doing their own books, or doing a first cleanup pass before sending to a bookkeeper/CPA. ~5–500 transactions per month. Comfortable with QuickBooks ideas but not necessarily a power user.
- **Secondary:** office manager / admin doing the same cleanup on the owner's behalf.
- **Tertiary:** bookkeeper / CPA reviewing what the owner sent.

The recruiter / engineering audience that drove the previous sprints continues to land on `/technical-story` and `/evals` — that path stays.

## 6. Real monthly cleanup workflow (what an owner actually does)

1. Download the bank's CSV for the month.
2. Eyeball it. Sigh.
3. Categorize the easy stuff (Comcast, payroll, fuel, subscriptions).
4. Stop on each weird ACH transfer / Amazon / Costco / unfamiliar vendor and ask "what was this for?"
5. Either remember the answer themselves or save it as a note for the accountant.
6. Send the categorized + annotated month to the accountant or upload to QuickBooks.
7. Forget about it until next month, then repeat — same vendors, same questions, no memory.

LedgerLens already handles 1–3 and partially 4. It does not yet do 5 (owner-context capture) or 6 (handoff). That's the gap this sprint closes.

## 7. Recommended MVP scope

- **`/cleanup`** — a stepwise checklist driven by real backend data. Six steps that map exactly to a month-end task list.
- **`/questions`** — uncertain transactions presented as plain-English questions with multiple-choice answers. Answers route back into the existing review-correct / approve / mark-uncategorizable API; the chosen plain-English answer is recorded in the existing `reviewer_note` field so the accountant can read it later.
- **`/handoff`** — a server-side report that summarises what was verified, what's still open, and what corrections were learned. Plus a `/handoff/export.md` endpoint that produces a markdown summary an owner can paste into an email.
- **`CleanupImpactSummary`** — a small component shown on `/cleanup`, `/handoff`, and the demo's final step. Reports estimated minutes saved with explicit "estimate" framing.
- **Nav + dashboard updates** so the new routes are discoverable and the empty-state dashboard points at `/cleanup` (not just `/demo`).
- **Demo final-outcome card** — "Monthly cleanup complete" with verified rate, unresolved questions count, time saved, and a CTA to `/handoff`.

## 8. What this sprint will implement

Concretely:

- **Backend:**
  - `services/handoff.py` — derive the report from existing Transaction / CategorizationResult / ReviewDecision / CorrectionMemory tables. No new tables.
  - `api/handoff.py` — `GET /handoff` (JSON) + `GET /handoff/export.md` (markdown).
  - Pydantic schemas for the handoff response (counts, verified rows, unresolved rows, owner answers, corrections learned, trust block).
  - Backend tests covering: empty-DB shape, mixed verified/unverified, owner-note pass-through, markdown export header and section presence.

- **Frontend:**
  - `/cleanup` page — six-step checklist component.
  - `/questions` page — review-queue items projected as plain-English question cards.
  - `/handoff` page — sections from the API plus impact summary plus markdown export link.
  - `<CleanupImpactSummary />` reusable component.
  - Demo step-6 "Monthly cleanup complete" outcome card with `/handoff` CTA.
  - `/app` dashboard empty state and populated state both point at the cleanup workflow.
  - `AppShell` nav adds **Cleanup** and **Handoff**.
  - Page-content contract tests for `/cleanup`, `/questions`, `/handoff`.

## 9. What should wait for later

- **Dedicated `OwnerQuestion` / `OwnerAnswer` data model.** The plain-English answer choices map to either a category correction or a reviewer note via the existing `/review-queue/{tx}/correct` and `/review-queue/{tx}/approve` endpoints. That's enough for v1. A separate table buys richer reporting but isn't a launch blocker.
- **PDF export of the handoff.** Markdown is the right move for v1 — readable in any editor, paste-able into Gmail, no PDF rendering dependency. PDF can come later if a user demands it.
- **QuickBooks-format export.** The CSV is already QBO-compatible structurally; a true QBO IIF or QBO XML export is a separate effort.
- **Multi-tenant / per-business cleanup queues.** Still single-tenant by data model.
- **Per-tenant rule generation.** Still the highest-value engineering follow-up; tracked in `docs/IMPLEMENTATION_GAP_ANALYSIS.md`.

## Acceptance criteria

- A small-business owner who lands on `/cleanup` can name in one sentence what they need to do this month.
- `/questions` never forces accounting jargon as the first step.
- `/handoff` produces a markdown summary an owner could paste into an email.
- `<CleanupImpactSummary />` labels its number as an estimate and uses conservative figures.
- The demo's last step lands at "monthly cleanup complete" with a clear CTA to the handoff.
- All existing tests stay green; new tests cover the handoff contract end-to-end.
