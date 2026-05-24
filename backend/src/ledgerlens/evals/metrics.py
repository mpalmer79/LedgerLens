from statistics import mean

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals.schemas import Transaction


def overall_accuracy(
    predictions: list[CategorizationResult], ground_truth: dict[str, str]
) -> float:
    """Fraction of predictions whose predicted_category_code matches ground truth.

    `ground_truth` maps transaction_id -> proposed_category_code. Predictions whose
    transaction_id is not in ground_truth are skipped. Returns 0.0 for an empty input.
    """
    if not predictions:
        return 0.0
    correct = sum(
        1
        for p in predictions
        if p.transaction_id in ground_truth
        and p.predicted_category_code == ground_truth[p.transaction_id]
    )
    return correct / len(predictions)


def per_category_precision_recall(
    predictions: list[CategorizationResult], ground_truth: dict[str, str]
) -> dict[str, dict[str, float]]:
    """Per-category precision, recall, F1, support, and confusion counts.

    For each category that appears in either predictions or ground truth, computes
    precision (true positives / predicted positives), recall (true positives /
    actual positives), F1, support (count of actual positives), false positives,
    and false negatives. A category with no predictions has precision 0.0; a
    category with no actuals has recall 0.0.

    Pass a *sliced* ground truth when scoring a subset, or per-category support
    will reflect the full dataset rather than the slice.
    """
    categories: set[str] = set()
    for p in predictions:
        categories.add(p.predicted_category_code)
    for tx_id in ground_truth:
        categories.add(ground_truth[tx_id])

    out: dict[str, dict[str, float]] = {}
    for cat in sorted(categories):
        tp = sum(
            1
            for p in predictions
            if p.predicted_category_code == cat and ground_truth.get(p.transaction_id) == cat
        )
        predicted = sum(1 for p in predictions if p.predicted_category_code == cat)
        actual = sum(1 for c in ground_truth.values() if c == cat)
        precision = tp / predicted if predicted else 0.0
        recall = tp / actual if actual else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        out[cat] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": float(actual),
            "false_positives": float(predicted - tp),
            "false_negatives": float(actual - tp),
        }
    return out


def confusion_pairs(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
    *,
    top_n: int | None = None,
) -> list[dict[str, float | str | int]]:
    """List of (actual, predicted) cells with non-zero counts.

    Sorted by descending count. When `top_n` is set, returns only the largest
    off-diagonal pairs (correct predictions are excluded from a "top confusions"
    listing). When `top_n` is None, the full matrix is returned, diagonal
    included.

    Each entry: `{actual, predicted, count, percentage_of_actual}`.
    """
    counts: dict[tuple[str, str], int] = {}
    actual_totals: dict[str, int] = {}
    for p in predictions:
        truth = ground_truth.get(p.transaction_id)
        if truth is None:
            continue
        key = (truth, p.predicted_category_code)
        counts[key] = counts.get(key, 0) + 1
        actual_totals[truth] = actual_totals.get(truth, 0) + 1

    entries: list[dict[str, float | str | int]] = []
    for (actual, predicted), count in counts.items():
        if top_n is not None and actual == predicted:
            continue
        total_actual = actual_totals.get(actual, 0)
        entries.append(
            {
                "actual": actual,
                "predicted": predicted,
                "count": count,
                "percentage_of_actual": count / total_actual if total_actual else 0.0,
            }
        )
    entries.sort(key=lambda e: (-int(e["count"]), str(e["actual"]), str(e["predicted"])))
    if top_n is not None:
        return entries[:top_n]
    return entries


