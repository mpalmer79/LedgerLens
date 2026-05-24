# Rule-gap analysis

Derived from `evals/runs/2026-05-24-rule-categorizer-mapped-v1.json`
(the `rules-only-mapped` run against the v0 dataset). The mapping
layer is now wired across all three eval businesses, so every "rule
fires + mapping resolves" outcome is honest signal. Where the
mapped run still gets a row wrong, that's a rule-gap — either the
rule needs a finer intent, or the rule shouldn't auto-apply at all
on this business.

Goal: turn the eval numbers into a concrete engineering roadmap.

## Batch status (updated after each shipped batch)

- **Batch #1 — auto-repair parts-vendor rules: ✅ shipped (PR #44).**
  Auto-repair coverage 5% → 19%, mapped accuracy 40% → 84%,
  auto-approve accuracy 22.2% → 44.7%, overall accuracy 2.32% →
  6.95%. Coffee-shop / design-agency unchanged (expected). See
  `docs/PARTS_VENDOR_RULE_BATCH_REVIEW.md` for the full
  before/after.
- **Batch #2 — payroll-service rules:** not started.
- **Batch #3 — software intent split for design-agency:** not
  started. Promoted to next-PR recommendation (biggest accuracy
  lift available now).
- **Batch #4 — utilities split:** not started.

## 1. Top unmapped intents overall

After this sprint, the bundled rule set's intents are **fully
covered** by at least one of the three eval business maps. The
`top_unmapped_intents_overall` array is empty — every intent the
rule layer produces is either mapped or explicitly blocked (route
to review).

That's the good news. The bad news is that "mapped" doesn't mean
"correct" — see §3 below.

## 2. Top unmapped intents by business

| Business | Top unmapped intents |
|---|---|
| auto-repair | (none — every fired intent has a mapping) |
| coffee-shop | (none — every fired intent has a mapping) |
| design-agency | (none — every fired intent has a mapping) |

The block-fallback lists are working. The block-fallback intents
(coffee-shop: `meals_entertainment`, `travel`; design-agency:
`payroll`, `utilities`, `fuel_vehicle`, `vehicle_maintenance`,
`repairs_maintenance`, `supplies_general`, `waste_services`) never
auto-apply silently. Rows that hit those intents route to review.

## 3. Rule intents with poor accuracy (the real gap)

| Business | Mapped rows | Correct | Accuracy on mapped rows | Notes |
|---|---:|---:|---:|---|
| coffee-shop | 28 | 5 | 17.9% | Best of the three. Of the 23 wrong, ~22 are Stripe/Square fee rows (`merchant_fees → 6100`) that the dataset labels as either offset by the gross sale (revenue posting) or differently classified (Bank Service Charges 6110 vs Merchant Fees 6100). The rule fires correctly; the ground truth wants a different code on a subset. |
| auto-repair | 5 | 2 | 40.0% | Small sample but the cleanest deltas — the Mitchell1 software rule and the Stripe fee rule fire correctly and land the COA. The other 3 misses are ambiguous (parts purchases that should go to inventory but the rule routes to a single COGS code; rule needs finer intent for parts-in vs parts-out). |
| design-agency | 39 | 0 | 0.0% | Worst of the three. The design-agency COA has **five** software subaccounts (Design Tools / Hosting / Project Mgmt / Communication / Other & AI). My `software_subscription → 6140` mapping is the "catch-all" bucket; the dataset labels every actual rule-matched software row to one of the *specific* subaccounts. **The rule layer needs finer intents** (`software_design`, `software_hosting`, `software_communication`, `software_project_mgmt`) to give the design-agency map a chance. |

This is the most important takeaway from this sprint: **the rule
layer's accuracy ceiling on design-agency is bounded by intent
granularity, not by COA mismatch.** The mapping fixed the COA
mismatch problem. The next-most-valuable engineering work is
finer-grained intents on the rules themselves.

## 4. Businesses with low deterministic coverage

| Business | Tx | Rule matches | Coverage | Auto-approved | Auto-approve accuracy |
|---|---:|---:|---:|---:|---:|
| auto-repair | 100 | 5 | 5% | 5 | 40% (2/5) |
| coffee-shop | 102 | 28 | 27% | 27 | 18.5% (5/27) |
| design-agency | 100 | 39 | 39% | 27 | 0.0% (0/27) |

