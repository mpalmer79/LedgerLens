# Multi-business rule mapping — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Business map registry | 3 maps: `DEFAULT_INTENT_MAP`, `GRANITE_STATE_INTENT_MAP`, `AUTO_REPAIR_EVAL_INTENT_MAP` | **5 maps** — same 3 + **`COFFEE_SHOP_EVAL_INTENT_MAP`** + **`DESIGN_AGENCY_EVAL_INTENT_MAP`** |
| `BusinessRuleMap` shape | `business_id` + `intent_to_code` | Same + new **`block_fallback_intents: frozenset[str]`** (default empty) + `is_fallback_blocked()` method |
| Eval rule categorizer `_resolve_code` | mapped → fallback → None | mapped → **block check** → fallback → None. Blocked intents return None (route to review) instead of silently using the rule's seed-COA default. |
| `EVAL_BUSINESS_MAP_IDS` | `{"auto-repair": "auto_repair_eval"}` | **All three** eval business IDs registered (`coffee-shop`, `design-agency` added). |
| `mapping_metrics` | Overall aggregation only. | Same + new optional **`tx_to_business`** parameter that triggers a **`per_business`** breakdown + a **`summary`** block naming best / weakest business + the overall top unmapped intents. |
| `RunMetrics.MetricsSlice.mapping` | Flat aggregation block. | Same + the optional `per_business` and `summary` keys when the harness threads through tx→business mapping (only on the `overall` slice). |
| `compare.py` framing | "Coffee-shop and design-agency still fall back to the generic intent map" | Updated to reflect that all three eval businesses now have curated maps; the COA caveat now points readers at `docs/RULE_GAP_ANALYSIS.md`. |
| Committed eval artifacts | `2026-05-23-comparison.{json,md}` + `2026-05-24-rule-categorizer-*` (PR #42). | Fresh `2026-05-24-comparison.{json,md}` + `2026-05-24-rule-categorizer-{v1,mapped-v1}.json` regenerated with all 3 eval maps active. |
| `/evals` Business-specific rule mapping section | Single-mode table + top-unmapped-intents inline note. | Same table + **new "Per-business mapped-rule breakdown"** table showing mapped / fallback / review / correct-when-mapped per business, plus a "best / biggest rule gap" summary line. Cross-links to `docs/RULE_GAP_ANALYSIS.md`. |
| `/rules` cross-link | "View rule-mapping evals →" | "View **multi-business** rule evals →" + a note that coverage now spans auto repair / coffee shop / design agency. |
| Docs | `MAPPED_RULE_EVAL_AUDIT.md`, `MAPPED_RULE_EVALS.md`, `MAPPED_RULE_EVAL_REVIEW.md`. | Same + new `MULTI_BUSINESS_RULE_MAPPING_AUDIT.md`, `MULTI_BUSINESS_MAPPED_RULE_EVALS.md`, `RULE_GAP_ANALYSIS.md`, this review. |

## 2. Why this was the right follow-up

Last sprint's `rules-only-mapped` ran with one curated map. Two of
the three businesses got zero benefit from mapping. The eval story
was "mapping helps if we have a map" — which is true but circular.
The honest answer needed two more maps and a more honest reporting
shape (per-business breakdown so any reader can see where the
mapping helped and where it didn't).

The `block_fallback_intents` mechanism is the other piece that
made this sprint necessary. Both coffee-shop and design-agency
have COAs that collide with the seed COA in dangerous ways
(e.g. coffee-shop 6120 = Office Supplies vs seed 6120 = Meals).
Without the block list, a Starbucks rule on coffee-shop would
silently classify Starbucks as Office Supplies. Adding the block
list is what makes the mapped-rule mode safely better, not just
"different."

## 3. Business maps added

- `COFFEE_SHOP_EVAL_INTENT_MAP` (`coffee_shop_eval`) — 22 intent
  overrides + 2 block-fallback intents.
- `DESIGN_AGENCY_EVAL_INTENT_MAP` (`design_agency_eval`) — 17
  intent overrides + 7 block-fallback intents.

Both calibrated to the actual eval datasets' COAs. See
`docs/MULTI_BUSINESS_MAPPED_RULE_EVALS.md` §4-§5 for the
intent-by-intent details.

## 4. Eval modes used

This sprint did **not** add new eval modes. It re-used the
`rules-only` and `rules-only-mapped` modes that shipped in PR #42.
The mapped mode now produces meaningfully different output because
of the two new business maps plus the block-fallback feature.

`hybrid-rules-model-mapped` is still implemented + tested but not
committed as an artifact (requires Anthropic credit).

## 5. Result summary

| Mode | Overall | Adversarial | Auto-approve | Mapping |
|---|---:|---:|---|---|
| `rule-categorizer-v1` (generic) | 0.0% | 0.0% | 8.9% at **0.0%** acc | — |
| `rule-categorizer-mapped-v1` | **2.3%** | **6.5%** | 8.9% at **22.2%** acc | mapped 72 · fallback 0 · review 0 |
| `claude-haiku-v1` | 62.9% | 41.9% | — | — |
| `stub-v1` | 9.3% | 0.0% | — | — |

Per-business breakdown of the mapped run:

| Business | Mapped | Correct (mapped) | Acc-when-mapped |
|---|---:|---:|---:|
| auto-repair | 5 | 2 | 40% |
| coffee-shop | 28 | 5 | 17.9% |
| design-agency | 39 | 0 | 0.0% |

Honest deltas vs PR #42:

- Total mapped rows: 5 → 72. Mapping now fires on ~24% of the
  dataset.
- Overall accuracy: 0.7% → 2.3%.
- Adversarial accuracy: 0.0% → 6.5% (the lift isn't dramatic but
  it's real — some adversarial rows are intent-correct after
  mapping).
- Auto-approve accuracy: 7.4% → 22.2%.

## 6. What improved

- **Coverage now spans 3 businesses** — the comparison artifact
  finally answers "does mapping help different business types?"
- **`block_fallback_intents` prevents silent miscategorization** —
  Starbucks on coffee-shop no longer becomes Office Supplies.
- **Per-business signal in the artifact** — `metrics.overall.mapping.per_business[<bid>]`
  surfaces mapped / fallback / review / correct counts per
  business, plus a `summary` block.
- **The rule-gap analysis is now grounded in real numbers** — it
  reads from the actual mapped run, not from speculation.
- **`/evals` page tells the multi-business story** with a real
  table and a "best / biggest gap" summary.

## 7. What stayed weak

- **Design-agency mapped accuracy is 0%.** The dataset uses 5
  software subaccounts; the rule layer has 1 software intent.
  This is the cleanest rule-gap signal yet — fix it by splitting
  `software_subscription` into finer intents (Batch #3 in
  `docs/RULE_GAP_ANALYSIS.md`).
- **Coverage is still capped by the bundled rule set.** Mapping
  is not a coverage solution. The next sprint should focus on
  Batch #1 (auto-repair parts vendors), which delivers the
  biggest coverage lift.
- **Coffee-shop's merchant_fees gets a lot of rows wrong** because
  the dataset's labelling rule between 6100 (Merchant Fees) and
  6110 (Bank Service Charges) is ambiguous. Documented in
  `docs/RULE_GAP_ANALYSIS.md` §9.

## 8. Rule-gap analysis

`docs/RULE_GAP_ANALYSIS.md` — the most actionable deliverable from
this sprint. Reads the mapped run JSON and converts every
deterministic-layer weakness into a concrete engineering item.
Top recommendations:

1. **Parts-vendor rule batch** (NAPA, AutoZone, O'Reilly, Advance,
   LKQ) — biggest coverage lift on auto-repair.
2. **Payroll-service rule batch** (ADP, Gusto, OnPay) — hits all
   three businesses.
3. **Split `software_subscription` intent** into design-tools /
   hosting / project-management / communication subtypes —
   biggest accuracy lift on design-agency.
4. **Split `utilities` intent** into electric / gas-water.
5. **Don't auto-categorize** OWNER TRANSFER / VENMO / Home Depot
   / Lowe's / Amazon — keep them in `/questions`.

## 9. Honesty constraints preserved

- ✅ No "100% AI accuracy" claim anywhere.
- ✅ Raw Haiku accuracy (62.9% / 41.9% adversarial) still headline.
- ✅ Weakness on design-agency is reported honestly — 0% accuracy
  on 39 mapped rows. We don't bury it.
- ✅ `block_fallback` increases routed-to-review counts vs the
  generic baseline. That's the desired safe-abstention behavior;
  the docs say so.
- ✅ `routed_to_review` reported as its own bucket, not as
  misclassification.
- ✅ Per-business breakdown includes the **weakest** business by
  name (design-agency). No cherry-picking.
- ✅ Workflow-level trust language preserved.
- ✅ Fictional sample scenario + "not tax advice" disclaimers
  intact.
- ✅ Demo-stub mode unchanged. Anthropic SDK still never imported.
- ✅ No email / phone / resume / `tel:` / `mailto:` added.

## 10. Tests added / updated

**Backend — 183 passed (was 172, +11)**

New `backend/tests/test_multi_business_rule_mapping.py`:

- coffee-shop business id registered + resolves to the right map.
- design-agency business id registered + resolves to the right
  map.
- Unknown business id falls back to default.
- Coffee-shop software_subscription override (6170) wins over the
  rule's seed default 6070.
- Coffee-shop blocks meals_entertainment fallback — Starbucks
  routes to review, NOT to Office Supplies.
- Design-agency software_subscription override (6140) wins.
- Design-agency blocks utilities fallback — Eversource routes to
  review, NOT to "Owner Salary - N/A."
- Design-agency meals_entertainment maps cleanly to 6220.
- `block_fallback_intents` defaults to empty (backward compat).
- `is_fallback_blocked` method exposes the right boolean per
  business.
- `mapping_metrics(tx_to_business=...)` returns a `per_business`
  dict + a `summary` block.

All 172 prior backend tests pass unchanged.

**Frontend — 159 passed (was 157, +2)**

New `page-content.test.ts` assertions:

- `/evals` renders the new "Per-business mapped-rule breakdown"
  table with all three business names + "Best mapped-row accuracy"
  / "Biggest rule gap" / "Top unmapped intents" copy + link to
  `RULE_GAP_ANALYSIS.md`.
- `/rules` links to multi-business evals + mentions all three
  eval businesses.

All 157 prior frontend tests pass unchanged.

**Build / lint / typecheck**

- `cd backend && pytest -q` → **183 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → all formatted
- `cd backend && mypy --strict src` → no issues found
- `cd frontend && npm test -- --run` → **159 passed (11 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build

## 11. Remaining weaknesses

- **Hand-curated maps.** Future: auto-derive from correction memory.
- **No finer rule intents yet.** Documented as the highest-value
  next batch in `RULE_GAP_ANALYSIS.md`.
- **Hybrid mapped run not committed** (needs Anthropic credit).
- **Block_fallback used asymmetrically** between eval and
  production. Granite State production map has none today.
- **Dataset labelling ambiguity** on Stripe-payout-fee vs
  bank-service-charge needs a documented rule.

## 12. Recommended next PR

In priority order:

1. **Implement Batch #1 from `RULE_GAP_ANALYSIS.md`: parts-vendor
   rules.** Five new rules (NAPA, AutoZone Commercial, O'Reilly,
   Advance Auto, LKQ) with intent `parts_inventory`. Auto-repair
   coverage 5% → ~20%. **Highest leverage; directly capitalizes on
   this sprint's gap analysis.**
2. **Implement Batch #3: split `software_subscription` intent into
   `software_design / software_hosting / software_project_mgmt /
   software_communication`.** Adds rules for Figma, Vercel,
   Notion, Linear, etc. Design-agency accuracy-when-mapped 0% →
   ~50%.
3. **Implement Batch #2: payroll-service rules.** ADP, Gusto,
   OnPay. Hits all three businesses.
4. **Hybrid mapped run committed** — requires Anthropic credit.
5. **QuickBooks-friendly CSV export mapping** — separate track;
   not eval-related.

The recommended single next PR is **#1 (parts-vendor rule
batch)** because it directly translates the gap analysis from
this sprint into measurable coverage on the auto-repair dataset.