def category_coverage(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
) -> dict[str, list[str] | int]:
    """Summarise which categories the categorizer can / does emit.

    Returns:
      categories_in_truth — every category present in the (sliced) ground truth.
      categories_predicted — every category present in the predictions.
      never_predicted — categories in truth but not in predictions.
      zero_recall — predicted-or-truth categories whose recall is 0.
    """
    truth_set = set(ground_truth.values())
    pred_set = {p.predicted_category_code for p in predictions}
    per_cat = per_category_precision_recall(predictions, ground_truth)
    zero_recall = sorted(
        code for code, m in per_cat.items() if m["support"] > 0 and m["recall"] == 0.0
    )
    return {
        "categories_in_truth": sorted(truth_set),
        "categories_in_truth_count": len(truth_set),
        "categories_predicted": sorted(pred_set),
        "categories_predicted_count": len(pred_set),
        "never_predicted": sorted(truth_set - pred_set),
        "zero_recall": zero_recall,
    }


def reliability_diagram(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
    num_buckets: int = 10,
) -> list[dict[str, float | str | int]]:
    """Bin predictions by confidence and report mean-confidence vs. actual-accuracy.

    Buckets are equal-width over [0, 1]. Returns one entry per bucket (including
    empty buckets, marked count=0). Confidence values exactly equal to 1.0 are
    included in the final bucket.
    """
    buckets: list[list[CategorizationResult]] = [[] for _ in range(num_buckets)]
    for p in predictions:
        idx = min(int(p.confidence * num_buckets), num_buckets - 1)
        buckets[idx].append(p)

    out: list[dict[str, float | str | int]] = []
    for i, bucket in enumerate(buckets):
        low = i / num_buckets
        high = (i + 1) / num_buckets
        label = f"{low:.1f}-{high:.1f}"
        if not bucket:
            out.append(
                {
                    "bucket": label,
                    "count": 0,
                    "predicted_confidence_mean": 0.0,
                    "actual_accuracy": 0.0,
                }
            )
            continue
        correct = sum(
            1 for p in bucket if ground_truth.get(p.transaction_id) == p.predicted_category_code
        )
        out.append(
            {
                "bucket": label,
                "count": len(bucket),
                "predicted_confidence_mean": mean(p.confidence for p in bucket),
                "actual_accuracy": correct / len(bucket),
            }
        )
    return out


def latency_stats(predictions: list[CategorizationResult]) -> dict[str, float]:
    """p50, p95, and mean of per-transaction latency_ms across the prediction set.

    Returns all-zeros for an empty input. p50 and p95 use nearest-rank
    interpolation on the sorted list of latencies.
    """
    if not predictions:
        return {"p50_ms": 0.0, "p95_ms": 0.0, "mean_ms": 0.0}
    latencies = sorted(p.latency_ms for p in predictions)
    n = len(latencies)
    p50_idx = max(0, min(n - 1, int(n * 0.50)))
    p95_idx = max(0, min(n - 1, int(n * 0.95)))
    return {
        "p50_ms": latencies[p50_idx],
        "p95_ms": latencies[p95_idx],
        "mean_ms": mean(latencies),
    }


def total_cost(predictions: list[CategorizationResult]) -> float:
    """Sum of `cost_usd` across all predictions."""
    return sum(p.cost_usd for p in predictions)


def cost_per_100(predictions: list[CategorizationResult]) -> float:
    """Average cost extrapolated to 100 transactions. Returns 0.0 for empty input."""
    if not predictions:
        return 0.0
    return total_cost(predictions) * 100.0 / len(predictions)


def subset_by_adversarial(
    predictions: list[CategorizationResult],
    transactions: list[Transaction],
    adversarial: bool,
) -> list[CategorizationResult]:
    """Filter predictions to the adversarial or non-adversarial slice.

    `transactions` provides the is_adversarial flag keyed by transaction id.
    Predictions whose transaction is not found in `transactions` are excluded.
    """
    adversarial_ids = {t.id for t in transactions if t.is_adversarial == adversarial}
    return [p for p in predictions if p.transaction_id in adversarial_ids]


# ── Routing metrics ───────────────────────────────────────────────────────


UNCATEGORIZABLE_SENTINEL = "UNCATEGORIZABLE"