Note: auto-approved count differs from mapped count because rules
with confidence < 0.9 (e.g. the Amazon ambiguity rule) match but
route to review rather than auto-applying. That's the correct
behavior and shows up in the routing block.

Coverage rises across businesses (5% → 27% → 39%), but
**accuracy when we DO auto-apply** falls. That's the right
direction to read it: we have rules for SaaS / fees, and the
bundled rule set targets those vendors heavily. Auto-repair has
few SaaS hits (so coverage is low), coffee-shop has more, and
design-agency has the most. But design-agency also has the most
subaccount granularity, which our rules don't yet match.

## 5. Merchant patterns that appear repeatedly but lack good rules

From the prediction-level data (rules-only-mapped run), the
recurring merchant tokens that did **not** match any bundled rule:

### Auto-repair (rules don't fire)

- **NAPA AUTO PARTS, AUTOZONE, O'REILLY, ADVANCE AUTO** — these
  are the bulk of auto-shop activity. The bundled rule set has
  zero auto-parts vendor rules.
- **ADP PAYROLL** — payroll runs (~10/month). No payroll rule.
- **EVERSOURCE, MANCHESTER WATER** — utilities. No utility rules.
- **HANOVER INSURANCE, CONCORD GROUP** — insurance. No insurance
  rules.

### Coffee-shop (rules don't fire)

- **COFFEE GREEN BEAN, ROYAL CUP, BIRCH** — green coffee vendors.
  No coffee-supply rules.
- **STRAUS, OBERWEIS, ORGANIC VALLEY** — dairy vendors. No dairy
  rules.
- **HEB PARTNERS, PAPER MART** — packaging / cups vendors.
- **GUSTO, ONPAY** — payroll services (different from ADP).

### Design-agency (rules don't fire)

- **FIGMA, FRAME.IO, FRAMER** — design tools beyond Adobe.
- **VERCEL, NETLIFY, FLY.IO** — hosting providers (not
  AWS/GCP/Azure).
- **NOTION, LINEAR, BASECAMP** — project management tools beyond
  Asana.
- **FATHOM ANALYTICS, PLAUSIBLE, SIMPLEANALYTICS** —
  privacy-friendly analytics.

## 6. Recommended new rule intents

In priority order:

1. **`parts_inventory`** rules for NAPA, AutoZone Commercial,
   O'Reilly, Advance Auto, LKQ. Confidence 0.85 for the obvious
   tokens; lower for ambiguous merchants. Maps to 1050 on
   auto-repair, 6180 on default COA. **Highest-value rule batch.**
2. **`payroll_service`** rules for ADP, Gusto, OnPay. Confidence
   0.92. Maps to wages/payroll on each business.
3. **`software_design`**, **`software_hosting`**,
   **`software_project_mgmt`**, **`software_communication`**
   intents — split the existing `software_subscription` intent into
   finer buckets. Add specific rules for Figma, Vercel, Notion,
   Slack, Zoom, Linear, etc. Maps these to the right subaccount on
   design-agency (which has 5 software subaccounts).
4. **`utilities_electric`** and **`utilities_gas_water`** intents —
   split the existing `utilities` intent. Maps to 6020 vs 6030 on
   coffee-shop and the auto-repair eval COA.
5. **`insurance_workers_comp`**, **`insurance_garage_liability`**,
   **`insurance_health`** — split `insurance`. Maps to specific
   insurance subaccounts where the COA has them.
6. **`coffee_green_inventory`** rules for the bigger green coffee
   importers. Coffee shop only.
7. **`dairy_inventory`** rules for major dairy vendors. Coffee
   shop only.

## 7. Recommended new rule patterns

Concrete merchant patterns ready to add as deterministic rules:

