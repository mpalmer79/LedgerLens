# Sample business scenario audit

## 1. Current demo-data weaknesses

The current `DEMO_TRANSACTIONS` list in `backend/src/ledgerlens/api/demo.py`
is 13 rows: Comcast, QuickBooks, Zoom, Staples, Shell, Stripe, Amazon
Business, NAPA, ADP, State Farm, Sysco, and one unknown ACH transfer.
The mix demonstrates the categorizer-pipeline mechanics (rule hit, memory
hit, low-confidence routing, demo-stub fallback) but it has three
shortcomings:

1. **Too small to feel like a real monthly cleanup.** A real
   small-business bank statement runs 30–80 transactions in a typical
   month. Thirteen rows reads as a unit test, not a clean-up problem.
2. **No business identity.** The rows belong to no one. A reader has no
   mental model of *whose* books these are or what the business actually
   does. "Sysco delivery" alongside "NAPA auto parts" alongside "State
   Farm" alongside "Staples" mixes restaurant, auto-shop, and generic
   office signals into a single owner, which is incoherent.
3. **Owner-question depth is shallow.** With one ACH transfer and one
   Amazon row, `/questions` shows two cards and ends. That is not the
   experience of a monthly cleanup: a real owner answers six to ten
   questions about uncertain items, repeating vendors, and personal-vs-
   business judgement calls.

The walkthrough animation, the `/demo` page, the `/cleanup` checklist,
the `/handoff` package, and the homepage example preview all now lean on
the same shared sample set. Strengthening the seed strengthens every
downstream surface at once.

## 2. Why generic transactions weaken the small-business product story

The homepage promise is concrete: *"Clean up this month's books and send
your accountant a verified handoff."* A reader who clicks "Start the
3-min guided demo" should land in something that **looks like a real
business's March bank activity** — not a developer's test fixture.

Generic transactions create three failure modes:

- **Recruiters don't see the product.** They see ten labelled tiles in
  the example preview card, scroll past, and never click `/demo`. There
  is nothing in the sample data that makes a hiring manager think
  "ahh — this is the small-business cleanup problem."
- **Small-business owners don't see themselves.** A repair-shop owner
  reading the homepage doesn't think "my books look like this." A
  realistic auto-shop scenario — with parts, payroll, rent, fuel, an
  ambiguous ACH, and a clear owner-transfer ambiguity — does.
- **The `/handoff` package looks thin.** Three "Ready for accountant"
  rows and one "Needs review" row reads as a tech demo. A realistic
  cleanup ends with twenty-some verified rows, a few accountant-flagged
  items, and a handful of new memory entries — that's what an actual
  monthly handoff looks like.

## 3. Target sample business scenario

**Granite State Auto Repair** — a fictional independent auto repair
shop in New Hampshire cleaning up its March 2026 books before sending a
verified handoff package to its accountant.

Why an auto repair shop:

- Real, recognizable vendor mix (NAPA, AutoZone, O'Reilly, Advance
  Auto, LKQ, fuel stations, garage liability insurance, payroll
  service, shop rent, software like Mitchell1) — the data instantly
  reads as a real business.
- Strong ambiguity opportunities that aren't contrived: Home Depot /
  Lowe's purchases (shop supplies vs personal repairs), Costco trips
  (waiting-room snacks vs personal Costco run), an OWNER TRANSFER row
  that's clearly a personal-vs-business judgment call, an ATM
  withdrawal that needs an answer.
- Strong correction-memory opportunities: NAPA repeats, AutoZone
  repeats, ADP payroll repeats, Stripe deposits repeat. A reviewer who
  corrects one builds memory the next time.
- New Hampshire is plausible (small market, common indie repair
  business profile), avoids any large-metro real-business overlap,
  and aligns with Michael Palmer's background without claiming a real
  business.

Why not a restaurant, a coffee shop, or a consulting firm:

- Restaurants are dominated by inventory (Sysco / US Foods / produce)
  which the current rule library doesn't have great coverage for, and
  the depreciation / COGS conversations are an accountant rabbit hole
  the demo doesn't need.
- Coffee shops would clash with the existing `rule.starbucks.meals`
  rule's "if the business is a coffee shop, deactivate this rule"
  comment — interesting edge case, but adds friction.
- Consulting firms have boring transaction lists (Slack, Notion, GitHub,
  Stripe payouts) that don't showcase ambiguity.

Auto repair gives the best mix of *concrete vendors* + *plausible
ambiguity* + *clear handoff value* — and it pattern-matches with the
"Michael's hands-on small-business intuition" career narrative without
being either too on-the-nose or too distant.

## 4. Proposed transaction mix

Target size: **42 transactions** spanning March 1–31, 2026.

