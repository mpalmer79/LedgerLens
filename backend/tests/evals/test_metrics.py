from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals import metrics
from ledgerlens.evals.schemas import Transaction


def _result(
    tx_id: str,
    code: str,
    confidence: float = 0.5,
    cost: float = 0.0,
    latency: float = 0.0,
) -> CategorizationResult:
    return CategorizationResult(
        transaction_id=tx_id,
        predicted_category_code=code,
        confidence=confidence,
        reasoning="t",
        cost_usd=cost,
        latency_ms=latency,
    )


def _tx(tx_id: str, code: str, adversarial: bool = False) -> Transaction:
    return Transaction(
        id=tx_id,
        date="2025-07-01",
        amount_cents=-1000,
        raw_description="TEST",
        proposed_category_code=code,
        label_confidence="high",
        is_adversarial=adversarial,
        reasoning="t",
    )


def test_overall_accuracy_two_of_three() -> None:
    preds = [_result("a", "6010"), _result("b", "6020"), _result("c", "6030")]
    truth = {"a": "6010", "b": "6020", "c": "9999"}
    assert metrics.overall_accuracy(preds, truth) == 2 / 3


def test_overall_accuracy_empty_returns_zero() -> None:
    assert metrics.overall_accuracy([], {}) == 0.0


def test_per_category_precision_recall_known_confusion() -> None:
    # Ground truth: a,b,c -> 6010; d,e -> 6020.
    # Predictions: a,b -> 6010 (right); c -> 6020 (wrong); d -> 6020 (right); e -> 6010 (wrong).
    # 6010: TP=2 (a,b), predicted=3 (a,b,e), actual=3 -> p=2/3, r=2/3
    # 6020: TP=1 (d),   predicted=2 (c,d),   actual=2 -> p=1/2, r=1/2
    preds = [
        _result("a", "6010"),
        _result("b", "6010"),
        _result("c", "6020"),
        _result("d", "6020"),
        _result("e", "6010"),
    ]
    truth = {"a": "6010", "b": "6010", "c": "6010", "d": "6020", "e": "6020"}
    out = metrics.per_category_precision_recall(preds, truth)
    assert out["6010"]["precision"] == 2 / 3
    assert out["6010"]["recall"] == 2 / 3
    assert out["6010"]["support"] == 3.0
    assert out["6020"]["precision"] == 0.5
    assert out["6020"]["recall"] == 0.5
    assert out["6020"]["support"] == 2.0


def test_reliability_diagram_two_buckets() -> None:
    preds = [
        _result("a", "X", confidence=0.05),
        _result("b", "X", confidence=0.07),
        _result("c", "Y", confidence=0.95),
        _result("d", "Y", confidence=0.99),
    ]
    truth = {"a": "X", "b": "X", "c": "Y", "d": "Z"}  # a,b,c correct; d wrong
    diagram = metrics.reliability_diagram(preds, truth, num_buckets=10)
    assert len(diagram) == 10
    first = diagram[0]
    last = diagram[-1]
    assert first["count"] == 2
    assert first["actual_accuracy"] == 1.0
    assert last["count"] == 2
    assert last["actual_accuracy"] == 0.5
    # An empty middle bucket
    middle = diagram[4]
    assert middle["count"] == 0
    assert middle["actual_accuracy"] == 0.0


def test_latency_stats_known_list() -> None:
    preds = [_result(f"t{i}", "X", latency=float(i)) for i in [10, 20, 30, 40, 50]]
    stats = metrics.latency_stats(preds)
    # nearest-rank: p50 -> index int(5*0.5)=2 -> 30; p95 -> index int(5*0.95)=4 -> 50
    assert stats["p50_ms"] == 30.0
    assert stats["p95_ms"] == 50.0
    assert stats["mean_ms"] == 30.0


def test_latency_stats_empty() -> None:
    assert metrics.latency_stats([]) == {"p50_ms": 0.0, "p95_ms": 0.0, "mean_ms": 0.0}


def test_cost_per_100_known_total() -> None:
    preds = [_result(f"t{i}", "X", cost=0.001) for i in range(50)]
    assert metrics.total_cost(preds) == 0.05
    assert metrics.cost_per_100(preds) == 0.10


def test_cost_per_100_empty() -> None:
    assert metrics.cost_per_100([]) == 0.0


def test_subset_by_adversarial_filters_correctly() -> None:
    preds = [_result("a", "X"), _result("b", "X"), _result("c", "X")]
    txs = [_tx("a", "X", adversarial=True), _tx("b", "X"), _tx("c", "X", adversarial=True)]
    adv = metrics.subset_by_adversarial(preds, txs, adversarial=True)
    non_adv = metrics.subset_by_adversarial(preds, txs, adversarial=False)
    assert [p.transaction_id for p in adv] == ["a", "c"]
    assert [p.transaction_id for p in non_adv] == ["b"]
