# Multi-business mapped-rule evals

Reference for the per-business mapping coverage that ships in PR #43.
Last sprint added the eval-harness wiring; this sprint adds the
remaining two business maps (coffee-shop, design-agency), the
`block_fallback_intents` safety mechanism, per-business metrics
aggregation, and the rule-gap analysis derived from the honest
numbers.

## 1. Why multi-business mapped evals matter

The mapping layer is supposed to decouple the rule layer's intent
detection from the COA labelling that varies per business. Until
this sprint, only one of the three eval businesses (auto-repair)
had a curated map. Coffee-shop and design-agency mapped runs fell
through to the seed-COA map and produced identical numbers to the
generic baseline — so the entire mapped-rule story was anchored on
one dataset.

With coffee-shop and design-agency maps in place, the three eval
businesses now exercise three distinctly different patterns:

- **auto-repair** — inventory-heavy auto shop. Few SaaS hits. Tests
  COGS-vs-inventory routing.
- **coffee-shop** — inventory + COGS + multiple revenue accounts.
  Tests merchant-fee + payroll + meals_entertainment override
  safety.
- **design-agency** — pure-service. Software-dense COA with five
  subaccounts. Tests intent granularity (or rather, exposes that
  the bundled rules don't have enough of it).

## 2. Eval businesses

| Dataset id | Business name | Transactions | Adversarial |
|---|---|---:|---:|
| `auto-repair` | Granite State Auto Service | 100 | 10 |
| `coffee-shop` | Lighthouse Roasters | 102 | 10 |
| `design-agency` | Northwind Design Co. | 100 | 11 |

All three are synthetic, labeled by `claude-code-session-04` pending
human review. Adversarial rows are intentionally ambiguous
(prepaid-software policy ambiguity, shop-supplies-vs-COGS judgement
calls, design-agency's "is this a meal or staff training" cases).

## 3. COA mapping approach

Three principles:

1. **Use real COA codes.** Each map's entries reference the actual
   eval dataset's chart-of-accounts file. No invented codes.
2. **Unmapped is safer than wrong.** When an intent has no
   defensible mapping for a business, leave it unmapped. The
   resolver will either fall back to the rule's own code (if that
   code happens to be valid on the COA) or route to review.
3. **`block_fallback_intents` for known collisions.** When the
   rule's seed-COA default code *exists* on the dataset COA but
   means something different, list the intent in
   `block_fallback_intents`. The categorizer then refuses the
   fallback and routes to review — a row is never silently
   miscategorized just because two COAs reuse the same number.

## 4. Coffee-shop map details

`COFFEE_SHOP_EVAL_INTENT_MAP` in
`backend/src/ledgerlens/data/business_rule_maps.py`.

Safe overrides (highlights):

| Intent | Code | Why |
|---|---|---|
| `software_subscription` | 6170 | Seed default 6070 collides with "Payroll Service Fees" on this COA. |
| `office_supplies` | 6120 | Seed default 6060 collides with "Payroll Taxes." |
| `fuel_vehicle` | 6210 (Vehicle & Delivery) | Seed default 6130 collides with "Cleaning & Sanitation." |
| `merchant_fees` | 6100 | Same code as seed; safe. |
| `supplies_general` | 6130 (Cleaning & Sanitation) | Coffee shop's primary supplies category. |
| `payroll` | 6040 (Wages - Baristas) | |
| `customer_revenue` | 4010 (Retail Beverages) | |

Block-fallback intents: `meals_entertainment` (seed default 6120 =
Office Supplies here — Starbucks/Dunkin must not silently classify
as Office Supplies), `travel` (seed default 6110 = Bank Service
Charges here).

## 5. Design-agency map details

`DESIGN_AGENCY_EVAL_INTENT_MAP` in
`backend/src/ledgerlens/data/business_rule_maps.py`.

Safe overrides (highlights):

| Intent | Code | Why |
|---|---|---|
| `software_subscription` | 6140 (Software - Other & AI Tools) | Seed default 6070 = Merchant Fees here. **Catch-all bucket** — design-agency actually has 5 software subaccounts (6100–6140). |
| `office_supplies` | 6150 | Seed default 6060 = Health Insurance here. |
| `meals_entertainment` | 6220 | Design-agency HAS a real Meals account. |
| `travel` | 6210 (Conferences & Travel) | |
| `merchant_fees` | 6070 | Same concept; numerically different from seed. |
| `payroll_taxes` | 6030 (Self-Employment Tax Set-Aside) | Sole-prop design agency, no employer FICA. |

Block-fallback intents: `payroll` (no wages account for a sole
prop), `utilities`, `fuel_vehicle`, `vehicle_maintenance`,
`repairs_maintenance`, `supplies_general`, `waste_services`. All
would silently collide with unrelated codes on the design-agency
COA.

## 6. Auto-repair map details

`AUTO_REPAIR_EVAL_INTENT_MAP` (shipped in PR #42). Unchanged in
this sprint. Highlights:

- `parts_inventory` → 1050 (Inventory - Parts (Resale))
- `vehicle_maintenance` → 6140 (Repairs & Maintenance)
- `internet_telecom` → 6250 (seed's 6150 is Small Tools here)
- `loan_payment` → 8010 (Interest Expense)

No block_fallback_intents on auto-repair today — its COA happens
to share number ranges closer to the seed than the other two.

## 7. Result summary

From the fresh `2026-05-24-comparison.md` artifact:

| Mode | Overall | Adversarial | Mapping outcomes |
|---|---:|---:|---|
| `claude-haiku-v1` | 62.9% | 41.9% | — |
| `rule-categorizer-mapped-v1` | **2.3%** | **6.5%** | mapped 72 · fallback 0 · review 0 |
| `rule-categorizer-v1` | 0.0% | 0.0% | — |
| `stub-v1` | 9.3% | 0.0% | — |

**Auto-approve accuracy went from 0.0% (generic) to 22.2% (mapped)**
— the only quality signal the rule layer has on this dataset.

Per-business breakdown (mapped run):

| Business | Mapped | Correct (mapped) | Accuracy of mapped |
|---|---:|---:|---:|
| auto-repair | 5 | 2 | 40% |
| coffee-shop | 28 | 5 | 17.9% |
| design-agency | 39 | 0 | 0.0% |

## 8. What improved

- **Coverage now includes all three businesses.** Last sprint's
  mapped run reported counts only against auto-repair.
- **Auto-approve accuracy** on rules-only-mapped lifted from 0% →
  22.2% across the v0 dataset.
- **Honest abstention.** Block-fallback intents (cleanly listed
  in each map) prevent the silent miscategorization the generic
  baseline produced when COA numbers happened to overlap.
- **Per-business signal in the artifact.** The mapped run's JSON
  now carries `metrics.overall.mapping.per_business[business_id]`
  with full breakdown counts + `summary.best_business_id` +
  `summary.weakest_business_id`.
- **Adversarial accuracy** moved from 0% (generic) → 6.5% (mapped)
  on rules-only. The lift isn't huge but it's a real signal that
  some adversarial rows are intent-correct after mapping.

## 9. What stayed weak

- **Design-agency mapped accuracy is 0% on mapped rows.** All 39
  software_subscription matches land in 6140 (Other & AI Tools)
  — the dataset labels them across 5 different software
  subaccounts. The rules need finer intents
  (`software_design`, `software_hosting`, `software_project_mgmt`,
  `software_communication`) — see `docs/RULE_GAP_ANALYSIS.md`.
- **Coffee-shop's merchant_fees gets ~22 rows wrong.** The
  dataset's labelling rule for "Stripe payout fee" vs "Bank service
  charge" needs clarification.
- **Coverage ceiling on auto-repair is low.** Only 5 of 100
  transactions match a bundled rule. The bundled rule set lacks
  parts-vendor rules (NAPA, AutoZone, O'Reilly, Advance Auto, LKQ).
- **Overall rules-only-mapped accuracy is still 2.3%.** Mapping
  is a structural fix, not a coverage fix. The next sprint's
  rule-batch work (`docs/RULE_GAP_ANALYSIS.md`) is the path to
  meaningful overall accuracy.

## 10. Rule-gap analysis summary

See `docs/RULE_GAP_ANALYSIS.md` for the full version. Highlights:

- **Highest-value rule batch:** parts-vendor rules for the
  auto-shop dataset. 5 rules. Will lift auto-repair coverage from
  5% to ~20%.
- **Highest-value intent split:** break
  `software_subscription` into 4 sub-intents to give the
  design-agency map enough granularity to land its 5 software
  subaccounts. Will lift design-agency
  accuracy-when-mapped from 0% to ~50%.
- **Payroll services:** ADP, Gusto, OnPay rules at high
  confidence. Affects all three businesses.
- **Utilities split:** separate electric vs gas/water intents.

## 11. How to run locally

```bash
# Generic baseline (no mapping). Free.
python -m ledgerlens.evals.run --categorizer rules-only

# Mapped variant — uses per-dataset business maps. Free.
python -m ledgerlens.evals.run --categorizer rules-only-mapped

# Aggregate the latest run per mode into a side-by-side report.
python -m ledgerlens.evals.compare --runs-dir ./evals/runs
```

The mapped run JSON now carries `metrics.overall.mapping.per_business`
keyed by dataset business id (`auto-repair`, `coffee-shop`,
`design-agency`). Each entry has the full mapping block plus
`top_unmapped_intents`. The `summary` field names the best /
weakest business by `correct_when_mapped`.

## 12. Limitations and future work

- **Hand-curated maps.** Future work: auto-derive from accumulated
  correction memory.
- **Catch-all software bucket on design-agency.** Needs finer
  intents on the rules.
- **No mapped hybrid run committed.** The `hybrid-rules-model-mapped`
  mode is implemented + tested but its committed eval requires
  Anthropic credit. Documented as a manual step.
- **Coverage gaps.** Mapping ≠ more rules. The rule layer still
  matches a fraction of each dataset; the rule-gap analysis lists
  the highest-value rule batches.
- **`block_fallback_intents` is asymmetric** between eval and
  production. The production Granite State map doesn't use it
  (the demo runs against the default seed COA, no collisions).
  This is documented; if the production rules ever target a
  different COA the production map should adopt the same
  block-list discipline.
