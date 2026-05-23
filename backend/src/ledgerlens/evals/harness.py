import subprocess
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

from ledgerlens.categorizers.base import CategorizationResult, Categorizer
from ledgerlens.evals import metrics
from ledgerlens.evals.schemas import Dataset, Transaction


class RunMetadata(BaseModel):
    dataset_version: str
    categorizer_name: str
    model: str | None
    timestamp_utc: str
    git_sha: str | None


class MetricsSlice(BaseModel):
    accuracy: float
    per_category: dict[str, dict[str, float]]
    reliability_diagram: list[dict[str, Any]]
    latency_stats: dict[str, float]
    total_cost: float
    cost_per_100: float
    transaction_count: int
    # Added in session 15 — sliced consistently with the prediction subset.
    top_confusions: list[dict[str, Any]] = []
    category_coverage: dict[str, Any] = {}
    routing: dict[str, Any] = {}
    calibration: dict[str, Any] = {}


class RunMetrics(BaseModel):
    overall: MetricsSlice
    non_adversarial: MetricsSlice
    adversarial: MetricsSlice


class RunResult(BaseModel):
    run_metadata: RunMetadata
    metrics: RunMetrics
    predictions: list[CategorizationResult]


def _git_sha() -> str | None:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
            timeout=2,
        )
        if out.returncode == 0:
            return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None
    return None


def _slice(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
    *,
    valid_codes: set[str] | None = None,
    model_only_cost_per_100: float | None = None,
) -> MetricsSlice:
    # Restrict ground truth to the transactions present in this prediction slice.
    # Without this, per-category support/recall would count every transaction in
    # the full dataset even when scoring an adversarial-only subset, inflating
    # support and producing misleading recall numbers.
    pred_ids = {p.transaction_id for p in predictions}
    sliced_truth = {tx_id: code for tx_id, code in ground_truth.items() if tx_id in pred_ids}
    return MetricsSlice(
        accuracy=metrics.overall_accuracy(predictions, sliced_truth),
        per_category=metrics.per_category_precision_recall(predictions, sliced_truth),
        reliability_diagram=metrics.reliability_diagram(predictions, sliced_truth),
        latency_stats=metrics.latency_stats(predictions),
        total_cost=metrics.total_cost(predictions),
        cost_per_100=metrics.cost_per_100(predictions),
        transaction_count=len(predictions),
        top_confusions=metrics.confusion_pairs(predictions, sliced_truth, top_n=10),
        category_coverage=metrics.category_coverage(predictions, sliced_truth),
        routing=metrics.routing_metrics(
            predictions,
            sliced_truth,
            valid_codes=valid_codes,
            model_only_cost_per_100=model_only_cost_per_100,
        ),
        calibration=metrics.calibration_metrics(predictions, sliced_truth),
    )


def run_eval(dataset: Dataset, categorizer: Categorizer) -> RunResult:
    """Run a categorizer against an entire dataset and compute all metric slices.

    Iteration order is deterministic: businesses are sorted by id, transactions
    within each business are sorted by transaction id. Returns a RunResult with
    metadata, metrics for overall/non-adversarial/adversarial slices, and the
    complete list of per-transaction predictions.
    """
    predictions: list[CategorizationResult] = []
    all_transactions: list[Transaction] = []
    ground_truth: dict[str, str] = {}
    valid_codes: set[str] = set()

    for business_data, tx in dataset.iter_transactions():
        result = categorizer.categorize(
            transaction=tx,
            business=business_data.business,
            chart_of_accounts=business_data.chart_of_accounts,
        )
        predictions.append(result)
        all_transactions.append(tx)
        ground_truth[tx.id] = tx.proposed_category_code
        for account in business_data.chart_of_accounts:
            valid_codes.add(account.code)

    non_adv = metrics.subset_by_adversarial(predictions, all_transactions, adversarial=False)
    adv = metrics.subset_by_adversarial(predictions, all_transactions, adversarial=True)

    model_value = predictions[0].model if predictions else None

    return RunResult(
        run_metadata=RunMetadata(
            dataset_version=dataset.version,
            categorizer_name=categorizer.name,
            model=model_value,
            timestamp_utc=datetime.now(UTC).isoformat(timespec="seconds"),
            git_sha=_git_sha(),
        ),
        metrics=RunMetrics(
            overall=_slice(predictions, ground_truth, valid_codes=valid_codes),
            non_adversarial=_slice(non_adv, ground_truth, valid_codes=valid_codes),
            adversarial=_slice(adv, ground_truth, valid_codes=valid_codes),
        ),
        predictions=predictions,
    )
