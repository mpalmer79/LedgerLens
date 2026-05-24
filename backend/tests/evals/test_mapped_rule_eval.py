"""Eval-side mapped rule categorizer + harness mapping metrics.

Asserts:

- New `rules-only-mapped` and `hybrid-rules-model-mapped` modes register.
- `RuleOnlyCategorizer(use_business_mapping=True)` resolves intents
  through the business map and stamps `matched_rule_intent` +
  `mapping_outcome` on each prediction.
- Auto-repair eval dataset maps `parts_inventory → 1050` even though the
  rule's own `category_code` (5010) is not on the auto-repair COA.
- A matched rule with no business mapping override + a valid default
  `category_code` falls back; outcome is recorded as `fallback_to_default`.
- A matched rule with no mapping AND an invalid default code routes the
  row to review (`routed_to_review`).
- Harness `mapping_metrics` aggregates outcomes correctly.
"""

from __future__ import annotations

from ledgerlens.categorizers.rules import RuleOnlyCategorizer
from ledgerlens.evals import metrics
from ledgerlens.evals.run import CATEGORIZERS
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.services.rule_categorizer import Rule


def _make_business(business_id: str) -> Business:
    return Business(
        id=business_id,
        name="Test Business",
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


# ── Mode registration ────────────────────────────────────────────────────


def test_new_modes_registered() -> None:
    assert "rules-only-mapped" in CATEGORIZERS
    assert "hybrid-rules-model-mapped" in CATEGORIZERS
    assert "rules-only" in CATEGORIZERS  # generic baseline preserved
    assert "hybrid-rules-model" in CATEGORIZERS


def test_mapped_categorizer_name_distinct() -> None:
    """Two RuleOnlyCategorizer instances must produce distinct artifact names
    so eval runs don't clobber each other."""
    plain = RuleOnlyCategorizer()
    mapped = RuleOnlyCategorizer(use_business_mapping=True)
    assert plain.name == "rule-categorizer-v1"
    assert mapped.name == "rule-categorizer-mapped-v1"


# ── Mapping resolves intent → dataset COA ────────────────────────────────


def test_mapped_resolves_parts_inventory_to_auto_repair_coa() -> None:
    """A rule for NAPA carries intent=parts_inventory, default code 5010.
    On the auto-repair eval COA (no 5010, but 1050 Inventory - Parts), the
    mapped categorizer should resolve to 1050 — outcome `mapped`."""
    napa_rule = Rule(
        id="rule.napa.test",
        name="NAPA",
        active=True,
        priority=80,
        match_type="merchant_contains",
        merchant_patterns=("NAPA",),
        description_patterns=(),
        category_code="5010",  # not on the auto-repair eval COA
        confidence=0.92,
        explanation="",
        notes="",
        intent="parts_inventory",
    )
    cat = RuleOnlyCategorizer(rules=[napa_rule], use_business_mapping=True)
    biz = _make_business("auto-repair")  # routes to AUTO_REPAIR_EVAL map
    coa = _coa(
        ("1050", "Inventory - Parts (Resale)"),
        ("5010", "COGS - Parts"),
    )
    # Even though 5010 IS in the COA above, the mapping (1050) should win.
    pred = cat.categorize(_make_tx("t1", "NAPA AUTO PARTS"), biz, coa)
    assert pred.predicted_category_code == "1050"
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.mapping_outcome == "mapped"


def test_mapping_fallback_to_default_when_no_override() -> None:
    """A rule with no business-mapping entry for its intent falls back to
    the rule's own category_code, which validates against the dataset COA.
    Outcome: `fallback_to_default`."""
    # Make up an intent the auto-repair map doesn't cover.
    weird_rule = Rule(
        id="rule.x.weird",
        name="X",
        active=True,
        priority=50,
        match_type="merchant_contains",
        merchant_patterns=("WEIRD",),
        description_patterns=(),
        category_code="6190",  # Software Subscriptions on auto-repair COA
        confidence=0.88,
        explanation="",
        notes="",
        intent="tax_planning_special",  # not in any business map
    )
    cat = RuleOnlyCategorizer(rules=[weird_rule], use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("6190", "Software Subscriptions"))
    pred = cat.categorize(_make_tx("t2", "WEIRD VENDOR"), biz, coa)
    assert pred.predicted_category_code == "6190"
    assert pred.matched_rule_intent == "tax_planning_special"
    assert pred.mapping_outcome == "fallback_to_default"


def test_mapping_routes_to_review_when_no_override_and_default_invalid() -> None:
    """A matched rule whose intent has no override AND whose own
    category_code doesn't exist on the dataset COA must route to review
    (predict UNCATEGORIZABLE), not pick a wrong code. Outcome:
    `routed_to_review`."""
    orphan_rule = Rule(
        id="rule.x.orphan",
        name="X",
        active=True,
        priority=50,
        match_type="merchant_contains",
        merchant_patterns=("ORPHAN",),
        description_patterns=(),
        category_code="9999",  # not on the dataset COA
        confidence=0.88,
        explanation="",
        notes="",
        intent="some_random_intent_not_in_any_map",
    )
    cat = RuleOnlyCategorizer(rules=[orphan_rule], use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("6190", "Software Subscriptions"))  # 9999 not here
    pred = cat.categorize(_make_tx("t3", "ORPHAN VENDOR"), biz, coa)
    assert pred.predicted_category_code == "UNCATEGORIZABLE"
    assert pred.mapping_outcome == "routed_to_review"
    assert pred.matched_rule_intent == "some_random_intent_not_in_any_map"


def test_unmapped_business_uses_default_intent_map() -> None:
    """A dataset business id that isn't in EVAL_BUSINESS_MAP_IDS falls
    through to the DEFAULT_INTENT_MAP (which covers software_subscription
    → 6070)."""
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
    biz = _make_business("design-agency")  # not in EVAL_BUSINESS_MAP_IDS
    coa = _coa(("6070", "Software Subscriptions"))
    pred = cat.categorize(_make_tx("t4", "INTUIT QUICKBOOKS"), biz, coa)
    assert pred.predicted_category_code == "6070"
    # Default map resolves software_subscription → 6070, same as the rule's
    # own code → outcome reads `fallback_to_default` (no override fired).
    assert pred.mapping_outcome == "fallback_to_default"


# ── Generic (non-mapped) baseline is unchanged ───────────────────────────


def test_generic_categorizer_does_not_carry_mapping_provenance() -> None:
    """Without `use_business_mapping=True`, predictions must not carry
    `matched_rule_intent` or `mapping_outcome` — preserves backward
    compatibility with existing run artifacts."""
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
    cat = RuleOnlyCategorizer(rules=[rule], use_business_mapping=False)
    biz = _make_business("design-agency")
    coa = _coa(("6070", "Software"))
    pred = cat.categorize(_make_tx("t5", "INTUIT QUICKBOOKS"), biz, coa)
    assert pred.matched_rule_intent is None
    assert pred.mapping_outcome is None


# ── Harness aggregates mapping_metrics ───────────────────────────────────


def test_mapping_metrics_aggregates_outcomes() -> None:
    from ledgerlens.categorizers.base import CategorizationResult

    predictions = [
        CategorizationResult(
            transaction_id="t1",
            predicted_category_code="1050",
            confidence=0.92,
            reasoning="",
            matched_rule_intent="parts_inventory",
            mapping_outcome="mapped",
        ),
        CategorizationResult(
            transaction_id="t2",
            predicted_category_code="6070",
            confidence=0.95,
            reasoning="",
            matched_rule_intent="software_subscription",
            mapping_outcome="fallback_to_default",
        ),
        CategorizationResult(
            transaction_id="t3",
            predicted_category_code="UNCATEGORIZABLE",
            confidence=0.0,
            reasoning="",
            matched_rule_intent="weird_intent",
            mapping_outcome="routed_to_review",
        ),
        # A row without mapping (legacy / non-mapped run prediction) — must
        # not pollute the counters.
        CategorizationResult(
            transaction_id="t4",
            predicted_category_code="6060",
            confidence=0.9,
            reasoning="",
        ),
    ]
    ground_truth = {"t1": "1050", "t2": "9999", "t3": "anything"}
    block = metrics.mapping_metrics(predictions, ground_truth)
    assert block["enabled"] is True
    assert block["mapped_intent_count"] == 1
    assert block["fallback_to_default_count"] == 1
    assert block["routed_to_review_count"] == 1
    assert block["unmapped_intent_count"] == 2
    assert block["mapping_override_count"] == 1
    # t1 is correct under mapping; t2 is wrong; safe-routed t3 doesn't count.
    assert block["correct_when_mapped"] == 1
    assert block["correct_when_fallback"] == 0
    assert any(e["intent"] == "weird_intent" for e in block["top_unmapped_intents"])


def test_mapping_metrics_block_disabled_for_legacy_runs() -> None:
    from ledgerlens.categorizers.base import CategorizationResult

    predictions = [
        CategorizationResult(
            transaction_id=f"t{i}",
            predicted_category_code="6060",
            confidence=0.9,
            reasoning="",
        )
        for i in range(5)
    ]
    block = metrics.mapping_metrics(predictions, {})
    assert block["enabled"] is False
    assert block["mapped_intent_count"] == 0
    assert block["routed_to_review_count"] == 0
