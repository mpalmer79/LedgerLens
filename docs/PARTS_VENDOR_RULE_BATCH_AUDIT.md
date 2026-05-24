# Parts-vendor rule batch (Batch #1) — audit

## 1. Current gap from RULE_GAP_ANALYSIS.md

The mapped-rule eval committed in PR #43
(`2026-05-24-rule-categorizer-mapped-v1.json`) shows:

- `rule-categorizer-v1` (generic): **0.0%** overall accuracy.
- `rule-categorizer-mapped-v1`: **2.3%** overall, **6.5%** adversarial,
  **22.2%** auto-approve accuracy.

The per-business breakdown highlights auto-repair as the
lowest-coverage business (only **5 of 100** transactions hit a
bundled rule). `RULE_GAP_ANALYSIS.md` §10 recommends Batch #1 —
parts-vendor rules — as the highest-leverage next step:

> Batch #1 (auto-repair parts vendors): NAPA, AutoZone, O'Reilly,
> Advance Auto, LKQ. 5 rules. Will lift auto-repair coverage from
> 5% to ~20%.

## 2. Current auto-repair mapped-rule performance

From the committed mapped run:

| Metric | Value |
|---|---|
| Auto-repair transactions | 100 |
| Bundled rule matches today | 5 |
| Coverage | 5% |
| Mapped (override fired) | 5 |
| Correct when mapped | 2 |
| Accuracy-when-mapped | 40% |

The 5 matched rows on auto-repair come from the bundled software
(QuickBooks → Intuit rule), fuel (Shell rule), and merchant-fee
(Stripe rule) intents. **No bundled rule currently matches NAPA,
AutoZone, O'Reilly, Advance, LKQ, Carquest, or any tire vendor** —
those vendors all fall through the rule layer entirely and land in
either the model fallback (in hybrid mode) or `UNCATEGORIZABLE`
(in rules-only mode).

## 3. Which parts vendors are currently missed

Counted from `evals/datasets/v0/auto-repair/transactions.json`
(100 labeled rows):

| Merchant pattern | Count | Ground-truth code | Bucket |
|---|---:|---|---|
| `NAPA AUTO PARTS #4471 MANCHESTER NH` | 12 | `1050` (Inventory - Parts) | parts |
| `CARQUEST PARTS INV ####` | 1 | `1050` (Inventory - Parts) | parts |
| `TIRERACK BULK ORDER` | 2 | `1070` (Inventory - Tires) | tires |
| `SNOW TIRE BULK ORDER` | 1 | `1070` (Inventory - Tires) | tires |

The Granite State demo seed (`backend/.../api/demo.py`) carries
NAPA + AutoZone + O'Reilly + Advance Auto + LKQ + Granite State
Tire Distributor — those are the production-demo merchants. The
eval and demo datasets together exercise both auto-repair
contexts.

## 4. Which vendors are safe deterministic candidates

Defensible patterns (specific enough to avoid false positives):

| Pattern | Intent | Confidence | Rationale |
|---|---|---:|---|
| `NAPA AUTO PARTS` | `parts_inventory` | 0.92 | Auto-shop-only chain; "NAPA" + "AUTO PARTS" together is unambiguous. |
| `NAPA` | `parts_inventory` | 0.88 | Shorter token — slightly lower confidence to avoid auto-approving unusual bank descriptions. |
| `AUTOZONE COMMERCIAL` | `parts_inventory` | 0.92 | Commercial line is wholesale parts. |
| `AUTOZONE` | `parts_inventory` | 0.88 | Retail line also overwhelmingly parts. |
| `O'REILLY AUTO` / `OREILLY AUTO` | `parts_inventory` | 0.92 | The chain is exclusively automotive parts. Apostrophe variants both common. |
| `ADVANCE AUTO PARTS` | `parts_inventory` | 0.92 | Chain name is unique enough. |
| `LKQ` | `parts_inventory` | 0.88 | LKQ Corporation is a recycled-parts wholesaler. 3-char token; the rule loader's MIN_PATTERN_LEN is 3 so it passes. |
| `CARQUEST` | `parts_inventory` | 0.90 | Auto-parts chain, distinctive name. |
| `GRANITE STATE TIRE` / `TIRE DISTRIBUTOR` / `TIRERACK` / `SNOW TIRE BULK` | `tires_inventory` (new intent) | 0.88 | Tires get a separate inventory bucket on the auto-repair COA (1070). Treating them as a distinct intent keeps the mapping honest. |

## 5. Which vendors should remain review-oriented

Out-of-scope vendors that **must not** become auto-categorized at
the rule layer:

