# Eval harness upgrade plan

## Current eval modes

Two categorizer baselines plug into the harness via `evals/run.py`:

- `stub` — `StubCategorizer`, always predicts the first expense account at confidence 0.5.
- `claude-haiku-v1` — `ClaudeHaikuCategorizer`, model-only.
- `rules-only` — `RuleOnlyCategorizer` (added in session 14), deterministic rule layer only.

Each run dumps a JSON artifact under `evals/runs/YYYY-MM-DD-<name>.json` containing per-transaction predictions plus `overall / non_adversarial / adversarial` slice metrics: accuracy, per-category precision/recall/support, a 10-bucket reliability diagram, latency p50/p95/mean, total cost, cost per 100.

## Current limitations

1. **Sliced metric bug.** `harness.py::_slice(predictions, ground_truth)` passes the *full* dataset ground-truth dict on every slice call. `per_category_precision_recall` then counts support and computes recall against the full dataset even when scoring an adversarial-only or non-adversarial-only subset. This was called out in the original gap analysis as a known issue; this PR fixes it.
2. **No confusion matrix, no F1.** Per-category metrics report precision/recall/support but no F1 and no actual-vs-predicted confusion pairs, so reviewers can't see *what* the categorizer confuses for *what*.
3. **No routing metrics.** The eval treats the system as a classifier, not a router. There is no count of "auto-approved" vs "needs-review" vs "uncategorizable" vs "failed", no auto-approved accuracy, no review rate, no model-call rate, no zero-cost rate.
4. **Calibration is anecdotal.** The reliability diagram exists but there is no scalar expected calibration error (ECE) or maximum calibration error (MCE), and rule / memory predictions (confidence = 1.0 by construction) mix into the same buckets as model probability outputs, polluting the model's calibration story.
5. **No real hybrid evaluation.** `rules-only` and `claude-haiku-v1` exist as separate runs, but there is no `hybrid-rules-model` mode that mirrors the *actual* product pipeline (memory → rules → model). The shipped product is layered; the eval is not.
6. **No correction-memory simulation.** Correction memory needs prior human corrections to do anything. A real eval requires a train/test split that synthesizes the memory from training labels without leaking test labels into it.
7. **Frontend `/evals` is single-run.** It loads the latest non-stub run and compares it to stub. It cannot show a comparison across modes (stub / rules-only / hybrid / model-only) side by side.

## Desired eval modes

After this PR:

- `stub` — unchanged, kept as a sanity baseline.
- `claude-haiku-v1` — unchanged, the model-only run.
- `rules-only` — unchanged, deterministic rule layer only.
- `hybrid-rules-model` — **new.** Apply the rule layer first; on no-match or low-confidence rule, fall back to the model. Mirrors the production pipeline minus correction memory.
- `hybrid-memory-rules-model` — **new (simulated).** Train/test split: a deterministic 80/20 split synthesizes a `CorrectionMemory` table from the training half's ground-truth labels (treated as if they were human corrections). The eval runs against the test half so labels never leak into the memory.

## Metrics to add

### Classification

- Per-category F1 (added to existing precision/recall/support).
- Confusion matrix as a list of `{actual, predicted, count}` tuples for every (actual, predicted) pair that appears.
- Top-N confused pairs report (largest off-diagonal cells), with per-row percentages.
- Category coverage: total categories in ground truth, predicted, never predicted, zero recall.

### Routing

A new `routing` block per slice with:
- `total`
- `auto_approved` / `needs_review` / `uncategorizable` / `failed` counts and percentages
- `auto_approved_accuracy` — accuracy on the auto-approved subset (this is the number that matters in production)
- `review_rate` — needs_review / total
- `model_called` / `zero_cost` counts and percentages, derived from the prediction's provider where available
- `cost_per_100_actual` vs `cost_per_100_model_only_baseline` (delta = cost saved)

Routing for an eval prediction is derived from the prediction itself: `predicted_category_code == "UNCATEGORIZABLE"` → uncategorizable; confidence ≥ auto threshold AND code in COA → auto_approved; otherwise needs_review. (The eval-side `CategorizationResult` has no `status` field — the harness computes status at metric time.)

### Calibration

- Expected calibration error (ECE) — bucket-weighted mean absolute gap between mean confidence and actual accuracy.
- Maximum calibration error (MCE) — the worst per-bucket gap.
- High-confidence warning: if the 0.9–1.0 bucket has actual accuracy materially below 0.9 and contains a non-trivial count, a warning string is emitted into the metrics output.
- **Separated calibration** — model predictions are isolated by `model_provider != "deterministic"`-equivalent (in eval terms: `model` field is the rule id for rule predictions, the actual model name for model predictions, `None` for stub). Three calibration blocks:
  - `calibration.overall` — every prediction (matches today's reliability diagram).
  - `calibration.model_only` — predictions whose model is a real LLM model. The number a reviewer should trust.
  - `calibration.deterministic` — predictions whose model is a rule id (confidence = rule confidence by design; not a probability). Reported for completeness, not for calibration claims.

## Known tenant-specific COA issue

The synthetic v0 dataset uses three different chart-of-account code numberings (coffee-shop, design-agency, auto-repair). The bundled rule set in `data/category_rules.json` targets the default seed COA. Many rule predictions are technically correct merchant→category mappings but score 0% against the eval ground truth because the same code number means a different thing in each business's COA.

This is a methodology finding, not a defect. The honest framing across all eval outputs and the comparison report is:

> Rules are tenant-specific. The bundled rule set is benchmarked against the default seed COA, not against the synthetic eval businesses. Cross-business rule-only accuracy is 0% by design.

The hybrid eval mode is structured the same way: rules match by code, then the model fallback recovers. For the synthetic eval dataset, this means the hybrid mode will be at most as good as the model-only mode (rules cannot help when their code outputs don't map). The value of the rule layer shows up in cost: matched rows cost nothing.

## How hybrid evaluation should be interpreted

For each mode, two numbers matter more than raw accuracy:

1. **Auto-approved accuracy.** The accuracy of the predictions the system would put on the books without a human looking. This must stay high.
2. **Review rate.** The fraction of predictions sent to a human. Lower is cheaper, but only if auto-approved accuracy is high. A 100% auto-approve rate at 50% accuracy is *worse* than a 50% auto-approve rate at 95% accuracy.

Cost per 100 is the third number — the deterministic layers earn their place by lowering it without lowering auto-approved accuracy.

## Acceptance criteria

- `per_category_precision_recall` accepts and respects a sliced ground truth; the harness slices it before calling.
- `harness.py::_slice` uses the sliced ground truth.
- A regression test covers the sliced-metric bug.
- New metric: `per_category_f1`.
- New metric: `confusion_pairs` returning a sorted list of `{actual, predicted, count, percentage_of_actual}`.
- New metric block: `routing` per slice with the fields listed above.
- New metric block: `calibration` per slice with `overall`, `model_only`, `deterministic` sub-blocks, each carrying `ece`, `mce`, and the bucket table.
- New categorizer registered in `evals/run.py`: `hybrid-rules-model`.
- New script: `scripts/run_eval_comparison.py` (or `evals/compare.py`) that runs all modes against the same dataset and emits a JSON artifact plus a Markdown report at `evals/runs/YYYY-MM-DD-comparison.{json,md}`.
- Frontend `/evals` page surfaces the layered-pipeline summary, the comparison table, the routing block, and the calibration warning when present.
- Existing tests stay green. New tests cover slice correctness, F1, confusion pairs, routing classification, ECE/MCE math, and hybrid-mode no-leakage.
- README, gap analysis, and demo walkthrough updated to call out the new modes and honest framings.
