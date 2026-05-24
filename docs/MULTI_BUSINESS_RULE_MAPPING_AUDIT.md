# Multi-business rule mapping audit

## 1. Current mapped-rule eval coverage

PR #42 wired the per-business rule intent mapping (PR #41's data
model) into the eval harness. Today there is **one** curated eval
map: `AUTO_REPAIR_EVAL_INTENT_MAP`, keyed to the
`evals/datasets/v0/auto-repair/` dataset's COA. Coffee-shop and
design-agency eval runs fall back to `DEFAULT_INTENT_MAP`, which
targets the *seed* COA — i.e. exactly the COA the bundled rules were
hardcoded against. The fallback is therefore a no-op for those
businesses today.

`EVAL_BUSINESS_MAP_IDS` (`backend/src/ledgerlens/categorizers/rules.py`)
maps:

```python
EVAL_BUSINESS_MAP_IDS = {
    "auto-repair": "auto_repair_eval",
    # coffee-shop, design-agency → fall through to DEFAULT_INTENT_MAP
}
```

## 2. Existing eval businesses and their COAs

Three labeled eval datasets ship today (302 total transactions,
31 adversarial). Each has its own per-business chart of accounts.
**Code numbers collide across COAs**, which is the central problem
mapping has to solve.

### `auto-repair` (Granite State Auto Service) — 100 transactions, 10 adversarial

Already covered by `AUTO_REPAIR_EVAL_INTENT_MAP`. Code highlights:

