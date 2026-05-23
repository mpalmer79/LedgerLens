"""Session-15 metric upgrades: sliced regression, F1, confusion pairs,
category coverage, routing, calibration. The pre-existing tests in
`test_metrics.py` still cover the legacy paths; this file adds the new
behaviours and a regression for the sliced-metric bug.
"""

from __future__ import annotations

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals import metrics
from ledgerlens.evals.harness import _slice
from ledgerlens.evals.schemas import Transaction


def _result(
    tx_id: str,
    code: str,
    confidence: float = 0.5,
    cost: float = 0.0,
    latency: float = 0.0,
    model: str | None = None,
    reasoning: str = "t",
) -> CategorizationResult:
    return CategorizationResult(
        transaction_id=tx_id,
        predicted_category_code=code,
        confidence=confidence,
        reasoning=reasoning,
        cost_usd=cost,
        latency_ms=latency,
        model=model,
    )


def _tx(tx_id: str, code: str, adversarial: bool = False) -> Transaction:
    return Transaction(
        id=tx_id,
        date="2026-03-14",
        amount_cents=-100,
        raw_description="TEST",
        proposed_category_code=code,
        label_confidence="high",
        is_adversarial=adversarial,
        reasoning="t",
    )


# ── Sliced metric regression ──────────────────────────────────────────────


def test_sliced_metrics_use_sliced_ground_truth() -> None:
    """The original bug: harness passed the *full* ground truth to per-category
    metrics, so support and recall on the adversarial slice reflected the
    whole dataset, not the slice.

    Setup: 5 non-adversarial Adobe transactions all correct + 1 adversarial
    Stripe transaction. The adversarial slice contains only Stripe; its
    support for "6070" must be 0, not 5.
    """
    preds = [_result(f"non{i}", "6070", confidence=0.95) for i in range(5)]
    preds.append(_result("adv1", "6100", confidence=0.95))
    full_truth = {f"non{i}": "6070" for i in range(5)}
    full_truth["adv1"] = "6100"

    adv_only = [p for p in preds if p.transaction_id == "adv1"]
    sliced = _slice(adv_only, full_truth)
    assert sliced.transaction_count == 1
    # 6070 must NOT appear in the sliced per-category metrics at all because
    # no transaction in the slice has it as actual OR predicted.
    assert "6070" not in sliced.per_category
    # 6100's support is 1 in the slice, not whatever it was in the full set.
    assert sliced.per_category["6100"]["support"] == 1.0


# ── F1 / confusion pairs / category coverage ──────────────────────────────


def test_per_category_includes_f1_and_error_counts() -> None:
    preds = [
        _result("a", "6010"),
        _result("b", "6010"),
        _result("c", "6020"),
    ]
    truth = {"a": "6010", "b": "6020", "c": "6010"}
    out = metrics.per_category_precision_recall(preds, truth)
    # 6010: TP=1 (a), predicted=2 (a,b), actual=2 (a,c) → p=0.5, r=0.5, F1=0.5
    assert out["6010"]["precision"] == 0.5
    assert out["6010"]["recall"] == 0.5
    assert out["6010"]["f1"] == 0.5
    assert out["6010"]["false_positives"] == 1.0
    assert out["6010"]["false_negatives"] == 1.0


def test_confusion_pairs_off_diagonal_only_when_top_n() -> None:
    preds = [
        _result("a", "6010"),  # correct
        _result("b", "6010"),  # correct
        _result("c", "6020"),  # wrong (actual 6010)
        _result("d", "6020"),  # correct
    ]
    truth = {"a": "6010", "b": "6010", "c": "6010", "d": "6020"}
    full = metrics.confusion_pairs(preds, truth)
    # Full matrix should include the diagonal (6010,6010)=2 and (6020,6020)=1.
    assert {(e["actual"], e["predicted"], int(e["count"])) for e in full} == {
        ("6010", "6010", 2),
        ("6010", "6020", 1),
        ("6020", "6020", 1),
    }
    top = metrics.confusion_pairs(preds, truth, top_n=5)
    # The off-diagonal pair must be present and the diagonal must not.
    pairs = {(e["actual"], e["predicted"]) for e in top}
    assert ("6010", "6020") in pairs
    assert ("6010", "6010") not in pairs


def test_category_coverage_finds_never_predicted_and_zero_recall() -> None:
    preds = [
        _result("a", "6010"),  # correct
        _result("b", "6010"),  # wrong (actual 6020)
    ]
    truth = {"a": "6010", "b": "6020", "c": "6030"}  # 6030 has no prediction
    cov = metrics.category_coverage(preds, truth)
    assert "6030" in cov["never_predicted"]  # type: ignore[operator]
    # 6020 has support 1, recall 0 (never predicted correctly)
    assert "6020" in cov["zero_recall"]  # type: ignore[operator]
    assert cov["categories_in_truth_count"] == 3


# ── Routing classification ────────────────────────────────────────────────