| Bucket | Count | Example merchants |
|---|---:|---|
| Parts & inventory | 8 | NAPA, AutoZone Commercial, O'Reilly, Advance Auto, Granite State Tire Dist, LKQ |
| Utilities & operations | 5 | Eversource (NH electric), Comcast Business, Waste Management, NH Property Mgmt (rent), Manchester Water |
| Payroll & benefits | 4 | ADP Payroll (bi-weekly ×2), ADP Payroll Tax, Concord Group Health Insurance |
| Software / subscriptions | 4 | QuickBooks Online, Mitchell1 ProDemand, Google Workspace, Stripe processing fee |
| Vehicle / fuel | 3 | Shell, Irving Oil, Mobil Mart |
| Insurance / finance | 3 | Hanover garage liability, TD Bank business loan payment, First Citizens merchant services |
| Ambiguous — needs review | 9 | ACH TRANSFER VENDOR REF, CHECK #1042, Amazon Marketplace, Costco Wholesale, Venmo Payment, OWNER TRANSFER, ATM Withdrawal, Home Depot, Lowe's |
| Revenue & deposits | 6 | Stripe deposit payouts (×2), Square deposit, customer check deposits (×2), cash deposit |
| **Total** | **42** | |

Amount distribution:
- Small subscriptions: $12 – $299
- Parts: $75 – $2,500
- Payroll: $7K – $8K per bi-weekly
- Rent: $3,850
- Insurance: $300 – $1,500
- Revenue deposits: $845 – $4,284 (positive)

All amounts and dates are fictional. No real account numbers. No real
customer names. No real address. No phone or email.

## 5. Expected cleanup journey

When a user runs `POST /demo/seed`:

1. **Step 1 — Import.** 42 rows appear on `/cleanup` and `/transactions`.
2. **Step 2 — Categorize.** Running `/categorize/batch` produces a mix of
   `rule_categorizer` auto-approves (QuickBooks, Google Workspace, Shell,
   Mobil, Stripe fee) and `demo_stub` UNCATEGORIZABLE results that route
   to review (everything else — NAPA, ADP, Mitchell1, Eversource,
   Comcast, all parts vendors, all ambiguous rows, all deposits).
3. **Step 3 — Review uncertain items.** `/review` shows a large queue.
4. **Step 4 — Owner questions.** `/questions` projects the queue as
   plain-English questions: parts vendors get a "shop supplies vs
   inventory vs equipment" question; OWNER TRANSFER gets the
   owner-draw template; Home Depot / Lowe's get the "shop supplies vs
   personal" template; the ACH transfer gets the existing transfer
   template.
5. **Step 5 — Verify the ledger.** TrustPanel + CleanupImpactSummary
   reflect roughly 28 verified rows after the owner answers questions.
6. **Step 6 — Export the accountant handoff package.** `/handoff` shows
   "Granite State Auto Repair — March 2026 handoff package" with the
   five sections (cleanup summary / ready for accountant / needs review /
   owner answers / corrections learned) and the two download buttons.

## 6. Expected owner questions

| Trigger | Question | Plain-English choices |
|---|---|---|
| NAPA / AutoZone / O'Reilly / Advance Auto / LKQ | "What were these parts for?" | Shop inventory · Customer job · Tools / equipment · Personal · Needs accountant review |
| Home Depot / Lowe's | "What was this purchase mainly for?" | Shop supplies · Equipment · Building repair · Personal / non-business · Needs accountant review |
| OWNER TRANSFER / VENMO / ATM WITHDRAWAL | "What was this transfer?" | Owner draw · Owner contribution · Reimbursement · Personal · Needs accountant review |
| Amazon / Costco | (existing template) "What was this purchase mainly for?" | (existing choices) |
| ACH TRANSFER VENDOR REF / CHECK #1042 | (existing template) "What was this transfer for?" | (existing choices) |
| Shell / Irving / Mobil | (existing template) "Was this vehicle expense business-related?" | (existing choices) |
| Comcast / Mitchell1 / QuickBooks | (existing template) "Is this a business software or service subscription?" | (existing choices) |

