# Mapped-rule eval audit

## 1. Current eval modes

`backend/src/ledgerlens/evals/run.py` (`CATEGORIZERS` dict, lines 26–31)
ships four eval categorizer modes:

| CLI value | Implementation | Behavior |
|---|---|---|
| `stub` | `StubCategorizer` | Random baseline. Picks the first expense account every time. |
| `rules-only` | `RuleOnlyCategorizer` | Loads `category_rules.json`, filters to rules whose `category_code` exists on the dataset's COA, applies them. No mapping layer. Returns `UNCATEGORIZABLE` on no-match or conflict. |
| `claude-haiku-v1` | `ClaudeHaikuCategorizer` | LLM-only (Haiku 3.5). No rule layer. |
| `hybrid-rules-model` | `HybridRulesModelCategorizer` | Rules first; if `UNCATEGORIZABLE`, falls back to the model. Production-shaped pipeline minus correction memory. |

Each mode produces a `RunResult` (harness.py) with `run_metadata`,
`metrics` (overall / non_adversarial / adversarial), and a list of
per-transaction `CategorizationResult` predictions.

`backend/src/ledgerlens/evals/compare.py` aggregates the latest run
per mode into a side-by-side `*-comparison.json` + `.md` artifact.

## 2. Current deterministic rules eval behavior

`RuleOnlyCategorizer.categorize()` (`categorizers/rules.py:71–137`) does
three things and stops:

1. **Load + filter rules** — `_load_bundled_rules()` reads
   `category_rules.json`. Each rule's `category_code` is checked
   against the dataset's COA; rules pointing at codes that don't
   exist are dropped.
2. **Match** — finds rules where merchant/description matches the
   patterns.
3. **Resolve** — strongest priority+confidence rule wins. The rule's
   `category_code` becomes `predicted_category_code`. Confidence is
   the rule's confidence.

Three outcomes:
- **Match** → predict the rule's code at the rule's confidence.
- **No match** → predict `UNCATEGORIZABLE` at confidence 0.0.
- **Conflict** (two rules disagree) → predict `UNCATEGORIZABLE` at
  confidence 0.0, with the conflicting codes stuffed into
  `alternative_category_code`.

The rule's `intent` field (added in PR #41) is **never consulted by
the eval categorizer**. The business rule map module
(`data/business_rule_maps.py`) exists but is wired only into the
production categorize service, not the eval path.

## 3. Current limitation around category-label mismatch

The eval datasets use their own per-business charts of accounts. For
example, **Granite State Auto Service** (`evals/datasets/v0/auto-repair/`)
maps parts purchases to code **`1050`** (Inventory — Parts), not the
default seed COA's `5010` (Cost of Goods Sold). The bundled rule
`rule.amazon.review` targets `6060` Office Supplies; the auto-shop
COA's office-supplies code might be `6240` or absent entirely.

Result: most bundled rules **filter out at load time** when run
against the auto-repair dataset, because their hardcoded
`category_code` doesn't exist on the auto-repair COA. The rules-only
eval mode reports coverage near zero on auto-repair, not because the
rule layer is bad at intent recognition, but because the labels don't
align.

The same pattern hits the coffee-shop and design-agency datasets to a
lesser extent. The honest read of today's numbers is *"rules need
per-business label resolution"*, not *"the rule layer doesn't work."*

## 4. What rule intent mapping now changes

PR #41 added:

- An optional `intent: str | None` on each rule.
- A `BusinessRuleMap` registry in `data/business_rule_maps.py`.
- `resolve_category_for_intent(intent, *, business_id, fallback_code)`
  that returns the active business's mapped code, or the fallback.
- A Granite-State-specific mapping (`parts_inventory → 5010`,
  `internet_telecom → 6150`, etc.) calibrated to the **default seed
  COA**, *not* the eval dataset's COA.

For the eval harness to use this honestly, two things need to
happen:

1. **Wire the mapping into the eval categorizer.** When `intent` is
   set on a matched rule, ask the active business's mapping for the
   right code on *this dataset's COA*, not the seed COA.
2. **Add a per-dataset business mapping for the eval datasets.** The
   auto-repair dataset uses code `1050` for parts inventory, not
   `5010`. The mapping module's `GRANITE_STATE_INTENT_MAP` needs a
   variant calibrated to that COA — or, more cleanly, a new
   `AUTO_REPAIR_EVAL_INTENT_MAP` keyed to the dataset's business id.

The mapping layer should also be allowed to return `None` for a
given intent — that signals "don't auto-categorize this, route to
review." That's the safe-abstention behavior the prompt asks for.

## 5. What metrics should be added

Beyond the existing accuracy / routing / calibration / confusion
metrics, the eval harness should report a per-run
`mapping_metrics` block when business mapping is enabled:

| Metric | Definition |
|---|---|
| `business_id` | The mapping the run used (`"granite_state_auto_repair_eval"` or `None` for generic). |
| `mapping_enabled` | Boolean: did this run consult the business mapping? |
| `mapped_intent_count` | Rule matched **and** the active mapping resolved the intent to a valid COA code. |
| `unmapped_intent_count` | Rule matched **and** carried an intent **but** no mapping override existed; fell back to the rule's own code or routed to review. |
| `mapping_override_count` | Mapped code differs from the rule's own `category_code` (the mapping "won"). |
| `mapping_fallback_to_default_count` | No mapping override, but the rule's own `category_code` was valid on the dataset COA. |
| `mapping_routed_to_review_count` | No mapping override **and** rule's own `category_code` invalid → routed to review. |
| `top_unmapped_intents` | List of `{intent, count}` to identify which intents are most often unmapped. |
| `top_rule_intents` | List of `{intent, count}` for all matched rules. |

