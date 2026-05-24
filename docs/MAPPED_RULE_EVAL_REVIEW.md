# Mapped-rule eval — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Eval CLI modes | 4 modes: `stub`, `rules-only`, `claude-haiku-v1`, `hybrid-rules-model` | **6 modes** — same 4 + `rules-only-mapped` + `hybrid-rules-model-mapped`. Generic baselines unchanged. |
| `RuleOnlyCategorizer` | Single behavior — used the rule's own `category_code`. | Same default behavior + `use_business_mapping=True` flag that resolves rule intents through the active business's rule map and stamps `matched_rule_intent` + `mapping_outcome` on each prediction. |
| `HybridRulesModelCategorizer` | Used a vanilla `RuleOnlyCategorizer` for its rule layer. | Same + `use_business_mapping=True` flag that swaps to the mapped rules variant. Name flips to `hybrid-rules-model-mapped-v1`. |
| `CategorizationResult` (eval-side) | `transaction_id / predicted_category_code / confidence / reasoning / alternative_category_code / cost_usd / latency_ms / model` | Same + optional `matched_rule_intent: str \| None` + `mapping_outcome: str \| None` (`"mapped"`, `"fallback_to_default"`, `"routed_to_review"`, or None). Backward compatible: defaults are None so existing JSON deserializes. |
| `BusinessRuleMap` registry | Two maps: `DEFAULT_INTENT_MAP` (generic seed COA) + `GRANITE_STATE_INTENT_MAP` (production demo seed COA). | Same + new **`AUTO_REPAIR_EVAL_INTENT_MAP`** keyed to the auto-repair eval dataset's COA (parts_inventory → 1050, software_subscription → 6190, internet_telecom → 6250). |
| `metrics.mapping_metrics()` | Did not exist. | New function aggregating per-prediction `mapping_outcome` + `matched_rule_intent` into a structured block: `mapped_intent_count`, `fallback_to_default_count`, `routed_to_review_count`, `unmapped_intent_count`, `mapping_override_count`, `correct_when_mapped`, `correct_when_fallback`, `top_unmapped_intents`, `top_rule_intents`, `enabled`. |
| `RunMetrics.MetricsSlice` | accuracy / per_category / reliability_diagram / latency / cost / top_confusions / category_coverage / routing / calibration. | Same + **`mapping`** dict (the `mapping_metrics` output). `enabled=False` on non-mapped runs; counts zero. |
| `compare.py` table | Categorizer / Tx / Overall / Non-adv / Adversarial / Cost / p95 / Routing / Calibration | Same + new **"Mapping"** column: `mapped N · fallback N · review N` for mapped runs, `—` for the rest. JSON output gains a `mapping` field per run. |
| `/evals` page | Trust boundary → Production pipeline → Headline accuracy → Routing → Stub-vs-Haiku → Reliability → Per-business breakdown → Adversarial deep-dive. | Same + new **"Business-specific rule mapping"** section between the per-business breakdown and the adversarial deep-dive. Shows the side-by-side rules-only generic vs rules-only-mapped, with the mapping-outcomes column and the top-unmapped-intents list. Carries the explicit "mapped rules do not replace review" callout. Has anchor `#business-specific-rule-mapping` for cross-linking. |
| `/rules` page | Active business mapping card + intent column + mapped category column. | Same + new bottom panel: **"See how mapped deterministic rules perform in evals"** with a `View rule-mapping evals →` CTA linking to `/evals#business-specific-rule-mapping`. |
| Committed eval artifacts | `2026-05-22-claude-haiku-v1.json`, `2026-05-23-rule-categorizer-v1.json`, `2026-05-23-stub-v1.json`, `2026-05-23-comparison.{json,md}`. | Same + `2026-05-24-rule-categorizer-v1.json`, `2026-05-24-rule-categorizer-mapped-v1.json`, `2026-05-24-comparison.{json,md}` — fresh runs of all three free modes against the v0 dataset. |

## 2. Why mapped-rule evals were needed

