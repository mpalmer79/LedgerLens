"""Hybrid categorizers (rules→model and memory→rules→model) for the eval harness."""

from __future__ import annotations

import pytest

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.categorizers.hybrid import (
    HybridMemoryRulesModelCategorizer,
    HybridRulesModelCategorizer,
    deterministic_train_test_split,
)
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction


def _coa() -> list[Account]:
    return [
        Account(code="6070", name="Software", description="", parent_code=None, type="expense"),
        Account(code="6100", name="Fees", description="", parent_code=None, type="expense"),
        Account(code="6130", name="Fuel", description="", parent_code=None, type="expense"),
        Account(code="6010", name="Rent", description="", parent_code=None, type="expense"),
    ]


def _biz() -> Business:
    return Business(
        id="b1",
        name="Test Co",
        industry="general",
        description="",
        fiscal_year_start="01-01",
    )


def _tx(tx_id: str, raw: str, code: str = "6010") -> EvalTransaction:
    return EvalTransaction(
        id=tx_id,
        date="2026-03-14",
        amount_cents=-100,
        raw_description=raw,
        proposed_category_code=code,
        label_confidence="high",
        is_adversarial=False,
        reasoning="t",
    )


class _ScriptedModel:
    """Returns a pre-set prediction so we can detect whether the model was called."""

    name = "scripted-model"

    def __init__(self, code: str = "6010", confidence: float = 0.8) -> None:
        self.code = code
        self.confidence = confidence
        self.calls = 0

    def categorize(
        self,
        transaction: EvalTransaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        self.calls += 1
        return CategorizationResult(
            transaction_id=transaction.id,
            predicted_category_code=self.code,
            confidence=self.confidence,
            reasoning="model fallback",
            alternative_category_code=None,
            cost_usd=0.002,
            latency_ms=120.0,
            model="scripted-model-v1",
        )


# ── Rules → model ─────────────────────────────────────────────────────────


def test_hybrid_uses_rule_when_above_auto_threshold() -> None:
    model = _ScriptedModel()
    hybrid = HybridRulesModelCategorizer(model=model)
    res = hybrid.categorize(_tx("a", "ADOBE CREATIVE CLOUD MO"), _biz(), _coa())
    # Adobe rule has confidence 0.95 ≥ 0.9 → rule wins, model NOT called.
    assert res.predicted_category_code == "6070"
    assert res.cost_usd == 0.0
    assert res.model == "rule.adobe.software"
    assert model.calls == 0


def test_hybrid_falls_through_to_model_on_no_rule_match() -> None:
    model = _ScriptedModel(code="6010", confidence=0.95)
    hybrid = HybridRulesModelCategorizer(model=model)
    res = hybrid.categorize(_tx("a", "OBSCURE INDIE VENDOR LLC"), _biz(), _coa())
    assert res.predicted_category_code == "6010"
    assert res.cost_usd == 0.002
    assert res.model == "scripted-model-v1"
    assert model.calls == 1


def test_hybrid_falls_through_when_rule_below_auto_threshold() -> None:
    """The Amazon rule has confidence 0.4 (below 0.9 auto) — must NOT win."""
    model = _ScriptedModel(code="6010", confidence=0.95)
    hybrid = HybridRulesModelCategorizer(model=model)
    res = hybrid.categorize(_tx("a", "AMAZON BUSINESS ORDER 11"), _biz(), _coa())
    assert res.model == "scripted-model-v1"
    assert model.calls == 1


# ── Memory → rules → model ────────────────────────────────────────────────


def test_train_test_split_is_deterministic_and_disjoint() -> None:
    txs = [_tx(f"t{i}", f"VENDOR_{i}", code="6010") for i in range(20)]
    train1, test1 = deterministic_train_test_split(txs, test_fraction=0.2, seed=1234)
    train2, test2 = deterministic_train_test_split(txs, test_fraction=0.2, seed=1234)
    assert {t.id for t in train1} == {t.id for t in train2}
    assert {t.id for t in test1} == {t.id for t in test2}
    assert not ({t.id for t in train1} & {t.id for t in test1})
    assert len(train1) + len(test1) == 20


def test_memory_hybrid_replays_training_label_on_matching_test_tx() -> None:
    # Training has one Adobe at 6010 (a deliberately-wrong code so we can tell
    # the simulated memory replayed it, rather than the rule layer kicking in
    # with the canonical 6070 mapping).
    training = [_tx("train-adobe", "ADOBE CC ANNUAL", code="6010")]
    test_tx = _tx("test-adobe", "ADOBE CC MONTHLY", code="6070")
    model = _ScriptedModel(code="6100", confidence=0.95)
    hybrid = HybridMemoryRulesModelCategorizer(model, training_transactions=training)
    res = hybrid.categorize(test_tx, _biz(), _coa())
    # Memory wins with the training label (6010), model NOT called.
    assert res.predicted_category_code == "6010"
    assert res.cost_usd == 0.0
    assert res.model and res.model.startswith("mem_")
    assert model.calls == 0


def test_memory_hybrid_refuses_to_categorize_a_training_id() -> None:
    """Hard guard against label leakage: same id must never be categorised."""
    training = [_tx("dup", "ADOBE CC", code="6010")]
    test_tx = _tx("dup", "ADOBE CC", code="6070")  # same id on purpose
    model = _ScriptedModel()
    hybrid = HybridMemoryRulesModelCategorizer(model, training_transactions=training)
    with pytest.raises(ValueError):
        hybrid.categorize(test_tx, _biz(), _coa())


def test_memory_hybrid_falls_through_when_no_memory_match() -> None:
    training = [_tx("train1", "STAPLES STORE 9", code="6100")]
    test_tx = _tx("test1", "OBSCURE VENDOR", code="6010")
    model = _ScriptedModel(code="6010", confidence=0.95)
    hybrid = HybridMemoryRulesModelCategorizer(model, training_transactions=training)
    res = hybrid.categorize(test_tx, _biz(), _coa())
    assert res.model == "scripted-model-v1"
    assert model.calls == 1


def test_memory_hybrid_ignores_generic_merchant_training_examples() -> None:
    # An "ACH TRANSFER" training row should NOT seed memory — generic merchants
    # are intentionally blocked.
    training = [_tx("train1", "ACH TRANSFER REF 99", code="6010")]
    test_tx = _tx("test1", "ACH TRANSFER REF 88", code="6010")
    model = _ScriptedModel(code="6100", confidence=0.95)
    hybrid = HybridMemoryRulesModelCategorizer(model, training_transactions=training)
    res = hybrid.categorize(test_tx, _biz(), _coa())
    # No memory entry → rule layer doesn't match either → model fallback.
    assert res.model == "scripted-model-v1"