| Pattern | Why review-oriented |
|---|---|
| `WALMART AUTO` / `WALMART` | Walmart sells parts but also food, supplies, personal items. Owner-question template handles it. |
| `AUTO ZONE` (separated) | Could be misclassified; we accept the standard merchant string only. |
| `JIFFY LUBE`, `VALVOLINE INSTANT OIL`, `MIDAS`, `MEINEKE` | Service vendors (a competitor mechanic doing emergency work). Belong in `repairs_maintenance` or `vehicle_maintenance`, **not** parts inventory. Out of scope for Batch #1. |
| `AAA` | Roadside assistance / insurance. Out of scope. |
| `OREILLY` standalone token | Could match generic "OREILLY" surnames in other industries. Always require "OREILLY AUTO" anchor. |
| `AUTO` alone, `PARTS` alone | Too generic. The rule loader's `GENERIC_TOKENS` set doesn't include them but the patterns must compound them. |
| Fuel stations (`SHELL`, `MOBIL`, `EXXON`, etc.) | Already have rules with `fuel_vehicle` intent. Must not also match parts_inventory. |
| Amazon / Home Depot / Lowe's / Costco | Routed to owner questions via existing templates. Do **not** auto-categorize as parts even when the description hints at automotive use. |

## 6. Proposed rule patterns

Eight new rules total (six parts vendors + one tires-vendor batch +
one Carquest):

```jsonc
// All use match_type=merchant_contains or keyword_any with the
// patterns above. Confidence 0.88–0.92. intent set as in §4.
// explanation explicitly says "Auto-parts inventory: maps via
// business rule map (parts_inventory → COGS / Inventory - Parts
// per business COA)."
```

The `tires_inventory` intent is new — needs to be added to the
business rule maps:

- `AUTO_REPAIR_EVAL_INTENT_MAP`: `tires_inventory: "1070"`
  (Inventory - Tires (Resale))
- `GRANITE_STATE_INTENT_MAP`: `tires_inventory: "5010"` (treated as
  COGS in the demo, same as parts)
- `DEFAULT_INTENT_MAP`: leave unmapped; rule's own `category_code`
  falls back. Rule's own code will be `5010` (seed-COA Cost of
  Goods Sold) — defensible.
- `COFFEE_SHOP_EVAL_INTENT_MAP`: add `parts_inventory` and
  `tires_inventory` to **block_fallback_intents** (a coffee shop
  should never auto-categorize NAPA-style purchases as Green
  Coffee or similar).
- `DESIGN_AGENCY_EVAL_INTENT_MAP`: same — add to
  block_fallback_intents.

## 7. Expected impact

Predicted (will be measured by re-running the eval, not asserted):

| Metric | Before | Predicted After | Notes |
|---|---|---|---|
| auto-repair rule matches | 5 | ~21 | +13 NAPA + +1 Carquest + +3 tires + existing 5 (rough) |
| auto-repair mapped (override fires) | 5 | ~21 | Same — all the new rules carry mappings. |
| auto-repair correct-when-mapped | 2 | ~16 | NAPA / Carquest predictions land on 1050 in the eval COA; tires land on 1070. |
| Overall mapped-run accuracy | 2.3% | ~5–6% | Limited because the lift is auto-repair-only. |
| Adversarial accuracy | 6.5% | unchanged | None of the auto-repair adversarial rows are parts vendors. |
| Coffee-shop, design-agency | unchanged | unchanged | No new rules target those merchant patterns. |

If the actual numbers are weaker, the review doc will say so. If
they're stronger, the review doc will say so. We won't guess in
either direction post-hoc.

## 8. Honesty constraints

- **Rules do not auto-approve at >0.92 confidence.** Auto-approve
  threshold is 0.9; the new rules sit at 0.88–0.92 so most are at
  or just above the line, and the lower-confidence ones (LKQ,
  shortened patterns) route to review.
- **No catch-all "if description contains AUTO" rule.** Patterns
  must compound a recognizable vendor name with an automotive
  anchor.
- **Tires are a separate intent.** Auto-repair COA distinguishes
  parts (1050) from tires (1070); the rule layer must respect
  that distinction.
- **Coffee-shop and design-agency block-fallback the new
  intents.** A NAPA charge on a coffee shop should not be
  auto-categorized.
- **The walkthrough / sample scenario / `/handoff` disclaimers
  remain untouched.**
- **Workflow-level trust language preserved.** A rule auto-approval
  on NAPA is still "verified" only via the same trust-metric
  definition (rule auto-approval is one of the three defensible
  authorities); no new path to verification.

## 9. Acceptance criteria

- 8 new rules in `category_rules.json` (NAPA short + NAPA AUTO
  PARTS + AutoZone short + AutoZone Commercial + O'Reilly Auto +
  Advance Auto Parts + LKQ + Carquest), plus the tires-batch rule
  group.
- New `tires_inventory` intent added to all five business rule
  maps (auto-repair-eval explicit; default unmapped → fallback;
  coffee-shop + design-agency block-fallback).
- Re-run rules-only and rules-only-mapped against the v0 dataset.
- Commit fresh artifacts.
- Auto-repair mapped-row count rises from 5 → ~21.
- No regression on coffee-shop / design-agency mapped runs.
- Fuel station test (`SHELL FUEL`) still resolves to
  `fuel_vehicle`, NOT `parts_inventory`.
- Ambiguous Amazon / Home Depot / Lowe's behavior unchanged.
- 183+ backend tests pass; 159+ frontend tests pass.
- No honesty-contract violations.