def classify_routing_outcome(
    pred: CategorizationResult,
    valid_codes: set[str] | None,
    *,
    auto_threshold: float = 0.9,
    review_threshold: float = 0.6,
) -> str:
    """Return the pipeline status the production system would assign.

    Mirrors `services/categorize._route_status`. The eval-side CategorizationResult
    has no `status` column, so we derive it from the prediction and the active
    chart-of-accounts membership.

    `valid_codes` is the set of codes considered "in the active COA" for this
    business. Pass None to disable the COA check.
    """
    if pred.predicted_category_code == UNCATEGORIZABLE_SENTINEL:
        if "API" in (pred.reasoning or ""):
            return "failed"
        return "uncategorizable"
    if valid_codes is not None and pred.predicted_category_code not in valid_codes:
        return "needs_review"
    if pred.confidence >= auto_threshold:
        return "auto_approved"
    if pred.confidence >= review_threshold:
        return "needs_review"
    return "needs_review"


def _provider_kind(pred: CategorizationResult) -> str:
    """Classify a prediction by where it came from, for routing / calibration.

    The eval-side schema doesn't have a `model_provider` field. We infer:
    - `correction_memory` — `model` starts with `mem_` or equals a known memory
      marker. Currently no eval-side memory baseline emits these, so this is a
      hook for hybrid-memory mode.
    - `rule_categorizer` — `model` starts with `rule.`.
    - `model` — anything else with a non-None `model` and non-zero cost.
    - `deterministic_other` — non-None `model`, zero cost, not a rule (e.g. the
      stub categorizer reporting `deterministic_rules_v1` for the no-match
      case).
    - `unknown` — `model is None`.
    """
    model = pred.model or ""
    if model.startswith("mem_") or model == "correction_memory":
        return "correction_memory"
    if model.startswith("rule."):
        return "rule_categorizer"
    if model and pred.cost_usd > 0:
        return "model"
    if model:
        return "deterministic_other"
    return "unknown"


def routing_metrics(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
    *,
    valid_codes: set[str] | None = None,
    auto_threshold: float = 0.9,
    review_threshold: float = 0.6,
    model_only_cost_per_100: float | None = None,
) -> dict[str, object]:
    """How the pipeline routes work, and how trustworthy each route is.

    Status counts + percentages, auto-approved accuracy, review rate, model-call
    rate, zero-cost rate, and cost-savings vs an optional model-only baseline.
    """
    total = len(predictions)
    if total == 0:
        return {
            "total": 0,
            "auto_approved": 0,
            "needs_review": 0,
            "uncategorizable": 0,
            "failed": 0,
            "auto_approved_rate": 0.0,
            "review_rate": 0.0,
            "auto_approved_accuracy": 0.0,
            "model_called": 0,
            "model_called_rate": 0.0,
            "zero_cost": 0,
            "zero_cost_rate": 0.0,
            "by_provider": {},
            "cost_per_100": 0.0,
            "cost_per_100_model_only_baseline": model_only_cost_per_100,
            "cost_savings_per_100": (None if model_only_cost_per_100 is None else 0.0),
        }

    counts: dict[str, int] = {
        "auto_approved": 0,
        "needs_review": 0,
        "uncategorizable": 0,
        "failed": 0,
    }
    auto_correct = 0
    auto_total = 0
    by_provider: dict[str, int] = {}
    model_called = 0
    zero_cost = 0

    for p in predictions:
        status = classify_routing_outcome(
            p,
            valid_codes,
            auto_threshold=auto_threshold,
            review_threshold=review_threshold,
        )
        counts[status] = counts.get(status, 0) + 1
        if status == "auto_approved":
            auto_total += 1
            if ground_truth.get(p.transaction_id) == p.predicted_category_code:
                auto_correct += 1
        kind = _provider_kind(p)
        by_provider[kind] = by_provider.get(kind, 0) + 1
        if kind == "model":
            model_called += 1
        if p.cost_usd == 0.0:
            zero_cost += 1

    cost_per_100 = total_cost(predictions) * 100.0 / total
    cost_savings: float | None = None
    if model_only_cost_per_100 is not None:
        cost_savings = round(model_only_cost_per_100 - cost_per_100, 6)

    return {
        "total": total,
        "auto_approved": counts["auto_approved"],
        "needs_review": counts["needs_review"],
        "uncategorizable": counts["uncategorizable"],
        "failed": counts["failed"],
        "auto_approved_rate": counts["auto_approved"] / total,
        "review_rate": counts["needs_review"] / total,
        "auto_approved_accuracy": (auto_correct / auto_total) if auto_total else 0.0,
        "model_called": model_called,
        "model_called_rate": model_called / total,
        "zero_cost": zero_cost,
        "zero_cost_rate": zero_cost / total,
        "by_provider": by_provider,
        "cost_per_100": cost_per_100,
        "cost_per_100_model_only_baseline": model_only_cost_per_100,
        "cost_savings_per_100": cost_savings,
    }


