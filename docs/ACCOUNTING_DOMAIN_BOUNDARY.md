# Accounting domain boundary

What LedgerLens is and is not, in accounting-domain terms.
Written so an accountant (or a buyer who's asking one) can read it
and know exactly where the boundary sits.

## 1. What LedgerLens does

- **Transaction cleanup.** Imports messy bank-statement-style
  transactions (CSV today; eventually CSV mapping wizard).
- **Category suggestion.** Layered pipeline: correction memory →
  deterministic rules → optional model fallback.
- **Deterministic rules with per-business COA mapping.** A rule
  matches a merchant / description pattern, declares an intent
  (e.g. `parts_inventory`), and the active business's intent map
  resolves the intent to a chart-of-accounts code.
- **Correction memory.** Human corrections become reusable
  `(merchant, description) → category` rules.
- **Confidence-aware routing.** High-confidence rule matches
  auto-approve; mid-confidence routes to a human review queue;
  low-confidence stays unresolved.
- **Plain-English owner questions.** `/questions` projects the
  review queue as multiple-choice prompts owners can answer
  without learning accounting jargon.
- **Owner Answers v2.** Structured persistence: question key,
  owner answer label, optional free-text note, accountant
  follow-up flag.
- **Accountant handoff package.** Markdown summary + CSV export
  with verified/unverified rows, owner answers, unresolved items,
  and the correction memory accrued this month.
- **Workflow-level trust metric.** "100% verified finalized demo
  rows" — procedural, not substantive.

## 2. What LedgerLens does NOT do

- **Double-entry bookkeeping.** Each transaction has one
  `category_code`. No offsetting account. No debit/credit pair.
  No trial balance.
- **Accrual accounting.** Every transaction is treated as it
  appears on the bank feed (cash basis). No deferred revenue,
  no accrued expense.
- **Sales tax handling.** A transaction with embedded tax is one
  row with one amount; no tax / net split.
- **Bank reconciliation.** No statement-vs-ledger matching, no
  cleared / uncleared status.
- **Split transactions.** A $500 Costco run that's 50% office
  supplies and 50% meals can't be split across two categories.
- **Multi-currency normalization.** The `currency` column is a
  string; no FX rate lookup, no functional-currency conversion.
- **Inter-account transfers.** Owner moving money from checking to
  savings shows up as both an inflow and an outflow.
- **Depreciation.** No fixed-asset schedule.
- **Tax filing.** No 1099 / W-2 / Schedule C / Form 1120
  preparation.
- **CPA certification.** The "verified" label is procedural.
- **Audit-trail-as-compliance-audit.** `AuditEvent` is an internal
  state-change log, useful for explaining what happened. It is
  **not** a SOC2 / financial-audit compliance trail.
- **Bank-feed integration.** No Plaid / Yodlee / MX connection.

## 3. Why "categorized transaction export" is different from a ledger

A real accounting ledger contains **structured debit/credit
entries** that obey the accounting equation `Assets = Liabilities
+ Equity`. Every transaction posts to at least two accounts (one
debit, one credit), the sum of debits equals the sum of credits,
and the ledger can be trial-balanced.

LedgerLens currently produces a **reviewed categorization** + an
**accountant handoff package**:

- Each bank transaction gets one suggested category code from the
  business's chart of accounts.
- The verification metadata records which authority signed off
  (rule auto-approval, correction-memory replay, or human
  review).
- The output is a single CSV column for category, not a paired
  debit/credit posting.

For a real accounting ledger, an accountant takes the LedgerLens
output and books the offsetting entries in their accounting
system (QuickBooks, Xero, Sage, etc.). LedgerLens is a step
before the ledger, not a replacement for it.

This is **intentional**. Building a double-entry engine is a
significant engineering project that LedgerLens deliberately
defers in favor of doing the cleanup-and-handoff loop well.

## 4. What "verified" means

> Verification is procedural: a defensible authority signed off on
> each finalized row before handoff. Defensible authorities are
> (a) a deterministic rule auto-approval above the confidence
> threshold, (b) a correction-memory replay that traces back to a
> human correction on a previous matching row, or (c) an explicit
> human review on `/review` or `/questions`.
>
> "Verified" is a **workflow trust boundary**. It is **not** a
> guarantee of accounting or tax correctness, **not** a substitute
> for CPA review, and **not** a tax filing claim.

This is the same definition used by `docs/TRUST_METRIC.md` and the
TrustPanel UI component. The wording above is the canonical
long-form; shorter surfaces use "procedurally verified" or
"workflow trust boundary" with a link to this doc.

## 5. What would be required for production accounting correctness

In rough order of effort:

1. **Double-entry data model.** Every transaction posts to at
   least two accounts. `JournalEntry` table with N `JournalLine`
   rows; `sum(debit) == sum(credit)` enforced as an invariant.
2. **Account-mapping wizard.** UI to map bank-feed categories to
   the business's chart of accounts, with offsetting account
   suggestion.
3. **Bank reconciliation.** Statement-vs-ledger matching with
   cleared / uncleared status. Reconciliation report.
4. **Split transactions.** A single bank row can produce N
   `JournalLine` rows.
5. **Sales tax handling.** Tax-inclusive amounts split into base +
   tax components; tax-payable account; jurisdiction-aware tax
   rates.
6. **Multi-currency normalization.** Functional-currency
   conversion with daily FX rate lookups.
7. **Inter-account transfers.** Owner moving money between own
   accounts is a single accounting event with debit and credit on
   two cash accounts, not two separate transactions.
8. **Review workflows for accountant.** Accountant inside
   LedgerLens with a different role; sign-off workflow; comment
   threads on individual entries.
9. **Audit retention + compliance trail.** Per-tenant retention
   policies, immutable journal, sign-off chain for SOC2 /
   financial-audit-grade evidence.
10. **Export formats.** IIF / QBO XML / Xero CSV / Sage CSV;
    eventually direct integration.
11. **Tax / accounting policy controls.** Accrual vs cash policy,
    depreciation method, inventory valuation method, all
    per-tenant configurable.
12. **CPA review workflow.** Per-tenant CPA assignment, review
    sign-off, professional liability framing.

None of this is in scope for the portfolio demo. All of it would
need real accounting domain review before shipping.

## Acceptance criteria

- Domain boundary is unambiguous.
- A buyer who asks an accountant "is this real accounting
  software?" can be shown this doc and get a clear "no, but here's
  exactly what it is."
- The trust metric remains intact, with its procedural meaning
  clearly defined.
- Future contributors won't reintroduce "verified ledger" language
  without realizing the cost.
