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
) -> MetricsSlice:
    return MetricsSlice(
        accuracy=metrics.overall_accuracy(predictions, ground_truth),
        per_category=metrics.per_category_precision_recall(predictions, ground_truth),
        reliability_diagram=metrics.reliability_diagram(predictions, ground_truth),
        latency_stats=metrics.latency_stats(predictions),
        total_cost=metrics.total_cost(predictions),
        cost_per_100=metrics.cost_per_100(predictions),
        transaction_count=len(predictions),
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

    for business_data, tx in dataset.iter_transactions():
        result = categorizer.categorize(
            transaction=tx,
            business=business_data.business,
            chart_of_accounts=business_data.chart_of_accounts,
        )
        predictions.append(result)
        all_transactions.append(tx)
        ground_truth[tx.id] = tx.proposed_category_code

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
            overall=_slice(predictions, ground_truth),
            non_adversarial=_slice(non_adv, ground_truth),
            adversarial=_slice(adv, ground_truth),
        ),
        predictions=predictions,
    )
