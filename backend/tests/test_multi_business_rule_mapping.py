"""Multi-business mapped-rule coverage — coffee-shop + design-agency maps.

Asserts that PR #43's two new business maps register, route correctly
through `EVAL_BUSINESS_MAP_IDS`, expose the right COA codes, and
correctly honor the `block_fallback_intents` set (the new safety
mechanism that refuses the rule's seed-COA default when it would
silently miscategorize on the dataset COA).
"""

from __future__ import annotations

from ledgerlens.categorizers.rules import (
    EVAL_BUSINESS_MAP_IDS,
    RuleOnlyCategorizer,
    _resolve_eval_business_id,
)
from ledgerlens.data.business_rule_maps import (
    COFFEE_SHOP_EVAL_INTENT_MAP,
    DEFAULT_INTENT_MAP,
    DESIGN_AGENCY_EVAL_INTENT_MAP,
    get_business_rule_map,
)
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.services.rule_categorizer import Rule


def _make_business(business_id: str) -> Business:
    return Business(
        id=business_id,
        name="Test",
        industry="Test",
        description="",
        fiscal_year_start="01-01",
        typical_monthly_revenue_usd=None,
        notes=None,
    )


def _make_tx(tx_id: str, description: str) -> EvalTransaction:
    return EvalTransaction(
        id=tx_id,
        date="2026-03-14",
        amount_cents=-1000,
        raw_description=description,
        proposed_category_code="6070",
        label_confidence="high",
        is_adversarial=False,
        reasoning="",
        labeler_notes=None,
    )


def _coa(*codes_and_names: tuple[str, str]) -> list[Account]:
    return [
        Account(code=code, name=name, description="", parent_code=None, type="expense")
        for code, name in codes_and_names
    ]


# ── Registry ─────────────────────────────────────────────────────────────


def test_coffee_shop_business_id_registered() -> None:
    assert "coffee-shop" in EVAL_BUSINESS_MAP_IDS
    assert EVAL_BUSINESS_MAP_IDS["coffee-shop"] == "coffee_shop_eval"
    assert get_business_rule_map("coffee_shop_eval") is COFFEE_SHOP_EVAL_INTENT_MAP


def test_design_agency_business_id_registered() -> None:
    assert "design-agency" in EVAL_BUSINESS_MAP_IDS
    assert EVAL_BUSINESS_MAP_IDS["design-agency"] == "design_agency_eval"
    assert get_business_rule_map("design_agency_eval") is DESIGN_AGENCY_EVAL_INTENT_MAP


def test_unknown_business_id_falls_back_to_default() -> None:
    assert _resolve_eval_business_id(_make_business("nonexistent")) == "default"
    assert get_business_rule_map("nonexistent") is DEFAULT_INTENT_MAP


# ── Coffee-shop mapping ──────────────────────────────────────────────────


def test_coffee_shop_software_subscription_overrides_default() -> None:
    """Coffee-shop maps software_subscription to 6170 explicitly.
    Without the override, the rule's seed default (6070) would land
    in Payroll Service Fees on this COA — wrong."""
    rule = Rule(
        id="rule.intuit.software",
        name="Intuit",
        active=True,
        priority=100,
        match_type="merchant_contains",
        merchant_patterns=("INTUIT",),
        description_patterns=(),
        category_code="6070",
        confidence=0.95,
        explanation="",
        notes="",
        intent="software_subscription",
    )
    cat = RuleOnlyCategorizer(rules=[rule], use_business_mapping=True)
    biz = _make_business("coffee-shop")
    coa = _coa(("6070", "Payroll Service Fees"), ("6170", "Software Subscriptions"))
    pred = cat.categorize(_make_tx("t1", "INTUIT QUICKBOOKS"), biz, coa)
    assert pred.predicted_category_code == "6170"
    assert pred.mapping_outcome == "mapped"


def test_coffee_shop_blocks_meals_entertainment_fallback() -> None:
    """Coffee-shop's block_fallback_intents lists meals_entertainment.
    The Starbucks rule's seed default (6120) is Office Supplies on
    this COA. The categorizer must refuse the fallback and route to
    review, NOT silently classify Starbucks as Office Supplies."""
    rule = Rule(
        id="rule.starbucks.meals",
        name="Starbucks",
        active=True,
        priority=80,
        match_type="merchant_contains",
        merchant_patterns=("STARBUCKS",),
        description_patterns=(),
        category_code="6120",  # exists on coffee-shop COA, but as Office Supplies
        confidence=0.85,
        explanation="",
        notes="",
        intent="meals_entertainment",
    )
    cat = RuleOnlyCategorizer(rules=[rule], use_business_mapping=True)
    biz = _make_business("coffee-shop")
    coa = _coa(("6120", "Office Supplies"))  # rule's default code exists but means wrong thing
    pred = cat.categorize(_make_tx("t2", "STARBUCKS #1234"), biz, coa)
    assert pred.predicted_category_code == "UNCATEGORIZABLE"
    assert pred.mapping_outcome == "routed_to_review"


# ── Design-agency mapping ────────────────────────────────────────────────