These are honest-by-construction: a row that gets safely routed to
review counts as `routed_to_review`, not as a wrong prediction. The
existing `routing_metrics()` already distinguishes auto-approved
from needs-review.

## 6. What should remain unchanged for honesty

- **Raw model accuracy.** The Haiku-only mode keeps reporting its
  ~63% overall / ~42% adversarial. We don't bury it.
- **Adversarial slicing.** Every mode reports the adversarial subset
  metric separately.
- **Calibration and routing blocks.** ECE, MCE, reliability buckets,
  auto-approve / review-route rates all keep working as today.
- **Trust metric language.** Workflow-level, not raw model accuracy.
- **Per-business breakdown.** The frontend's
  per-business-accuracy section continues to show all three
  businesses.
- **No invented ground truth.** If a dataset's labels are missing or
  ambiguous (the Mitchell1 row is `label_confidence: "low"` and
  marked adversarial), we don't paper over them.
- **Mapping is not perfection.** A mapped row that auto-approves
  with confidence 0.92 is still a model/rule prediction that an
  accountant should still spot-check. The `/evals` callout will say
  so.

## 7. Proposed MVP scope

In priority order:

1. **Add optional `matched_rule_intent: str | None` and
   `mapping_outcome: str | None` fields to `CategorizationResult`**
   (the eval-side Pydantic in `categorizers/base.py`). Defaults
   `None` so existing predictions deserialize fine.
2. **Extend `RuleOnlyCategorizer`** to accept
   `use_business_mapping: bool = False` and
   `business_id: str | None = None`. When enabled, after a match,
   call `resolve_category_for_intent` and record the outcome on the
   prediction.
3. **Add `HybridRulesMappedCategorizer`** — same as the existing
   hybrid, but the rule layer uses business mapping.
4. **Register two new CLI modes**: `rules-only-mapped` and
   `hybrid-rules-model-mapped`. Keep `rules-only` and
   `hybrid-rules-model` unchanged as the generic baselines.
5. **Add a per-business eval intent map** for the auto-repair eval
   dataset (`AUTO_REPAIR_EVAL_INTENT_MAP`). It maps
   `parts_inventory → 1050`, `software_subscription → 6190`, etc.,
   calibrated to the auto-repair eval COA — *not* the default seed
   COA.
6. **Compute `mapping_metrics`** from the per-prediction outcome
   fields in the harness. Persist the block under
   `RunMetrics.overall.mapping_metrics`.
7. **Update `compare.py`** to include the mapped modes side-by-side
   with the generic modes.
8. **Run the four key modes** against the auto-repair dataset:
   `rules-only` (generic), `rules-only-mapped`, `hybrid-rules-model`
   (generic), `hybrid-rules-model-mapped`. Commit the artifacts to
   `evals/runs/`.
9. **Update `/evals`** with a new "Business-specific rule mapping"
   section showing the four modes side-by-side and the
   limitations callout. Cross-link from `/rules`.

## 8. Risks and limitations

- **The mapping numbers are dataset-dependent.** Auto-repair will
  show a meaningful improvement; the eval auto-repair COA differs
  from the seed COA, so generic rules score poorly while mapped
  rules can land. Coffee-shop and design-agency datasets use
  COAs closer to the default — generic rules score better there
  and mapping has less headroom. Honest report says so.
- **The mapping is hand-curated.** A future sprint should auto-
  derive per-business intent maps from accumulated correction
  memory. Today we hand-curate one auto-repair map.
- **No labeled ground truth for the Granite State demo seed
  (`backend/.../api/demo.py:DEMO_TRANSACTIONS`).** The demo dataset
  isn't an eval dataset; we never report accuracy against it. The
  auto-repair *eval* dataset has labels; the demo seed does not.
- **Confidence is unchanged when mapping fires.** A 0.95 rule
  becomes a 0.95 mapped prediction. We don't lower confidence just
  because the COA code came from a mapping table; the *intent
  detection* is what the rule was confident about, and that didn't
  change.
- **Adding `matched_rule_intent` to `CategorizationResult` could
  ripple.** This is a Pydantic model used by both eval and
  production code paths. Defaulting to `None` keeps all existing
  callers compatible; existing JSON deserialization still works.
- **`compare.py` needs to be careful about labels.** Generic and
  mapped runs must not be silently averaged together. The
  comparison table must label them separately.

## 9. Acceptance criteria

- [ ] Two new eval CLI modes: `rules-only-mapped` and
  `hybrid-rules-model-mapped`. Existing modes unchanged.
- [ ] An `AUTO_REPAIR_EVAL_INTENT_MAP` keyed to the auto-repair eval
  COA, alongside the existing `GRANITE_STATE_INTENT_MAP` (seed COA).
- [ ] Eval predictions carry optional
  `matched_rule_intent` + `mapping_outcome` fields.
- [ ] `RunMetrics` carries an optional `mapping_metrics` block.
- [ ] `compare.py` outputs all four modes side-by-side; the
  comparison markdown explicitly labels generic vs mapped runs.
- [ ] Actual committed eval runs for all four modes against the
  auto-repair dataset, with the honest deltas surfaced.
- [ ] `/evals` renders a new "Business-specific rule mapping"
  section showing the side-by-side comparison and the
  "mapped rules ≠ perfection" callout. Raw model accuracy stays
  visible.
- [ ] `/rules` links to `/evals` with a "View rule-mapping evals"
  CTA.
- [ ] Backend test count > 163. Frontend test count > 154. Build
  clean. Demo-stub regression test still passes.
- [ ] No "100% AI accuracy" claim anywhere. Sample-scenario +
  not-tax-advice disclaimers preserved.
