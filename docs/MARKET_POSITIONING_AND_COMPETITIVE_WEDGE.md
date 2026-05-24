# Market positioning and competitive wedge

## Honest framing first

LedgerLens is a **categorization handoff aid**, not a general-ledger
product, not a bookkeeping replacement, and not a regulated financial
system of record. The README, every public page on the demo, and the
handoff package itself all say this in plain English. Nothing in this
doc walks that back.

What the rest of the doc explains is why a categorization handoff aid
is a defensible product despite QuickBooks, Xero, and full-service
bookkeepers existing — and what the narrow wedge is.

## Who LedgerLens is for

The target user is a **small-business owner who already has** an
accountant or bookkeeper relationship and who hands them a pile of
end-of-month transactions to clean up. Specifically:

- Single-location service businesses (auto repair, design studios,
  trades, small retail/cafe operations).
- 50–500 transactions per month, mixed bank + card.
- One or two human reviewers at most.
- Already uses QuickBooks/Xero (or the accountant does).

These users are **not** going to pay for another general ledger.
They already pay for one. The expensive part of their month is the
back-and-forth with the bookkeeper about "what is this charge?" — the
clean-up step before reconciliation can finish.

## What the wedge is

**The wedge: own the clean-up + handoff step, not the ledger.**

Concretely, LedgerLens covers three jobs the existing tools do badly:

1. **Deterministic recall of prior decisions.** When the owner says
   "Stripe payout is revenue" once, the next Stripe payout is
   categorized the same way without anyone re-asking. The
   `CorrectionMemory` table is the entire mechanism; it's pure rule
   replay, no embeddings, no opaque ML. The accountant can read why
   a row got its category.
2. **Owner-routed questions.** Rows the model isn't sure about turn
   into a structured `/questions` flow that the owner answers in
   plain English. The answer becomes a `ReviewDecision` that lands in
   the handoff package with the owner's words attached. This is the
   single highest-friction interaction in monthly cleanup and most
   tools do it via email threads.
3. **Trust-aware handoff.** The handoff distinguishes verified
   (came through a defensible path) vs unverified (model said so but
   nobody confirmed). The accountant gets a labeled package, not a
   firehose of "AI predictions."

The combination is what most "AI bookkeeping" SaaS offerings get
wrong: they push the model's prediction into the ledger and call it
done. LedgerLens deliberately stops at the handoff because the trust
boundary is the boundary.

## What LedgerLens explicitly does NOT do

- We do not maintain a general ledger. There is no double-entry
  posting engine, no journals, no period-close, no trial balance.
- We do not replace QuickBooks/Xero. The output is a handoff package
  the operator (or accountant) imports there.
- We do not replace a bookkeeper or accountant. The whole point of
  the handoff package is to make their job take less time.
- We do not categorize "to the cent for tax." Time saved is
  estimated; trust metrics are workflow-level; nothing is presented
  as financial advice or a tax claim.
- We do not run as a multi-tenant production SaaS yet. The current
  deploy is a single-environment public demo. Authentication and
  tenant enforcement are foundation-only; see
  `docs/SECURITY_AND_PRODUCTION_READINESS.md`.

## How competitors stack up

| Competitor | Their job | Our wedge against them |
|---|---|---|
| QuickBooks Online / Xero | General ledger + reconciliation | We don't compete; we hand off to them (see `ACCOUNTING_SYSTEM_EXPORT_READINESS.md`). |
| Bench, Pilot, full-service bookkeepers | Do the books for you (human) | We make the human's clean-up step faster. We are upstream of them, not a replacement. |
| Botkeeper, Vic.ai, Docyt | "AI bookkeeper" SaaS | They post predictions into the ledger; we stop at the handoff. Owners with existing bookkeepers want the latter shape. |
| Excel / Google Sheets templates | What the owner does today | We replicate the owner's categorization decisions automatically next month. Sheets cannot. |

## Why this is defensible long enough to matter

The defensibility is in the workflow design, not the model:

- **Deterministic recall (CorrectionMemory)** is testable, explainable,
  and improves with use. A model-only competitor can't show the
  accountant the rule.
- **Owner-question flow** captures structured context (question_key,
  answer_label, suggested_resolution) the bookkeeper actually needs.
  Most competitors collect free-text notes.
- **Trust metric** is reported on every export. The handoff makes a
  distinction between "the model said so" and "a human confirmed."
  This is a positioning fact, not a slogan.

These are all small, individually-unimpressive things. The combination
is what makes the handoff package noticeably better than the status
quo when an accountant actually receives one.

## The narrow ask

If LedgerLens ever asks anyone to pay, the ask is:

> $X/month per business to turn end-of-month cleanup from a multi-hour
> email thread into a 15-minute review of a labeled handoff package.

That's the only claim the product needs to defend. Everything in the
roadmap (auth, integrations, retention work) is in service of being
able to make that claim honestly for a small set of paying operators
— not in service of becoming a general-purpose accounting platform.
