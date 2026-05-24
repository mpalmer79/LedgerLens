# Sample business scenario — Granite State Auto Repair

## 1. Scenario overview

**Granite State Auto Repair** is the fictional independent auto repair
shop LedgerLens uses to demonstrate a realistic monthly bookkeeping
cleanup. The scenario covers **March 2026 bank activity** and ends with
a verified accountant handoff package the owner sends to their CPA.

The business is not real. It does not exist in any state's business
registry. It is not a customer, not a former CDK Global account, not
Michael Palmer's family business, and not anyone else's business. Every
surface that names it carries a "Sample / fictional scenario" badge.

## 2. Why an auto repair shop

Three reasons it makes the LedgerLens story land:

1. **Recognizable vendor mix.** NAPA, AutoZone, O'Reilly, Advance Auto,
   LKQ, Mitchell1, ADP Payroll, Eversource, garage liability insurance —
   any reader who has been near a small repair business pattern-matches
   instantly. The data reads as a real business, not a test fixture.
2. **Honest ambiguity.** Home Depot / Lowe's purchases (shop supplies
   vs personal repair?), Costco trips (waiting-room snacks vs personal
   Costco?), an OWNER TRANSFER row that's clearly a judgement call —
   these mirror the actual uncertain rows a real monthly cleanup
   surfaces. They are *not* contrived edge cases.
3. **Strong correction-memory opportunity.** NAPA, AutoZone, ADP, and
   Stripe Deposit Payout all repeat across the month, so a reviewer
   who corrects one row sees the next one categorize from memory at
   zero model cost.

## 3. Transaction mix

42 transactions spanning March 1–31, 2026, all amounts fictional.

| Bucket | Count | Example merchants |
|---|---:|---|
| Parts & inventory | 8 | NAPA Auto Parts, AutoZone Commercial, O'Reilly, Advance Auto Parts, LKQ Corporation, Granite State Tire Distributor |
| Utilities & operations | 5 | Eversource (NH electric), Comcast Business, Waste Management, NH Property Management (rent), Manchester Water Works |
| Payroll & benefits | 4 | ADP Payroll bi-weekly (×2), ADP Payroll Tax, Concord Group Health Insurance |
| Software / subscriptions | 4 | QuickBooks Online Plus, Mitchell1 ProDemand, Google Workspace Business, Stripe Processing Fee |
| Vehicle / fuel | 3 | Shell, Irving Oil, Mobil Mart |
| Insurance / finance | 3 | Hanover garage liability, TD Bank business loan, First Citizens merchant services |
| Ambiguous — needs review | 9 | ACH TRANSFER VENDOR REF, CHECK #1042, Amazon Marketplace, Costco Wholesale, Venmo Payment, OWNER TRANSFER, ATM Withdrawal, Home Depot, Lowe's |
| Revenue & deposits | 6 | Stripe deposit payouts (×2), Square deposit, customer check deposits (×2), cash deposit |
| **Total** | **42** | |

Amount distribution:
- Small subscriptions: $18 – $169
- Parts: $149 – $1,845
- Payroll: $7,842 – $8,121 per bi-weekly run + $1,674 tax withdrawal
- Rent: $3,850
- Insurance: $985 – $1,324
- Revenue deposits: $845 – $4,284 (positive)

## 4. Owner-question examples

The plain-English `/questions` workflow projects each uncertain row into
a multiple-choice prompt. Templates introduced (or extended) for this
scenario:

| Trigger | Question |
|---|---|
| NAPA / AutoZone / O'Reilly / Advance Auto / LKQ / tire dist | "What were these parts for?" → Shop inventory · Customer job · Tools / equipment · Personal · Needs accountant review |
| Home Depot / Lowe's | "What was this purchase mainly for?" → Shop supplies · Equipment · Building repair · Personal / non-business · Needs accountant review |
| OWNER TRANSFER · VENMO · ATM WITHDRAWAL | "What was this transfer?" → Owner draw · Owner contribution · Reimbursement · Personal · Needs accountant review |
| Customer check deposit · Cash deposit · Stripe / Square deposit | "Is this a customer deposit or other revenue?" → Customer payment · Service revenue · Refund · Personal deposit · Needs accountant review |
| ACH TRANSFER · Wire transfer · Check # | (existing) "What was this transfer for?" |
| Amazon / Costco / Walmart / Target | (existing) "What was this purchase mainly for?" |
| Shell / Irving / Mobil / Exxon | (existing) "Was this vehicle expense business-related?" |
| Comcast / Mitchell1 / QuickBooks / subscriptions | (existing) "Is this a business software or service subscription?" |