The audit highlights **two new question templates** to add:
1. Parts-vendor template (NAPA et al.) — currently falls back to default.
2. Home-improvement-store template (Home Depot, Lowe's) — currently
   matches the Amazon/Costco template, which is OK but the answer set
   "Equipment / Building repair / Shop supplies" is more accurate.

## 7. Expected handoff package outcome

After running the full cleanup flow:

- **Cleanup summary:** ~42 transactions imported · ~28 verified
  finalized rows · ~10 owner questions answered · ~4 accountant
  follow-up items · ~5 corrections learned · ~85 minutes estimated
  cleanup time saved.
- **Ready for accountant:** rule auto-approvals + corrected rows
  (QuickBooks, Google Workspace, Shell, Mobil, Stripe fee, plus the
  owner-corrected parts/utilities/payroll rows).
- **Needs owner / accountant review:** the rows the owner answered with
  "Needs accountant review" or "Not sure" — usually the OWNER TRANSFER,
  CHECK #1042, and ATM WITHDRAWAL.
- **Owner answers this month:** every row where a `reviewer_note`
  starts with "Owner:" — handed to the accountant verbatim.
- **Corrections learned:** the per-vendor mappings (NAPA → Parts,
  AutoZone → Parts, ADP → Payroll, Eversource → Utilities) that will
  auto-apply on next month's cleanup.

The handoff markdown export downloads as
`handoff-granite-state-auto-repair-2026-03.md`.

## 8. Risks and honesty constraints

- **The scenario must be clearly fictional.** Every surface that names
  Granite State Auto Repair includes a "Sample / demo scenario" or
  "Fictional sample scenario" badge.
- **No real account numbers.** All check numbers, invoice numbers,
  policy numbers, and ABA / merchant IDs are obviously synthetic
  (e.g. `INV 88421`, `PO 33812`, `CHECK #1042`).
- **No real customer or employee names.** OWNER TRANSFER and VENMO
  PAYMENT use generic placeholders ("VENMO PAYMENT - JON" is a
  first-name placeholder, not a surname).
- **No real address, phone, or email.** None of these appear.
- **Trust metric language preserved.** No "100% AI accuracy" claim. The
  handoff still says workflow-level, not raw model accuracy.
- **`/handoff` keeps the "not tax advice or a substitute for accounting
  review" disclaimer.**
- **Demo-stub regression test must still pass.** `/demo/seed` does not
  trigger any code path that imports the Anthropic SDK.
- **`/demo/reset` semantics must not change.** Only `source="demo"`
  rows are deleted; non-demo data is untouched. Existing test
  `test_reset_only_deletes_demo_rows` continues to apply.

## 9. What this sprint will implement

- Replace `DEMO_TRANSACTIONS` in `backend/src/ledgerlens/api/demo.py`
  with the 42-row Granite State Auto Repair March 2026 dataset.
- Add a shared sample-scenario profile module
  (`backend/src/ledgerlens/data/sample_scenario.py`) so the
  business name, location, month, and fictional disclaimer aren't
  duplicated across docs and code.
- Expose the scenario identity through a new
  `GET /demo/scenario` endpoint (small read-only handler) so the
  frontend can render the right business name without a hardcoded
  string.
- Add two new owner-question templates (parts vendors,
  home-improvement stores) to `frontend/src/app/questions/page.tsx`.
- Add a `<SampleScenarioCard>` (or inline section) on `/demo` so the
  first thing a visitor sees on the guided-demo page names the
  fictional scenario.
- Surface "Sample data" badge + scenario context line on `/cleanup`
  and `/handoff` when demo data is loaded.
- Update the homepage example handoff preview to "Granite State Auto
  Repair — March 2026 cleanup."
- Lightly update `GeneratedWalkthrough` to use auto-repair-flavored
  vendor names (NAPA in scene 2, AMAZON MARKETPLACE in scene 4, etc.)
  and the final filename `handoff-granite-state-auto-repair-2026-03.md`.
- Create `docs/examples/granite-state-auto-repair-handoff.md` as a
  representative handoff package output.
- Create `docs/SAMPLE_BUSINESS_SCENARIO.md` (scenario reference doc).
- Create `docs/SAMPLE_SCENARIO_REVIEW.md` (sprint review).
- Update README + handoff/walkthrough story docs to mention the
  scenario.
- Add backend tests for the new seed size, scenario endpoint, and
  handoff markdown content.
- Add frontend tests for the new scenario surfaces.

## 10. What should wait for later

- **Per-business data model.** A `Business` table with name / location
  / fiscal year would let multiple scenarios coexist. Not in scope —
  this sprint keeps the single-tenant model and uses a static
  scenario identifier.
- **Multiple scenarios.** Once one scenario lands well, adding
  restaurants / coffee shops / consulting firms is straightforward.
  Out of scope here.
- **Static `/handoff?demo=1` preview without seeding.** Useful for
  cold visitors but adds a new code path. Defer.
- **A "Refresh demo scenario" button on `/cleanup`.** Existing
  `/demo/reset` + `/demo/seed` already do this; a UI shortcut is a
  nice-to-have, not required.
- **Owner-question free-text field.** Listed as a follow-up in the
  walkthrough rescript review doc — still the right next sprint, but
  out of scope here.

## Acceptance criteria

- The audit explains why realistic demo data matters.
- The scenario is clearly fictional/sample data.
- The plan supports the monthly cleanup → accountant handoff story.
- No honesty contracts are broken.
- All existing tests remain in scope.
