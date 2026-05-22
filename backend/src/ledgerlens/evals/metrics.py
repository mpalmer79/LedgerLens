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
    """Per-category precision, recall, and support.

    For each category that appears in either predictions or ground truth, computes
    precision (true positives / predicted positives), recall (true positives /
    actual positives), and support (the count of actual positives). A category
    with no predictions has precision 0.0; a category with no actuals has recall 0.0.
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
        out[cat] = {
            "precision": precision,
            "recall": recall,
            "support": float(actual),
        }
    return out


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