## 5. Handoff package example

See [`docs/examples/granite-state-auto-repair-handoff.md`](examples/granite-state-auto-repair-handoff.md)
for a representative full handoff package after the owner has answered
every question.

Headline numbers from that example (illustrative):

- 42 transactions imported
- 28 verified finalized rows
- 10 owner questions answered
- 4 accountant follow-up items
- 5 corrections learned
- ~32 minutes estimated owner time saved (conservative; see methodology)

## 6. Honesty / disclaimer

- The scenario is fictional. No real customer or private business data
  is implied.
- No real account numbers, real check numbers, real policy numbers, or
  real ABA / merchant IDs are used. All identifiers are obvious
  placeholders (`INV 88421`, `PO 33812`, `CHECK #1042`, `POL 49KF`).
- The OWNER TRANSFER and VENMO rows use generic first-name placeholders
  only.
- No real address, phone, or email is exposed anywhere.
- Trust metric language is preserved: workflow-level verification, not
  raw model accuracy.
- The `/handoff` page and the markdown export both include the
  disclaimer "This handoff package is not tax advice and is not a
  substitute for accounting review."
- The handoff markdown also includes the demo disclaimer: "Fictional
  sample scenario. Not a real business, not tax advice, and not a
  substitute for accounting review."

## 7. How to run the scenario locally

```bash
# Backend, port 8000
cd backend
uvicorn ledgerlens.main:app --reload

# Frontend, port 3000
cd frontend
npm run dev

# In a separate shell, seed the scenario
curl -X POST http://localhost:8000/demo/seed
```

The `/demo/seed` endpoint is guarded to `CATEGORIZER_MODE=demo_stub` so
production environments wired up with a real Anthropic key won't have
a /demo button waiting to wipe their data.

Then visit:

- `http://localhost:3000/demo` — scenario card + guided walkthrough
- `http://localhost:3000/cleanup` — six-step monthly cleanup checklist
- `http://localhost:3000/questions` — answer owner questions
- `http://localhost:3000/handoff` — accountant handoff package
- `http://localhost:8000/handoff/export.md` — markdown download

To start over: `curl -X POST http://localhost:8000/demo/reset`.

## 8. What remains synthetic

- **No real business identity** — Granite State Auto Repair is not a
  real business. The plausibility of the data is intentional, the
  business itself is not.
- **No per-tenant chart of accounts** — the scenario uses the single
  shared chart of accounts seeded in `ledgerlens.seed.DEFAULT_COA`. A
  real auto repair shop would likely have additional accounts (parts
  WIP, customer cores, warranty work) — those are not modelled.
- **No per-business categorization rules** — the deterministic rule
  layer is global. NAPA, AutoZone, O'Reilly, and ADP currently route
  to review by default; the scenario relies on correction memory to
  learn them on first use.
- **No multi-month story** — March 2026 is the only month included.
  February or April would be a separate seed.
- **No real bank statement** — the dataset is a curated mix, not a
  scraped real-world statement.

## 9. Future improvements

- Add a second scenario (e.g. independent coffee shop or freelance
  consultant) so users can compare cleanups across business types.
- Generate per-tenant categorization rules from accumulated correction
  memory so the rules-only and hybrid eval modes can be benchmarked
  against an industry-specific rule layer.
- Add a `/handoff?demo=1` preview that renders the handoff without
  requiring `/demo/seed` to be called first — useful for cold visitors
  who want to see the deliverable before committing to the workflow.
- Add a free-text owner-note field on `/questions` so owners can attach
  context the multiple-choice answers can't capture.
- Export to QuickBooks-friendly CSV (IIF) so the handoff package plugs
  directly into a real accountant's QuickBooks setup.