# ── Calibration metrics ───────────────────────────────────────────────────


HIGH_CONFIDENCE_THRESHOLD = 0.9
HIGH_CONFIDENCE_MIN_COUNT = 5
HIGH_CONFIDENCE_TOLERANCE = 0.05  # allow 5% slack before warning


def _calibration_block(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
    *,
    label: str,
    num_buckets: int = 10,
) -> dict[str, object]:
    """One calibration block: bucket table + ECE + MCE + optional warning."""
    diagram = reliability_diagram(predictions, ground_truth, num_buckets=num_buckets)
    total = len(predictions)
    ece = 0.0
    mce = 0.0
    for bucket in diagram:
        count = int(bucket["count"])
        if count == 0:
            continue
        gap = abs(float(bucket["predicted_confidence_mean"]) - float(bucket["actual_accuracy"]))
        ece += gap * (count / total) if total else 0.0
        if gap > mce:
            mce = gap

    warning: str | None = None
    top = diagram[-1]
    if int(top["count"]) >= HIGH_CONFIDENCE_MIN_COUNT and float(top["actual_accuracy"]) < (
        HIGH_CONFIDENCE_THRESHOLD - HIGH_CONFIDENCE_TOLERANCE
    ):
        warning = (
            f"High-confidence bucket ({top['bucket']}, n={top['count']}) actual "
            f"accuracy {float(top['actual_accuracy']):.2%} is materially below "
            f"the {HIGH_CONFIDENCE_THRESHOLD:.0%} expectation. Auto-approved "
            "predictions in this range cannot be trusted blindly."
        )

    return {
        "label": label,
        "count": total,
        "ece": round(ece, 4),
        "mce": round(mce, 4),
        "buckets": diagram,
        "warning": warning,
    }


def calibration_metrics(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
) -> dict[str, object]:
    """Calibration split by provider kind.

    `overall` mixes everything (matches the legacy reliability diagram).
    `model_only` isolates predictions that actually came from the model — the
    block reviewers should trust as a calibration claim. `deterministic`
    isolates rule / memory predictions, whose confidence is a rule-curated
    constant, not a probability. They are reported for completeness, not as
    a calibration argument.
    """
    by_kind: dict[str, list[CategorizationResult]] = {
        "model": [],
        "deterministic": [],
    }
    for p in predictions:
        kind = _provider_kind(p)
        if kind in {"correction_memory", "rule_categorizer", "deterministic_other"}:
            by_kind["deterministic"].append(p)
        elif kind == "model":
            by_kind["model"].append(p)
        # unknown → contribute only to `overall`

    return {
        "overall": _calibration_block(predictions, ground_truth, label="overall"),
        "model_only": _calibration_block(by_kind["model"], ground_truth, label="model_only"),
        "deterministic": _calibration_block(
            by_kind["deterministic"], ground_truth, label="deterministic"
        ),
    }


# ── Per-business rule intent mapping metrics ───────────────────────────────


