# Parts-vendor rule batch (Batch #1) — before / after review

## 1. What rules were added

Eight new rules in `backend/src/ledgerlens/data/category_rules.json`:

| Rule id | Pattern(s) | Intent | Confidence |
|---|---|---|---:|
| `rule.napa.parts` | `NAPA AUTO PARTS`, `NAPA AUTOPARTS`, `NAPA` | `parts_inventory` | 0.92 |
| `rule.autozone.parts` | `AUTOZONE COMMERCIAL`, `AUTOZONE` | `parts_inventory` | 0.92 |
| `rule.oreilly.parts` | `O'REILLY AUTO`, `OREILLY AUTO` (+ PARTS variants) | `parts_inventory` | 0.92 |
| `rule.advance_auto.parts` | `ADVANCE AUTO PARTS`, `ADVANCE AUTO` | `parts_inventory` | 0.92 |
| `rule.lkq.parts` | `LKQ CORPORATION`, `LKQ CORP`, `LKQ` | `parts_inventory` | 0.88 |
| `rule.carquest.parts` | `CARQUEST` | `parts_inventory` | 0.90 |
| `rule.tire_distributor.tires` | `TIRERACK`, `TIRE RACK`, `GRANITE STATE TIRE`, `SNOW TIRE BULK`, `LOCAL TIRE DISTRIBUTOR`, `TIRE BULK ORDER` | **`tires_inventory`** (new intent) | 0.88 |

Plus the supporting mapping changes:

- `AUTO_REPAIR_EVAL_INTENT_MAP` — added `tires_inventory → 1070`
- `GRANITE_STATE_INTENT_MAP` — added `tires_inventory → 5010`
- `DEFAULT_INTENT_MAP` — added `parts_inventory → 5010` + `tires_inventory → 5010`
- `COFFEE_SHOP_EVAL_INTENT_MAP` — added `parts_inventory` + `tires_inventory` to `block_fallback_intents`
- `DESIGN_AGENCY_EVAL_INTENT_MAP` — same block_fallback additions

## 2. Why they are safe deterministic candidates

Each pattern is a recognizable auto-parts retailer name with no
significant collision risk in other industries:

- **NAPA, AutoZone, O'Reilly, Advance Auto, Carquest** — large
  US auto-parts retail chains.
- **LKQ** — recycled / aftermarket parts wholesaler. Three-character
  pattern passes the rule loader's `MIN_PATTERN_LEN=3` filter.
- **Tire distributors** are deliberately a separate `tires_inventory`
  intent so the auto-repair eval COA can route them to the dedicated
  `1070 Inventory - Tires` account, not the `1050 Inventory - Parts`
  bucket.

Confidence is set at 0.88–0.92 — at or just above the 0.9
auto-approve threshold, so high-confidence matches auto-approve and
the 0.88 cases route to review. Safe choice for a portfolio demo
that values verification over coverage.

## 3. Before metrics (from PR #43's mapped run)

```
Overall accuracy:        2.32%
Non-adversarial:         1.85%
Adversarial:             6.45%
Auto-approve accuracy:   22.2%
Total mapped rows:       72
```

Per-business:

| Business | Mapped | Correct (mapped) | Acc-when-mapped |
|---|---:|---:|---:|
| auto-repair | 5 | 2 | 40.0% |
| coffee-shop | 28 | 5 | 17.9% |
| design-agency | 39 | 0 | 0.0% |

## 4. After metrics (committed in this PR)

```
Overall accuracy:        6.95%   (+4.6pp, ~3x)
Non-adversarial:         7.01%   (+5.2pp, ~3.8x)
Adversarial:             6.45%   (unchanged)
Auto-approve accuracy:   44.7%   (+22.5pp, ~2x)
Total mapped rows:       86      (+14)
```

Per-business:

| Business | Mapped | Correct (mapped) | Acc-when-mapped |
|---|---:|---:|---:|
| auto-repair | **19** | **16** | **84.2%** |
| coffee-shop | 28 | 5 | 17.9% |
| design-agency | 39 | 0 | 0.0% |

## 5. Auto-repair impact

The bullseye. Batch #1 was designed to land here.

- **Coverage** lifted from 5/100 (5%) → 19/100 (19%) — essentially
  hits the predicted "5% → ~20%" target from
  `RULE_GAP_ANALYSIS.md`.
- **Mapped-row accuracy** lifted from 40% (2 of 5) → **84%** (16 of
  19) — the new parts rules are intent-correct AND COA-correct on
  the auto-repair labels.