def test_design_agency_software_subscription_overrides_default() -> None:
    """Design-agency maps software_subscription to 6140 (Other & AI
    Tools). Without the override, seed default 6070 would land in
    Merchant Processing Fees — wrong."""
    rule = Rule(
        id="rule.intuit.software",
        name="Intuit",
        active=True,
        priority=100,
        match_type="merchant_contains",
        merchant_patterns=("INTUIT",),
        description_patterns=(),
        category_code="6070",
        confidence=0.95,
        explanation="",
        notes="",
        intent="software_subscription",
    )
    cat = RuleOnlyCategorizer(rules=[rule], use_business_mapping=True)
    biz = _make_business("design-agency")
    coa = _coa(("6070", "Merchant Processing Fees"), ("6140", "Software - Other & AI Tools"))
    pred = cat.categorize(_make_tx("t3", "INTUIT QUICKBOOKS"), biz, coa)
    assert pred.predicted_category_code == "6140"
    assert pred.mapping_outcome == "mapped"


def test_design_agency_blocks_utilities_fallback() -> None:
    """Design-agency has no utilities account. block_fallback_intents
    lists `utilities` so a utility rule (default 6020) doesn't
    silently classify a utility bill as Owner Salary - N/A on this
    COA."""
    rule = Rule(
        id="rule.eversource.test",
        name="Eversource",
        active=True,
        priority=80,
        match_type="merchant_contains",
        merchant_patterns=("EVERSOURCE",),
        description_patterns=(),
        category_code="6020",  # default seed = Utilities; design-agency 6020 = Owner Salary
        confidence=0.92,
        explanation="",
        notes="",
        intent="utilities",
    )
    cat = RuleOnlyCategorizer(rules=[rule], use_business_mapping=True)
    biz = _make_business("design-agency")
    coa = _coa(("6020", "Owner Salary - N/A"))
    pred = cat.categorize(_make_tx("t4", "EVERSOURCE ELECTRIC"), biz, coa)
    assert pred.predicted_category_code == "UNCATEGORIZABLE"
    assert pred.mapping_outcome == "routed_to_review"


def test_design_agency_meals_entertainment_maps_cleanly() -> None:
    """Design-agency HAS a Meals & Entertainment account (6220), so
    Starbucks should land there, not be blocked."""
    rule = Rule(
        id="rule.starbucks.meals",
        name="Starbucks",
        active=True,
        priority=80,
        match_type="merchant_contains",
        merchant_patterns=("STARBUCKS",),
        description_patterns=(),
        category_code="6120",
        confidence=0.85,
        explanation="",
        notes="",
        intent="meals_entertainment",
    )
    cat = RuleOnlyCategorizer(rules=[rule], use_business_mapping=True)
    biz = _make_business("design-agency")
    coa = _coa(("6120", "Software - Project Management"), ("6220", "Meals & Entertainment"))
    pred = cat.categorize(_make_tx("t5", "STARBUCKS #1234"), biz, coa)
    assert pred.predicted_category_code == "6220"
    assert pred.mapping_outcome == "mapped"


# ── Block-fallback feature ───────────────────────────────────────────────


def test_block_fallback_intents_default_empty_set() -> None:
    """Existing maps without an explicit block list behave exactly as
    before — backward compatible."""
    assert DEFAULT_INTENT_MAP.block_fallback_intents == frozenset()


def test_block_fallback_method() -> None:
    """`is_fallback_blocked` exposes the right boolean."""
    assert COFFEE_SHOP_EVAL_INTENT_MAP.is_fallback_blocked("meals_entertainment") is True
    assert COFFEE_SHOP_EVAL_INTENT_MAP.is_fallback_blocked("software_subscription") is False
    assert DEFAULT_INTENT_MAP.is_fallback_blocked("meals_entertainment") is False
    assert DESIGN_AGENCY_EVAL_INTENT_MAP.is_fallback_blocked("payroll") is True
    assert DESIGN_AGENCY_EVAL_INTENT_MAP.is_fallback_blocked("utilities") is True


# ── Per-business mapping metrics aggregation ─────────────────────────────


def test_mapping_metrics_per_business_breakdown() -> None:
    """When `tx_to_business` is passed, mapping_metrics returns a
    `per_business` dict + a `summary` block."""
    from ledgerlens.categorizers.base import CategorizationResult
    from ledgerlens.evals.metrics import mapping_metrics

    predictions = [
        CategorizationResult(
            transaction_id="cs-1",
            predicted_category_code="6170",
            confidence=0.95,
            reasoning="",
            matched_rule_intent="software_subscription",
            mapping_outcome="mapped",
        ),
        CategorizationResult(
            transaction_id="da-1",
            predicted_category_code="6140",
            confidence=0.95,
            reasoning="",
            matched_rule_intent="software_subscription",
            mapping_outcome="mapped",
        ),
        CategorizationResult(
            transaction_id="ar-1",
            predicted_category_code="1050",
            confidence=0.92,
            reasoning="",
            matched_rule_intent="parts_inventory",
            mapping_outcome="mapped",
        ),
    ]
    truth = {"cs-1": "6170", "da-1": "9999", "ar-1": "1050"}
    tx_to_business = {"cs-1": "coffee-shop", "da-1": "design-agency", "ar-1": "auto-repair"}
    block = mapping_metrics(predictions, truth, tx_to_business=tx_to_business)
    assert "per_business" in block
    per_business = block["per_business"]
    assert isinstance(per_business, dict)
    assert set(per_business.keys()) == {"coffee-shop", "design-agency", "auto-repair"}
    # Coffee-shop: 1 mapped, 1 correct → tied with auto-repair (both 1 correct).
    # Coffee-shop sorts first alphabetically; sort key is (correct, mapped_count).
    summary = block["summary"]
    assert isinstance(summary, dict)
    assert summary["best_business_id"] in {"coffee-shop", "auto-repair"}
    assert summary["weakest_business_id"] == "design-agency"
