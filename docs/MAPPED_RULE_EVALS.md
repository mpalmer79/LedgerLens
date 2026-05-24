# Mapped-rule evals

How the eval harness measures the per-business rule intent mapping
layer — what it shows, what it doesn't, and how to run it locally.

## 1. Why mapped-rule evals exist

The deterministic rule layer maps merchant/description patterns to a
fixed `category_code`. Different businesses use different COA codes for
the same accounting intent — auto-repair shops put parts in
`1050 Inventory - Parts (Resale)`, the default seed COA puts them in
`5010 Cost of Goods Sold`. PR #41 added an `intent` field to every rule
and a `BusinessRuleMap` registry so the rule layer can resolve the
intent to the active business's COA code.

This sprint wires that mapping into the **eval harness** so we can
honestly answer: *"does mapping actually move the needle on a
dataset whose COA differs from the seed?"*

## 2. Eval modes

Five distinct modes ship today (extended from the four PR #28 baseline):

| CLI value | Implementation | Mapping enabled? |
|---|---|---|
| `stub` | `StubCategorizer` (random baseline) | n/a |
| `rules-only` | `RuleOnlyCategorizer()` | **No** — generic baseline. Uses each rule's own `category_code`. |
| **`rules-only-mapped`** | `RuleOnlyCategorizer(use_business_mapping=True)` | **Yes** — resolves rule intents through the active business's map. |
| `claude-haiku-v1` | `ClaudeHaikuCategorizer` (LLM-only) | n/a |
| `hybrid-rules-model` | `HybridRulesModelCategorizer()` | **No** |
| **`hybrid-rules-model-mapped`** | `HybridRulesModelCategorizer(use_business_mapping=True)` | **Yes** — the rule layer of the hybrid is mapped. |

The `rules-only` and `hybrid-rules-model` baselines are preserved
unchanged. The mapped variants are additive. Eval artifacts are
labelled distinctly (`rule-categorizer-v1` vs
`rule-categorizer-mapped-v1`) so `compare.py` never mixes them.

## 3. Metric definitions

Every eval run now ships a `mapping` block per metrics slice. Non-mapped
runs leave `enabled=false` and zero everything else.

| Metric | Meaning |
|---|---|
| `enabled` | `true` iff at least one prediction carries mapping provenance. |
| `mapped_intent_count` | Rule matched **and** mapping resolved to a code that differs from the rule's default. The mapping "won." |
| `fallback_to_default_count` | Rule matched, **no override** existed for the intent, but the rule's own `category_code` was valid on the dataset COA and was used. |
| `routed_to_review_count` | Rule matched but neither the mapping nor the rule's default code resolved to a valid COA category → prediction is `UNCATEGORIZABLE` (**safe abstention**, not a wrong prediction). |
| `unmapped_intent_count` | `fallback_to_default_count + routed_to_review_count`. |
| `mapping_override_count` | Synonym for `mapped_intent_count`. |
| `correct_when_mapped` / `correct_when_fallback` | Per-outcome correctness against ground truth. |
| `top_unmapped_intents` | Descending-frequency list of intents that hit fallback or review-routing — useful for prioritising which intent to add to a business map next. |
| `top_rule_intents` | Descending-frequency list of all matched rule intents. |

The honest distinction the harness draws:

- **Wrong prediction** = rule fires, picks a category, the category
  isn't the ground truth.
- **Safe abstention** = rule fires, mapping can't resolve, prediction is
  `UNCATEGORIZABLE`. This counts as zero accuracy by construction
  (the row was routed to review), **not** as a misclassification.

The routing-metrics block (`overall.routing`) already distinguishes
auto-approved vs review-routed; `mapping_metrics` attributes the
review-routing to mapping failure when relevant.

## 4. Difference between wrong prediction and review routing

A run with `accuracy=0` and 100 rows routed to review is **not** the
same as a run with `accuracy=0` and 100 wrong predictions. The harness
distinguishes:

- `accuracy` counts a row as correct iff `predicted == ground_truth`.
  `UNCATEGORIZABLE` predictions never match ground truth, so they count
  as zero accuracy.
- `routing.review_rate` counts `UNCATEGORIZABLE` predictions and
  below-review-threshold predictions as review-routed. **These are
  abstentions, not errors.**
- `mapping.routed_to_review_count` further attributes those abstentions
  to mapping failures (matched rule, no resolvable category).

A reviewer reading the eval should look at `auto_approved_accuracy`
(how often we get it right *when we don't ask for help*) as the
quality signal, and `review_rate` as the cost signal. Mapped rules
should not move overall accuracy much on a dataset whose COA already
matches the seed; they should move `routed_to_review_count` down
without inflating wrong-prediction counts.

## 5. How Granite State mapping is evaluated

The auto-repair eval dataset
(`evals/datasets/v0/auto-repair/`) is "Granite State Auto Service" —
100 labeled transactions with the same kind of COA a real auto repair
shop would use:

- `1050 Inventory - Parts (Resale)` (asset; not on the seed COA)
- `5010 COGS - Parts (Resold)` (different from seed's "Cost of Goods
  Sold")
- `6150 Small Tools (Expensed)` (different from seed's "Telephone &
  Internet")
- `6250 Telephone & Internet` (different again)

`AUTO_REPAIR_EVAL_INTENT_MAP` in
`backend/src/ledgerlens/data/business_rule_maps.py` is keyed to this
COA — `parts_inventory → 1050`, `software_subscription → 6190`,
`internet_telecom → 6250`. The generic seed-COA mapping
(`GRANITE_STATE_INTENT_MAP`) is a different map for the production
demo, which uses the default seed COA.

## 6. What improved

From the `2026-05-24-comparison.json` artifact:

- `rule-categorizer-v1` (generic): **0.0% overall accuracy**,
  auto-approve rate 8.9% at 0.0% accuracy.
- `rule-categorizer-mapped-v1`: **0.7% overall accuracy**, auto-approve
  rate 8.9% at **7.4% accuracy**, mapping outcomes `mapped 5 ·
  fallback 67 · review 0`.

The headline number is small because rules only fire on ~24% of the
302 total transactions (the bundled rule set targets software /
fee / fuel / meals / travel — not the bulk of an auto shop's monthly
activity). Of the matched rows, mapping resolves 5 to the
auto-repair COA where the generic mode dropped them at validation
time. **2 of those 5 are correct against ground truth, vs 0 from the
generic baseline.**

The honest read: mapping is a structural correctness fix, not a
silver bullet. It eliminates the "rules drop out because the COA
labels don't match" failure mode. It does not — by itself — make the
bundled rules cover the long tail of monthly transactions.

## 7. What did not improve

- **Adversarial accuracy.** Mapped rules don't help on the
  intentionally ambiguous rows (Mitchell1 prepaid policy ambiguity,
  shop-supplies-vs-COGS judgement calls). Adversarial accuracy stays
  at 0% for both rules-only modes; only the LLM mode (~42%) has any
  signal there.
- **Cost.** Both rules-only modes are zero-cost; the mapping layer
  doesn't change that.
- **Latency.** Mapping is a dict lookup; p95 stays at the rule-match
  baseline.
- **Calibration.** Deterministic confidence is unchanged — a 0.95
  rule still reports 0.95 whether the code came from `category_code`
  or from a mapping table.
- **Coverage on coffee-shop and design-agency.** These datasets don't
  have curated intent maps yet; they fall back to
  `DEFAULT_INTENT_MAP`, which is keyed to the seed COA — i.e., the
  same codes the rules were already targeting. Mapping is a no-op for
  them today.

## 8. Known limitations

- **Hand-curated mappings.** A future improvement is auto-derivation
  from accumulated correction memory. Today every map is hand-typed.
- **Single map per business.** No support for time-varying mappings
  (e.g. before/after a COA migration).
- **No conflict resolution across intents.** If two rules with
  different intents both fire on the same row and the active mapping
  resolves them to the same code, the harness treats that as a
  consensus match (no conflict). That's the correct behavior — but
  if two intents resolve to *different* codes, the harness routes to
  review on the resolved-code conflict.
- **Hybrid-mapped runs require Anthropic credit.** The
  `hybrid-rules-model-mapped` mode falls through to the model on
  no-match. We don't ship a committed run artifact for it in this
  sprint; running it locally takes one `--categorizer
  hybrid-rules-model-mapped` invocation with `ANTHROPIC_API_KEY` set.
- **Only auto-repair has a per-eval-dataset map.** Coffee-shop and
  design-agency mapped runs land at the default seed map, which
  shows the same numbers as the generic baseline by construction.

## 9. How to run mapped-rule evals locally

From the repo root:

```bash
# Generic baseline (no mapping). Free.
python -m ledgerlens.evals.run \
  --categorizer rules-only \
  --dataset v0 \
  --datasets-root ./evals/datasets \
  --runs-dir ./evals/runs

# Mapped variant. Free. Uses each rule's `intent` + the active business
# rule map for each dataset business id (`auto-repair`, etc.).
python -m ledgerlens.evals.run \
  --categorizer rules-only-mapped \
  --dataset v0 \
  --datasets-root ./evals/datasets \
  --runs-dir ./evals/runs

# Hybrid (rules → model). Requires ANTHROPIC_API_KEY and incurs cost.
python -m ledgerlens.evals.run \
  --categorizer hybrid-rules-model \
  --dataset v0

# Hybrid + mapping. Same cost as hybrid; the rule layer is mapped.
python -m ledgerlens.evals.run \
  --categorizer hybrid-rules-model-mapped \
  --dataset v0

# Aggregate the latest run per mode into a side-by-side report.
python -m ledgerlens.evals.compare \
  --runs-dir ./evals/runs
```

Demo-stub mode (`CATEGORIZER_MODE=demo_stub`) does **not** affect the
eval harness — the eval harness selects its categorizer via
`--categorizer`. The harness never imports the production demo stub
and never calls the production categorize endpoints.

The eval harness CLI does not auto-trigger paid API calls; only
`--categorizer claude-haiku-v1`, `--categorizer hybrid-rules-model`,
and `--categorizer hybrid-rules-model-mapped` reach the model.

## 10. Future work

In priority order:

1. **Per-dataset curated maps for coffee-shop and design-agency.**
   Each dataset's COA already exists; building the map is a careful
   spreadsheet exercise. Will move the rules-only-mapped accuracy
   number on those datasets too.
2. **Auto-derive maps from correction memory.** After enough
   `(merchant → category)` corrections accumulate on a tenant, emit a
   draft intent map for review.
3. **More rules.** The bundled set covers ~30% of typical SMB
   transactions. Expanding coverage for auto-shop parts (NAPA,
   AutoZone, O'Reilly) at a confidence below auto-approve would lift
   the rules-only review-rate without false-positive auto-approvals.
4. **Intent coverage chart on `/evals`.** Today the harness reports
   intent counts in JSON; a small bar chart on the page would show
   which intents are well-mapped vs lagging.
5. **`hybrid-rules-model-mapped` committed run.** Requires Anthropic
   credit. Out of scope for the portfolio demo; documented as a
   manual step.