def test_classify_routing_outcome_handles_all_branches() -> None:
    valid = {"6010", "6020"}
    # Uncategorizable sentinel
    p = _result("u", "UNCATEGORIZABLE", confidence=0.0)
    assert metrics.classify_routing_outcome(p, valid) == "uncategorizable"
    # Provider error encoded in reasoning → failed
    p = _result("e", "UNCATEGORIZABLE", confidence=0.0, reasoning="Anthropic APIError")
    assert metrics.classify_routing_outcome(p, valid) == "failed"
    # Unknown code → needs_review even at high confidence
    p = _result("k", "9999", confidence=0.99)
    assert metrics.classify_routing_outcome(p, valid) == "needs_review"
    # Auto-approved
    p = _result("a", "6010", confidence=0.95)
    assert metrics.classify_routing_outcome(p, valid) == "auto_approved"
    # Needs review (mid)
    p = _result("m", "6010", confidence=0.7)
    assert metrics.classify_routing_outcome(p, valid) == "needs_review"


def test_routing_metrics_counts_and_provider_split() -> None:
    valid = {"6010", "6070", "6100"}
    preds = [
        # Auto-approved correct via the model
        _result("a", "6010", confidence=0.95, cost=0.001, model="claude-haiku"),
        # Auto-approved wrong via the model
        _result("b", "6010", confidence=0.95, cost=0.001, model="claude-haiku"),
        # Rule (deterministic) auto-approved correct
        _result("c", "6070", confidence=0.95, cost=0.0, model="rule.adobe.software"),
        # Below review threshold → needs_review
        _result("d", "6010", confidence=0.4, cost=0.001, model="claude-haiku"),
        # Sentinel
        _result("u", "UNCATEGORIZABLE", confidence=0.0, model="claude-haiku"),
    ]
    truth = {"a": "6010", "b": "6020", "c": "6070", "d": "6010", "u": "6100"}
    routing = metrics.routing_metrics(preds, truth, valid_codes=valid)
    assert routing["total"] == 5
    assert routing["auto_approved"] == 3
    assert routing["needs_review"] == 1
    assert routing["uncategorizable"] == 1
    # auto-approved accuracy: 2 of 3 (a + c)
    assert routing["auto_approved_accuracy"] == 2 / 3
    # provider split
    assert routing["by_provider"]["model"] == 3  # a, b, d (cost>0); u has cost 0
    # u has cost 0 and model="claude-haiku" → deterministic_other (not what we want
    # semantically, but it's an honest classification)
    assert routing["by_provider"]["rule_categorizer"] == 1
    # zero_cost includes c (rule) and u (no-cost sentinel)
    assert routing["zero_cost"] == 2


def test_routing_metrics_cost_savings_vs_baseline() -> None:
    valid = {"6010"}
    preds = [
        _result(f"t{i}", "6010", confidence=0.95, cost=0.002, model="claude-haiku")
        for i in range(50)
    ]
    truth = {f"t{i}": "6010" for i in range(50)}
    # Baseline of $1.00/100; we cost (0.002 * 50 / 50) * 100 = $0.20/100.
    routing = metrics.routing_metrics(preds, truth, valid_codes=valid, model_only_cost_per_100=1.00)
    assert routing["cost_per_100"] == 0.2
    assert routing["cost_per_100_model_only_baseline"] == 1.00
    assert routing["cost_savings_per_100"] == 0.8


# ── Calibration ───────────────────────────────────────────────────────────


def test_calibration_separates_model_and_deterministic() -> None:
    # Model predictions in the [0.9, 1.0] bucket, half wrong.
    model_preds = [
        _result(
            f"m{i}", "6010" if i < 3 else "WRONG", confidence=0.95, cost=0.001, model="claude-haiku"
        )
        for i in range(6)
    ]
    # Deterministic rule predictions, all correct, at confidence 0.95.
    rule_preds = [
        _result(f"r{i}", "6010", confidence=0.95, cost=0.0, model="rule.test") for i in range(4)
    ]
    all_preds = model_preds + rule_preds
    truth = {f"m{i}": "6010" for i in range(6)} | {f"r{i}": "6010" for i in range(4)}

    cal = metrics.calibration_metrics(all_preds, truth)
    # Model-only block sees the miscalibration: 50% acc at 0.95 confidence.
    model_block = cal["model_only"]
    assert model_block["count"] == 6  # type: ignore[index]
    assert model_block["warning"] is not None  # type: ignore[index]
    # Deterministic block is "perfect" by design (rules always right in this
    # toy setup), so no warning.
    det_block = cal["deterministic"]
    assert det_block["count"] == 4  # type: ignore[index]
    assert det_block["warning"] is None  # type: ignore[index]


def test_calibration_ece_is_weighted_average() -> None:
    # Two confidence buckets: low (0.05, acc=1.0, gap=0.95) of count 2, and
    # high (0.95, acc=0.5, gap=0.45) of count 4. ECE = (2*0.95 + 4*0.45)/6 = 0.6167
    preds = [
        _result("a", "X", confidence=0.05),
        _result("b", "X", confidence=0.05),
        _result("c", "X", confidence=0.95),
        _result("d", "X", confidence=0.95),
        _result("e", "Y", confidence=0.95),
        _result("f", "Y", confidence=0.95),
    ]
    truth = {"a": "X", "b": "X", "c": "X", "d": "X", "e": "X", "f": "X"}
    cal = metrics.calibration_metrics(preds, truth)
    overall = cal["overall"]
    assert abs(float(overall["ece"]) - ((2 * 0.95 + 4 * 0.45) / 6)) < 0.001  # type: ignore[index]
    # MCE is the worst single bucket gap (0.95).
    assert abs(float(overall["mce"]) - 0.95) < 0.001  # type: ignore[index]