Before this sprint the rule layer claimed (correctly) to be
*intent-correct* for the bulk of repeating SMB vendors — but every
rules-only / hybrid eval reported close to 0% accuracy on the
auto-repair dataset because its COA codes didn't match the rule's
hardcoded `category_code`. PR #41 added the data model to fix this
(rule intents + per-business mapping). PR #42 wires it into the eval
harness so the honest comparison is finally measurable.

## 3. Eval modes before vs after

Before:
- `rules-only` — generic baseline. 0.0% on the v0 dataset (mostly
  because the rules' hard-coded codes don't exist on the eval COAs).
- `hybrid-rules-model` — generic hybrid. Bounded by the same COA
  mismatch.

After:
- Same two generic baselines, preserved unchanged.
- `rules-only-mapped` — new. Resolves intents through the active
  business mapping. **0.7% overall**, 5 mapped rows, 2 correct → on
  the auto-repair slice the mapping is the only path to non-zero
  accuracy for the rule layer.
- `hybrid-rules-model-mapped` — new. The rule layer of the hybrid is
  mapped; on no-match falls through to the model. Not run against the
  v0 dataset in this sprint (requires Anthropic credit); locally
  invocable.

## 4. Mapping metric definitions

(Full table in `docs/MAPPED_RULE_EVALS.md` §3.)

- `mapped_intent_count` — rule matched, mapping resolved an override.
- `fallback_to_default_count` — rule matched, no mapping override, the
  rule's own code worked.
- `routed_to_review_count` — rule matched, neither mapping nor rule
  default valid → safe abstention.
- `unmapped_intent_count` — `fallback + routed_to_review`.
- `correct_when_mapped` / `correct_when_fallback` — per-outcome
  correctness vs ground truth.
- `top_unmapped_intents` / `top_rule_intents` — descending-frequency
  intent lists.

Crucially: `routed_to_review_count` is reported as its own bucket so a
reviewer doesn't confuse safe abstention with a bad prediction.

## 5. Results summary

From `evals/runs/2026-05-24-comparison.md`:

| Mode | Overall | Adversarial | Mapping outcomes |
|---|---:|---:|---|
| `claude-haiku-v1` | 62.9% | 41.9% | — |
| `rule-categorizer-mapped-v1` | **0.7%** | 0.0% | mapped 5 · fallback 67 · review 0 |
| `rule-categorizer-v1` | 0.0% | 0.0% | — |
| `stub-v1` | 9.3% | 0.0% | — |

Auto-approved accuracy went from 0.0% (generic rules) to **7.4%**
(mapped rules) — the only meaningful quality signal from the rule
layer on this dataset.

## 6. What improved

- **The rule layer finally has non-zero accuracy** on the auto-repair
  eval slice where its codes don't match the dataset COA.
- **Auto-approved accuracy** on rules-only went from 0% to 7.4%.
- **Top unmapped intents** (`merchant_fees`, `software_subscription`,
  `office_supplies`) are now visible to a reviewer — they're a
  next-action list, not a hidden failure mode.
- **The story is cleaner.** A reader can see why `rules-only` was 0%
  and what changes when the mapping fires.

## 7. What did not improve

- **Adversarial accuracy** — still 0% on both rules-only modes. Only
  the LLM has any signal on the intentionally ambiguous rows.
- **Coverage** — both modes only fire on ~24% of the 302
  transactions. The bundled rule set targets software / fees /
  fuel / travel — not the bulk of an auto shop's monthly activity.
- **Coffee-shop and design-agency datasets** — no curated map yet;
  mapped run = generic run for those slices.
- **Hybrid mode under mapping** — not committed (requires API
  credit). Documented as a local manual step.

## 8. Remaining weaknesses

- **One eval dataset has a curated map.** Auto-repair only.
- **No labelled ground-truth metrics on the production demo seed**
  (Granite State Auto Repair / `DEMO_TRANSACTIONS`). That's a
  cleanup-demo dataset, not an eval dataset.
- **Hand-curated mappings.** Future work: derive from correction
  memory.
