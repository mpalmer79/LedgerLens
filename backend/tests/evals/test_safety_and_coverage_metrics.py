"""Tests for safety metrics, enriched confusion pairs, coverage, and report."""

from __future__ import annotations

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals.metrics import (
    coverage_by_provider,
    enriched_confusion_pairs,
    safety_metrics,
    unmatched_vendor_report,
)
from ledgerlens.evals.report import generate_eval_report
from ledgerlens.evals.schemas import Transaction


def _pred(
    tx_id: str,
    code: str,
    confidence: float = 0.95,
    model: str = "rule.test",
    cost: float = 0.0,
) -> CategorizationResult:
    return CategorizationResult(
        transaction_id=tx_id,
        predicted_category_code=code,
        confidence=confidence,
        reasoning="test",
        alternative_category_code=None,
        model=model,
        latency_ms=1,
        cost_usd=cost,
    )


def _tx(tx_id: str, desc: str) -> Transaction:
    return Transaction(
        id=tx_id,
        date="2026-03-15",
        amount_cents=-5000,
        raw_description=desc,
        proposed_category_code="5010",
        label_confidence="high",
        is_adversarial=False,
        reasoning="",
        labeler_notes=None,
    )


class TestSafetyMetrics:
    def test_correct_finalized_counted(self) -> None:
        preds = [_pred("tx1", "5010", 0.95)]
        gt = {"tx1": "5010"}
        result = safety_metrics(preds, gt)
        assert result["correct_finalized"] == 1
        assert result["incorrect_finalized"] == 0

    def test_incorrect_finalized_counted(self) -> None:
        preds = [_pred("tx1", "6020", 0.95)]
        gt = {"tx1": "5010"}
        result = safety_metrics(preds, gt)
        assert result["incorrect_finalized"] == 1
        assert result["correct_finalized"] == 0

    def test_review_routed_not_counted_as_finalized(self) -> None:
        preds = [_pred("tx1", "6020", 0.70)]
        gt = {"tx1": "5010"}
        result = safety_metrics(preds, gt)
        assert result["incorrect_finalized"] == 0
        assert result["incorrect_review_routed"] == 1
        assert result["review_routing_saved_from_mistake"] == 1

    def test_finalized_accuracy(self) -> None:
        preds = [
            _pred("tx1", "5010", 0.95),
            _pred("tx2", "6020", 0.95),
        ]
        gt = {"tx1": "5010", "tx2": "5010"}
        result = safety_metrics(preds, gt)
        assert result["finalized_accuracy"] == 0.5

    def test_empty_predictions(self) -> None:
        result = safety_metrics([], {})
        assert result["total"] == 0
        assert result["finalized_accuracy"] == 1.0


class TestEnrichedConfusionPairs:
    def test_separates_finalized_from_review(self) -> None:
        preds = [
            _pred("tx1", "6020", 0.95),
            _pred("tx2", "6020", 0.70),
        ]
        gt = {"tx1": "5010", "tx2": "5010"}
        pairs = enriched_confusion_pairs(preds, gt)
        assert len(pairs) == 1
        pair = pairs[0]
        assert pair["actual"] == "5010"
        assert pair["predicted"] == "6020"
        assert pair["count"] == 2
        assert pair["finalized_count"] == 1
        assert pair["review_routed_count"] == 1

    def test_correct_predictions_excluded(self) -> None:
        preds = [_pred("tx1", "5010", 0.95)]
        gt = {"tx1": "5010"}
        pairs = enriched_confusion_pairs(preds, gt)
        assert len(pairs) == 0


class TestCoverageByProvider:
    def test_separates_providers(self) -> None:
        preds = [
            _pred("tx1", "5010", model="rule.napa"),
            _pred("tx2", "6020", model="rule.adp"),
            _pred("tx3", "6070", model="claude-haiku", cost=0.001),
        ]
        result = coverage_by_provider(preds)
        assert result["total"] == 3
        by = result["by_provider"]
        assert isinstance(by, dict)
        assert by["rule_categorizer"]["count"] == 2
        assert by["model"]["count"] == 1
        assert result["zero_cost_count"] == 2

    def test_zero_cost_percentage(self) -> None:
        preds = [_pred("tx1", "5010", model="rule.napa")]
        result = coverage_by_provider(preds)
        assert result["zero_cost_percentage"] == 1.0


class TestUnmatchedVendorReport:
    def test_rule_matched_vendors_excluded(self) -> None:
        preds = [_pred("tx1", "5010", model="rule.napa")]
        txs = [_tx("tx1", "NAPA AUTO PARTS")]
        gt = {"tx1": "5010"}
        report = unmatched_vendor_report(preds, gt, txs)
        assert len(report) == 0

    def test_model_fallback_vendors_included(self) -> None:
        preds = [_pred("tx1", "6020", model="claude-haiku", cost=0.001)]
        txs = [_tx("tx1", "UNKNOWN VENDOR ABC")]
        gt = {"tx1": "6020"}
        report = unmatched_vendor_report(preds, gt, txs)
        assert len(report) == 1
        assert report[0]["count"] == 1


class TestReportGeneration:
    def test_report_is_valid_markdown(self) -> None:
        preds = [
            _pred("tx1", "5010", 0.95, model="rule.napa"),
            _pred("tx2", "6020", 0.70, model="claude-haiku", cost=0.001),
        ]
        gt = {"tx1": "5010", "tx2": "5010"}
        txs = [
            _tx("tx1", "NAPA AUTO PARTS"),
            _tx("tx2", "UNKNOWN VENDOR"),
        ]
        report = generate_eval_report(preds, gt, txs, mode="test")
        assert report.startswith("# LedgerLens eval report")
        assert "## Accuracy" in report
        assert "## Safety" in report
        assert "## Coverage by provider" in report
        assert "## Routing" in report
        assert "## Limitations" in report

    def test_report_does_not_claim_production_accuracy(self) -> None:
        report = generate_eval_report([], {}, [], mode="test")
        report_lower = report.lower()
        assert "100% accurate" not in report_lower
        assert "safe for real bank" not in report_lower
        assert "true accounting ledger" not in report_lower
        assert "does not claim" in report_lower

    def test_report_explains_limitations(self) -> None:
        report = generate_eval_report([], {}, [], mode="test")
        assert "COA mismatch" in report
        assert "not a rule-layer defect" in report