- `1050 Inventory - Parts (Resale)` (parts go to inventory first)
- `5010 COGS - Parts (Resold)` (different from seed's "Cost of
  Goods Sold")
- `6150 Small Tools (Expensed)` (seed's 6150 is "Telephone &
  Internet")

### `coffee-shop` (Lighthouse Roasters) — 102 transactions, 10 adversarial

Inventory-heavy COA with multi-level COGS:

- `1040–1080`: Inventory (Green Coffee / Roasted Coffee / Retail
  Goods / Cups, Lids & Packaging)
- `4010–4050`: Sales (Retail Beverages / Retail Food / Wholesale)
- `5010–5050`: COGS (Green / Dairy & Syrups / Cups / Food / Retail
  Goods)
- `6040 Wages - Baristas`, `6050 Wages - Owner` (seed's 6040 is
  "Payroll Taxes" — collision)
- `6060 Payroll Taxes` (seed's 6060 is "Office Supplies" — **major
  collision**, makes office_supplies fallback dangerous)
- `6070 Payroll Service Fees` (seed's 6070 is "Software
  Subscriptions" — **major collision**)
- `6100 Merchant Processing Fees` (same as seed's 6100, safe)
- `6110 Bank Service Charges` (seed's 6110 is "Travel & Lodging" —
  collision)
- `6120 Office Supplies` (seed's 6120 is "Meals & Entertainment" —
  collision, makes meals fallback dangerous)
- `6130 Cleaning & Sanitation Supplies` (seed's 6130 is "Fuel &
  Vehicle" — collision)
- `6160 Marketing & Advertising`, `6170 Software Subscriptions`,
  `6200 Telephone & Internet`, `6210 Vehicle & Delivery`,
  `6230 Training & Continuing Education`

### `design-agency` (Northwind Design Co.) — 100 transactions, 11 adversarial

Service business, no inventory, software-dense:

- `1500 Equipment - Computers`, `1200 Prepaid Software`
- `4010 Sales - Web Design`, `4020 Brand Identity`, `4030 Retainer`,
  `4040 Print Design`
- `6010 Coworking & Office Rent`
- `6020 Owner Salary - N/A` (seed's 6020 is "Utilities" —
  collision; design-agency has no utilities concept at all)
- `6030 Self-Employment Tax Set-Aside` (seed's 6030 is "Wages &
  Salaries" — **collision**)
- `6040 Contract Labor` (seed's 6040 is "Payroll Taxes" —
  collision)
- `6050 Professional Liability Insurance`, `6060 Health Insurance`
  (seed's 6060 is "Office Supplies" — **collision**, makes
  office_supplies fallback dangerous)
- `6070 Merchant Processing Fees` (seed's 6070 is "Software
  Subscriptions" — **collision**, makes software_subscription
  fallback **wrong**)
- `6100–6140`: Software (Design Tools / Hosting / Project Mgmt /
  Communication / Other & AI)
- `6120 Software - Project Management` (seed's 6120 is "Meals &
  Entertainment" — **collision**, makes meals_entertainment
  fallback dangerous)
- `6150 Office Supplies`, `6160 Computer Hardware - Expensed`
- `6170 Marketing & Advertising`, `6180 Professional Services -
  Accounting`, `6190 Professional Services - Legal`
- `6200 Professional Development`, `6210 Conferences & Travel`,
  `6220 Meals & Entertainment`, `6230 Telephone & Internet`,
  `6240 Reference Materials`
- `7010 Interest Income`

## 3. Current auto-repair mapping behavior

`AUTO_REPAIR_EVAL_INTENT_MAP` ships ~20 intent overrides. Last
sprint's `2026-05-24-comparison.{json,md}` artifact shows:

- generic `rules-only`: 0.0% overall, 0.0% auto-approve accuracy
- mapped `rules-only-mapped`: 0.7% overall, **7.4% auto-approve
  accuracy** (vs 0.0% in generic), 5 mapped + 67 fallback + 0
  routed-to-review, 2 of 5 mapped predictions correct

The mapping fired 5 times (rule had intent + mapping resolved to a
different COA code). The bulk (67) was fallback-to-default. The
small overall accuracy reflects two things: bundled rules cover
only ~24% of the 302 total rows; and most of those fallbacks land
on a code that happens to be wrong on the auto-repair COA but isn't
caught because the rule's default code "exists" on the COA
(numerically) even if it means something different.

## 4. Missing coffee-shop and design-agency coverage

Both businesses currently fall through to `DEFAULT_INTENT_MAP`,
which is identical to the seed COA. **For coffee-shop and
design-agency, this means the mapped-rule mode is identical to the
generic mode by construction.** Every "improvement" reported for
mapped-rule on these businesses is currently zero.

Worse, the existing fallback-to-default behavior is *actively
harmful* on these COAs. The Starbucks rule (intent
=meals_entertainment, default code=6120) on coffee-shop falls
through to 6120, which on the coffee-shop COA is **Office
Supplies**, not Meals & Entertainment. The Intuit rule (intent
=software_subscription, default code=6070) on design-agency falls
through to 6070, which on the design-agency COA is **Merchant
Processing Fees**, not Software Subscriptions.

The mapping layer needs:

1. Curated maps for coffee-shop + design-agency.
2. A way for a map to say *"don't auto-resolve this intent on this
   business; the rule's default code is unsafe here"* — i.e. block
   the fallback to `rule.category_code` and route to review.

## 5. Proposed intent mappings

Only including overrides that are defensible against the actual
COA. Unmapped intents on these businesses fall back to the rule's
own code; the new `block_fallback_intents` set explicitly routes
known-collision intents to review.

### Coffee-shop

Safe overrides:

| Intent | Code | Name |
|---|---|---|
| `rent` | 6010 | Rent - Storefront |
| `utilities` | 6020 | Utilities - Electric |
| `payroll` | 6040 | Wages - Baristas |
| `payroll_taxes` | 6060 | Payroll Taxes |
| `insurance` | 6090 | General Liability Insurance |
| `office_supplies` | 6120 | Office Supplies (mapped explicitly; default 6060 collides) |
| `software_subscription` | 6170 | Software Subscriptions (mapped explicitly; default 6070 collides) |
| `professional_services` | 6180 | Professional Services - Accounting |
| `marketing_advertising` | 6160 | Marketing & Advertising |
| `merchant_fees` | 6100 | Merchant Processing Fees (same code as seed; safe) |
| `fuel_vehicle` | 6210 | Vehicle & Delivery (mapped explicitly; default 6130 collides) |
| `repairs_maintenance` | 6140 | Repairs & Maintenance |
| `internet_telecom` | 6200 | Telephone & Internet |
| `training_education` | 6230 | Training & Continuing Education |
| `tools_equipment` | 6150 | Small Tools & Equipment |
| `supplies_general` | 6130 | Cleaning & Sanitation Supplies |
| `customer_revenue` | 4010 | Sales - Retail Beverages |
| `service_revenue` | 4010 | (same — no service line) |
| `owner_draw` | 3030 | Owner Distributions |
| `owner_contribution` | 3010 | Owner's Contributed Capital |
| `vehicle_maintenance` | 6140 | (same as repairs_maintenance) |
| `meals_entertainment` | — | **unmapped + block fallback** (a coffee shop shouldn't auto-classify Starbucks as Meals; route to review) |
| `travel` | — | **unmapped + block fallback** (no clean travel account; default 6110 collides with Bank Service Charges) |

Block fallback list for coffee-shop:
`meals_entertainment` (rule default 6120 = Office Supplies, wrong),
`travel` (rule default 6110 = Bank Service Charges, wrong).

### Design-agency

Safe overrides:

| Intent | Code | Name |
|---|---|---|
| `rent` | 6010 | Coworking & Office Rent |
| `payroll` | — | **unmapped + block fallback** (no Wages account — design agency is a sole proprietor) |
| `payroll_taxes` | 6030 | Self-Employment Tax Set-Aside |
| `insurance` | 6050 | Professional Liability Insurance |
| `office_supplies` | 6150 | Office Supplies (mapped explicitly; default 6060 = Health Insurance, would be wrong) |
| `software_subscription` | 6140 | Software - Other & AI Tools (mapped explicitly; default 6070 = Merchant Fees, would be wrong) |
| `professional_services` | 6180 | Professional Services - Accounting |
| `marketing_advertising` | 6170 | Marketing & Advertising |
| `merchant_fees` | 6070 | Merchant Processing Fees (different code than seed but the right concept) |
| `meals_entertainment` | 6220 | Meals & Entertainment (the design-agency COA HAS this account) |
| `travel` | 6210 | Conferences & Travel |
| `tools_equipment` | 6160 | Computer Hardware - Expensed |
| `training_education` | 6200 | Professional Development |
| `internet_telecom` | 6230 | Telephone & Internet |
| `customer_revenue` | 4010 | Sales - Web Design |
| `service_revenue` | 4030 | Sales - Retainer |
| `owner_draw` | 3030 | Owner Draws |
| `owner_contribution` | 3010 | Owner's Contributed Capital |
| `utilities` | — | **unmapped + block fallback** (no utilities account; default 6020 = Owner Salary, would be wrong) |
| `fuel_vehicle` | — | **unmapped + block fallback** (no vehicle account; default 6130 = Software - Communication, would be wrong) |
| `vehicle_maintenance` | — | **unmapped + block fallback** |
| `repairs_maintenance` | — | **unmapped + block fallback** (no facility maintenance line) |
| `supplies_general` | — | **unmapped + block fallback** |
| `waste_services` | — | **unmapped + block fallback** |

Block fallback list for design-agency:
`payroll`, `utilities`, `fuel_vehicle`, `vehicle_maintenance`,
`repairs_maintenance`, `supplies_general`, `waste_services`.

## 6. Expected limitations

- Even with curated maps, the bundled rule set only matches a
  fraction of each business's monthly activity. The rules-only
  modes will still report low overall accuracy because the rules
  cover the wrong vendors (mostly software / fees / fuel / travel).
- Inventory and COGS rows on coffee-shop and design-agency have no
  bundled rules. Mapping doesn't add rules; it only resolves the
  rules that already match.
- The rule-gap analysis will be the most valuable output of this
  sprint, not the headline accuracy delta.
- `block_fallback_intents` is a deliberate honesty mechanism — it
  trades coverage for safety. A blocked intent routes to review;
  this is *not* a wrong-prediction outcome.

## 7. Risks around overclaiming

- Coffee-shop and design-agency mapped-rule numbers will be small.
  A single mapped row going from "wrong" to "correct" can look like
  a large percentage shift. The docs must explicitly say this.
- The `rule-categorizer-mapped-v1` artifact must continue to be a
  single comparable run across all three businesses (not silently
  per-business cherry-picked).
- We must not invent new rules to inflate coverage. If a rule
  doesn't exist, that's a gap for the next sprint, not a hidden
  bandaid.
- `block_fallback` makes route-to-review counts go up on the
  mapped run vs the generic run. That's the desired behavior, not
  a regression. The docs and the `/evals` callout must say so.

## 8. What this sprint will implement

1. Extend `BusinessRuleMap` with an optional
   `block_fallback_intents: frozenset[str]` field. Default empty.
2. Eval rule categorizer + production rule categorizer both honor
   the block list — a blocked intent skips the
   `rule.category_code` fallback and returns `None` →
   `UNCATEGORIZABLE` (routed to review).
3. Add `COFFEE_SHOP_EVAL_INTENT_MAP` and
   `DESIGN_AGENCY_EVAL_INTENT_MAP` to the registry.
4. Wire them into `EVAL_BUSINESS_MAP_IDS`.
5. Extend `mapping_metrics` to compute **per-business** breakdowns,
   plus an overall aggregate including "best business" / "weakest
   business" / "top unmapped intents overall."
6. Re-run free eval modes (`rules-only`, `rules-only-mapped`) and
   `compare.py` against the v0 dataset. Commit fresh artifacts.
7. Generate `docs/RULE_GAP_ANALYSIS.md` from the mapped run output
   — top unmapped intents per business, recommended new rules,
   route-to-review candidates.
8. `/evals` "Business-specific rule mapping" section gets a
   per-business breakdown table + a small "best / weakest / biggest
   gap" summary.
9. `/rules` gains a small "Mapped-rule eval coverage now includes
   auto repair, coffee shop, and design agency" note.
10. Docs: new
    `docs/MULTI_BUSINESS_RULE_MAPPING_AUDIT.md` (this file),
    `docs/MULTI_BUSINESS_MAPPED_RULE_EVALS.md`,
    `docs/MULTI_BUSINESS_RULE_MAPPING_REVIEW.md`. Update
    `docs/MAPPED_RULE_EVALS.md` + the implementation gap doc.

## 9. What should wait for later

- **Auto-derived maps from correction memory.** Same as last
  sprint's deferred item; out of scope here.
- **New bundled rules** for the gaps the analysis will surface
  (Starbucks/coffee-shop-cleaning, Adobe-design-tools, etc.). The
  rule-gap analysis is the deliverable; building the rules is the
  next sprint.
- **A `/evals` chart** for per-business mapped/unmapped counts.
  Inline table + numbers are sufficient.
- **Multi-tenant production deploy.** The single-tenant production
  service still uses `GRANITE_STATE_INTENT_MAP`; the eval maps
  are a separate registry.
- **Frontend admin UI** for editing maps.

## Acceptance criteria

- This audit identifies all three eval business IDs and their COAs.
- It explains why coffee-shop + design-agency need curated maps.
- The scope is clear: 2 new maps + block_fallback feature +
  per-business metrics + rule-gap doc.
- Numbers will be reported honestly; small deltas will be called
  out as small.
- No claim that mapped rules solve coverage gaps. Coverage is
  rule-set work, not mapping work.
