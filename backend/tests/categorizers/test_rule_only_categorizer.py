"""Tests for the eval-side rule-only categorizer."""

from ledgerlens.categorizers.rules import RuleOnlyCategorizer, _load_bundled_rules
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction


def _coa() -> list[Account]:
    # A miniature chart of accounts that includes the codes the bundled rules
    # target; the rule categorizer must only emit codes that exist in this COA.
    return [
        Account(
            code="6060", name="Office Supplies", description="", parent_code=None, type="expense"
        ),
        Account(
            code="6070",
            name="Software Subscriptions",
            description="",
            parent_code=None,
            type="expense",
        ),
        Account(
            code="6100",
            name="Bank & Merchant Fees",
            description="",
            parent_code=None,
            type="expense",
        ),
        Account(
            code="6110", name="Travel & Lodging", description="", parent_code=None, type="expense"
        ),
        Account(
            code="6120",
            name="Meals & Entertainment",
            description="",
            parent_code=None,
            type="expense",
        ),
        Account(
            code="6130", name="Fuel & Vehicle", description="", parent_code=None, type="expense"
        ),
    ]


def _biz() -> Business:
    return Business(
        id="b1",
        name="Test Co",
        industry="general",
        description="",
        fiscal_year_start="01-01",
    )


def _tx(raw: str) -> EvalTransaction:
    return EvalTransaction(
        id="tx_test",
        date="2026-03-14",
        amount_cents=-2400,
        raw_description=raw,
        proposed_category_code="6070",
        label_confidence="high",
        is_adversarial=False,
        reasoning="",
        labeler_notes=None,
    )


def test_load_bundled_rules_yields_active_set() -> None:
    rules = _load_bundled_rules()
    assert len(rules) > 0
    assert all(r.active for r in rules)
    # The set is sorted by descending (priority, confidence).
    for a, b in zip(rules, rules[1:], strict=False):
        assert (a.priority, a.confidence) >= (b.priority, b.confidence)


def test_adobe_predicts_6070() -> None:
    cat = RuleOnlyCategorizer()
    result = cat.categorize(_tx("ADOBE CREATIVE CLOUD MONTHLY"), _biz(), _coa())
    assert result.predicted_category_code == "6070"
    assert result.cost_usd == 0.0
    assert result.model == "rule.adobe.software"


def test_no_match_returns_uncategorizable() -> None:
    cat = RuleOnlyCategorizer()
    result = cat.categorize(_tx("OBSCURE INDIE VENDOR"), _biz(), _coa())
    assert result.predicted_category_code == "UNCATEGORIZABLE"
    assert result.confidence == 0.0
    assert result.cost_usd == 0.0


def test_rules_pointing_at_missing_categories_are_filtered() -> None:
    """If the business's COA lacks 6070, the Adobe rule must be skipped."""
    skinny_coa = [
        Account(code="6010", name="Rent", description="", parent_code=None, type="expense"),
    ]
    cat = RuleOnlyCategorizer()
    result = cat.categorize(_tx("ADOBE CREATIVE CLOUD"), _biz(), skinny_coa)
    assert result.predicted_category_code == "UNCATEGORIZABLE"