def mapping_metrics(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
) -> dict[str, object]:
    """Aggregate the `matched_rule_intent` + `mapping_outcome` provenance
    fields that the mapped rule categorizers stamp on each prediction.

    The block only carries signal when at least one prediction has
    `mapping_outcome != None` (i.e. a mapped rule categorizer was used).
    For non-mapped runs every field is zero and `enabled=False`.

    Definitions, all transaction counts:

    - mapped_intent_count: rule matched, mapping resolved the intent to a
      COA code, and the resolved code differs from the rule's default
      `category_code` (the mapping "won").
    - fallback_to_default_count: rule matched, no override existed for the
      intent, the rule's own `category_code` was valid on the dataset COA
      and was used.
    - routed_to_review_count: rule matched but neither the mapping nor the
      rule's own code resolved to a valid COA category → prediction is
      `UNCATEGORIZABLE` (safe abstention, NOT a wrong prediction).
    - unmapped_intent_count: rule matched and carried an intent, but no
      mapping override existed (sum of fallback + routed-to-review where
      the rule had an intent).
    - mapping_override_count: synonym for mapped_intent_count, kept for
      backwards-compatible naming in the audit doc.
    - top_unmapped_intents / top_rule_intents: descending frequency lists.

    Honesty note: `routed_to_review_count` is reported as its own bucket so
    callers don't confuse safe abstention with a bad prediction. The
    routing block (see `routing_metrics`) already reports total review-route
    rate; this block just attributes it to mapping failure when relevant.
    """
    outcomes: dict[str, int] = {
        "mapped": 0,
        "fallback_to_default": 0,
        "routed_to_review": 0,
    }
    unmapped_intents: dict[str, int] = {}
    rule_intents: dict[str, int] = {}
    enabled = False
    correct_when_mapped = 0
    correct_when_fallback = 0
    for p in predictions:
        if p.mapping_outcome is None and p.matched_rule_intent is None:
            continue
        enabled = True
        if p.matched_rule_intent:
            rule_intents[p.matched_rule_intent] = rule_intents.get(p.matched_rule_intent, 0) + 1
        if p.mapping_outcome:
            outcomes[p.mapping_outcome] = outcomes.get(p.mapping_outcome, 0) + 1
            unmapped = p.mapping_outcome in {"fallback_to_default", "routed_to_review"}
            if unmapped and p.matched_rule_intent:
                unmapped_intents[p.matched_rule_intent] = (
                    unmapped_intents.get(p.matched_rule_intent, 0) + 1
                )
        # Track per-outcome correctness against ground truth for the rows
        # where mapping actually fired with a category. Routed-to-review
        # rows produce UNCATEGORIZABLE — we report their accuracy as 0
        # against ground truth (the row was abstained on by design, not
        # incorrectly predicted).
        truth = ground_truth.get(p.transaction_id)
        if truth is None:
            continue
        if p.mapping_outcome == "mapped" and p.predicted_category_code == truth:
            correct_when_mapped += 1
        elif p.mapping_outcome == "fallback_to_default" and p.predicted_category_code == truth:
            correct_when_fallback += 1

    top_unmapped = sorted(unmapped_intents.items(), key=lambda kv: kv[1], reverse=True)[:10]
    top_rule = sorted(rule_intents.items(), key=lambda kv: kv[1], reverse=True)[:10]
    return {
        "enabled": enabled,
        "mapped_intent_count": outcomes["mapped"],
        "fallback_to_default_count": outcomes["fallback_to_default"],
        "routed_to_review_count": outcomes["routed_to_review"],
        "unmapped_intent_count": outcomes["fallback_to_default"] + outcomes["routed_to_review"],
        "mapping_override_count": outcomes["mapped"],
        "correct_when_mapped": correct_when_mapped,
        "correct_when_fallback": correct_when_fallback,
        "top_unmapped_intents": [{"intent": k, "count": v} for k, v in top_unmapped],
        "top_rule_intents": [{"intent": k, "count": v} for k, v in top_rule],
    }