| Pattern | Intent | Confidence | Auto-approve? |
|---|---|---:|---|
| `NAPA AUTO PARTS` | `parts_inventory` | 0.92 | yes (auto-shop) |
| `AUTOZONE COMMERCIAL` | `parts_inventory` | 0.92 | yes (auto-shop) |
| `O'REILLY AUTO` | `parts_inventory` | 0.92 | yes (auto-shop) |
| `ADVANCE AUTO PARTS` | `parts_inventory` | 0.92 | yes (auto-shop) |
| `LKQ` | `parts_inventory` | 0.88 | yes (auto-shop) |
| `ADP PAYROLL` | `payroll_service` | 0.95 | yes |
| `GUSTO` | `payroll_service` | 0.95 | yes |
| `ONPAY` | `payroll_service` | 0.93 | yes |
| `FIGMA` | `software_design` | 0.92 | design-agency only |
| `VERCEL` | `software_hosting` | 0.92 | design-agency only |
| `NETLIFY` | `software_hosting` | 0.92 | design-agency only |
| `NOTION` | `software_project_mgmt` | 0.90 | design-agency only |
| `LINEAR` | `software_project_mgmt` | 0.90 | design-agency only |
| `EVERSOURCE` | `utilities_electric` | 0.92 | yes |

## 8. Which recommendations should route to review instead of auto-categorizing

Some patterns are genuinely ambiguous and the right answer is
*route to review*, not auto-apply. Add at low confidence (< 0.6)
with the `accountant_review` intent (or leave the rule out and
let `/questions` handle it):

- **STRIPE, SQUARE** without "FEE" in the description — could be
  fee deduction OR settlement deposit (revenue). Existing rule
  handles the FEE case; the settlement-deposit side should NOT
  auto-categorize.
- **HOME DEPOT, LOWE'S** (already routed to `/questions` via the
  home-improvement-store template; don't auto-categorize at the
  rule layer).
- **AMAZON** without invoice context (already routed via the
  marketplace_purchase template).
- **OWNER TRANSFER, VENMO** (already routed via the owner_transfer
  template).

## 9. What needs ground-truth clarification

- Some coffee-shop merchant_fees rows are labelled at `6100`
  (Merchant Processing Fees) and others at `6110` (Bank Service
  Charges). The dataset's labelling rule for "is this a Stripe
  payout fee or a bank account service charge?" needs to be
  documented in the dataset README — otherwise the rule layer
  can't be expected to predict consistently.
- The design-agency software splits (Design Tools vs Hosting vs
  Communication) need a labelling-rule doc so future rules can
  match.

## 10. Next-best rule work

In priority order (revised after Batch #1 measurement):

1. **✅ Batch #1 (auto-repair parts vendors): SHIPPED in PR #44.**
   Result: auto-repair coverage 5% → 19% (close to the predicted
   ~20%), mapped accuracy 40% → 84%, overall 2.3% → 6.95%.
2. **Batch #3 (software granularity for design-agency):**
   Promoted to next priority after Batch #1 measurement. Split
   `software_subscription` into 4 sub-intents
   (`software_design / software_hosting / software_project_mgmt /
   software_communication`); add Figma, Vercel, Notion, Linear,
   Slack rules. Predicted lift: design-agency
   accuracy-when-mapped 0% → ~50%. Biggest accuracy lift
   available now.
3. **Batch #2 (payroll services):** ADP, Gusto, OnPay. 3 rules.
   Hits all three businesses; modest per-business impact but
   broad.
4. **Batch #4 (utilities split):** Eversource + generic electric
   patterns. Hits auto-repair + coffee-shop.

After Batch #1 the rules-only-mapped run sits at 6.95% overall
accuracy on the v0 dataset (vs 2.3% before). After Batches #2 +
#3 + #4, expect the rules-only-mapped run to reach 10-12% overall
accuracy. That's still low because the **fundamental coverage
ceiling** is the bundled rule set's scope; deterministic rules
will never categorize adversarial / ambiguous rows. The
route-to-review path remains the safety net.

## What this analysis does NOT recommend

- **Don't add a generic catch-all rule** like "if description
  contains DEBIT, classify as Bank Service Charges." Catch-alls
  are exactly the bug the rule layer exists to avoid.
- **Don't auto-categorize OWNER TRANSFER / VENMO / ATM
  WITHDRAWAL.** Those are owner-question territory.
- **Don't add rules with confidence > 0.85** for any vendor whose
  category genuinely depends on usage (Costco, Amazon, Home
  Depot, Lowe's). They route to `/questions`.
- **Don't add per-business rules into `category_rules.json`.**
  The intent layer is the right abstraction; rule rows should be
  business-agnostic.