- **Bundled rule coverage** is the limiting factor for both rules-only
  modes. Mapping doesn't add rules; it makes the existing rules
  usable across more COAs.
- **`hybrid-rules-model-mapped`** is implementable + tested but its
  committed eval run requires Anthropic credit.
- **No frontend chart** for mapping outcomes — just the table + the
  unmapped-intents inline list. A small bar chart would be nice.

## 9. Honesty constraints preserved

- ✅ No "100% AI accuracy" anywhere.
- ✅ Raw Haiku accuracy (62.9% / 41.9% adversarial) still visible on
  `/evals` as the headline model metric.
- ✅ Adversarial accuracy still reported per-mode.
- ✅ Mapped rules are framed honestly — "improve category alignment for
  a specific business, but do not make the model perfect and do not
  replace review for ambiguous transactions."
- ✅ `routed_to_review_count` is reported separately from wrong
  predictions. Safe abstention ≠ misclassification.
- ✅ Workflow-level trust metric language preserved (`workflow-level,
  not raw model accuracy`).
- ✅ Fictional sample scenario + "not tax advice" disclaimers untouched.
- ✅ Demo-stub mode unchanged. Anthropic SDK still never imported in
  demo mode (regression test still passes).
- ✅ No email / phone / resume links added.

## 10. Tests added / updated

**Backend — 172 passed (was 163, +9)**

New `backend/tests/evals/test_mapped_rule_eval.py`:

- New modes register (`rules-only-mapped`, `hybrid-rules-model-mapped`).
- Mapped categorizer has a distinct artifact name.
- Auto-repair COA: `parts_inventory` resolves to `1050` even when the
  rule's own code is `5010`.
- Fallback-to-default path produces `fallback_to_default` outcome.
- Route-to-review path produces `routed_to_review` outcome with
  `UNCATEGORIZABLE` prediction.
- Unmapped business id falls through to `DEFAULT_INTENT_MAP`.
- Generic categorizer does NOT carry mapping provenance (backward
  compat).
- `mapping_metrics` aggregator handles mixed mapped/legacy
  predictions.
- `mapping_metrics` block is disabled when no mapping provenance is
  present.

All 163 prior backend tests pass unchanged.

**Frontend — 157 passed (was 154, +3)**

New / extended `page-content.test.ts`:

- `/evals` renders the Business-specific rule mapping section.
- `/evals` includes the anchor `#business-specific-rule-mapping` for
  the cross-link.
- `/evals` carries the "do not replace review" + workflow-level
  disclaimer.
- `/rules` links to `/evals#business-specific-rule-mapping` with the
  "View rule-mapping evals" CTA.

All 154 prior frontend tests pass unchanged.

**Build / lint / typecheck**

- `cd backend && pytest -q` → **172 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → 90 files already
  formatted
- `cd backend && mypy --strict src` → no issues found in 59 source
  files
- `cd frontend && npm test -- --run` → **157 passed (11 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build

## 11. Recommended next PR

In priority order:

1. **Curated intent maps for coffee-shop + design-agency eval
   datasets.** Each dataset's COA already exists; the map is a careful
   spreadsheet exercise. Will move the rules-only-mapped accuracy
   number on those slices too and turn the comparison artifact into a
   fully populated 3-business story.
2. **Auto-derive intent maps from correction memory.** When a tenant
   has accumulated N corrections of `(merchant → category)`, emit a
   draft intent map for review. Pairs with #1.
3. **Expand the bundled rule set for auto-repair coverage.** NAPA,
   AutoZone, O'Reilly, Advance Auto at a confidence below
   auto-approve. Lifts review coverage without false-positive
   auto-approvals.
4. **Frontend chart for mapping outcomes** — a small horizontal bar
   under the table.
5. **Committed `hybrid-rules-model-mapped` run** — when there's
   Anthropic credit available.

The recommended single next PR is **#1 (coffee-shop + design-agency
intent maps)** — it directly capitalises on the eval-harness wiring
this sprint just shipped and turns the three-business eval into a
real per-business mapped-rule comparison.