- **Auto-approved accuracy** on the rules-only mode lifted from
  22.2% → 44.7% across the full dataset (auto-repair is the only
  business that improved, and the lift averages across all three).
- **3 tire-distributor matches** correctly landed in 1070
  (Inventory - Tires) via the new `tires_inventory` intent —
  the eval categorizer routed them correctly out of the gate.

## 6. Coffee-shop / design-agency impact

**Unchanged**, as predicted. The new rules target merchant
patterns (NAPA, AutoZone, etc.) that don't appear in the
coffee-shop or design-agency datasets. Neither business's mapped
row count or accuracy moved. The block-fallback safety nets
prevent any future NAPA-style charge on those businesses from
being silently miscategorized.

| Business | Mapped (before) | Mapped (after) | Δ |
|---|---:|---:|---:|
| coffee-shop | 28 | 28 | 0 |
| design-agency | 39 | 39 | 0 |

## 7. Mapped intent count change

| Intent | Before mapped count | After mapped count | Δ |
|---|---:|---:|---:|
| `software_subscription` | 25 | 25 | 0 |
| `merchant_fees` | 40 | 40 | 0 |
| `office_supplies` | 6 | 6 | 0 |
| `meals_entertainment` | 1 | 1 | 0 |
| `fuel_vehicle` | 0 | 0 | 0 |
| **`parts_inventory`** (new bundle) | 0 | **11** | +11 |
| **`tires_inventory`** (new) | 0 | **3** | +3 |
| **Total** | 72 | **86** | **+14** |

## 8. Accuracy change

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Overall accuracy | 2.32% | 6.95% | **+4.6pp** |
| Non-adversarial accuracy | 1.85% | 7.01% | +5.2pp |
| Adversarial accuracy | 6.45% | 6.45% | 0 |
| Auto-approve accuracy | 22.2% | 44.7% | +22.5pp |
| `correct_when_mapped` (total) | 7 | 21 | +14 |

## 9. Coverage change

| Metric | Before | After |
|---|---:|---:|
| Rule matches across dataset | 72 | 86 |
| Auto-repair coverage | 5% | 19% |
| Coffee-shop coverage | 27% | 27% |
| Design-agency coverage | 39% | 39% |

## 10. What did not improve

- **Adversarial accuracy** stayed at 6.45%. The auto-repair
  adversarial rows (Mitchell1 prepaid policy, shop-supplies-vs-
  COGS judgement calls) aren't parts-vendor rows. Mapping parts
  doesn't help here.
- **Coffee-shop and design-agency accuracy** are unchanged —
  expected. They were not in scope for Batch #1.
- **Design-agency's 0% mapped-accuracy** problem (the 39
  software_subscription rows landing in the catch-all 6140 bucket)
  is unaddressed. It's Batch #3 territory; see §12.
- **`hybrid-rules-model` and `hybrid-rules-model-mapped`** are not
  re-run in this sprint (Anthropic credit). The hybrid mapped
  number would be higher than rules-only-mapped (model picks up
  the long tail) but the relative lift from Batch #1 would be
  similar.

## 11. Any regressions

**None.** All 202 backend tests pass (+19 from PR #43's 183). The
existing eval categorizer tests, owner-answer tests, multi-business
rule mapping tests, and demo-stub regression test all still pass.
Coffee-shop and design-agency mapped counts are unchanged — the new
rules are inert on those datasets by design.

## 12. Recommended next batch

In priority order (updated from `RULE_GAP_ANALYSIS.md` Batch
ordering after measuring Batch #1):

1. **Batch #3 — split `software_subscription` intent** into
   `software_design / software_hosting / software_project_mgmt /
   software_communication`. Add rules for Figma, Vercel, Notion,
   Linear, Asana, Slack, Zoom variants. **Design-agency mapped
   accuracy goes from 0% to ~50%.** Biggest accuracy lift
   available; no auto-repair impact.
2. **Batch #2 — payroll-service rules** (ADP, Gusto, OnPay).
   Auto-repair gets ~6 more matches; coffee-shop gets ~5 more;
   design-agency gets ~3 more.
3. **Coffee-shop merchant_fees clarification.** Coffee-shop's
   22-row fallback bucket is dataset-labelling-rule-sensitive.
   Needs a documented labelling convention before more rules can
   help.
4. **Utilities split** (electric vs gas-water). Modest auto-repair
   + coffee-shop benefit.

Batch #1 measurably proved the **eval-driven rule-improvement
loop**: identify gap → ship safe rules → re-run eval → measure
honestly → update roadmap. This sprint is the first time
LedgerLens has done that loop end-to-end with committed artifacts.
