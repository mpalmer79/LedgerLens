"""Batch #1 — parts-vendor deterministic rules.

Asserts that the new NAPA / AutoZone / O'Reilly / Advance Auto / LKQ /
Carquest / tire-distributor rules:
  * load and carry the right `intent` (parts_inventory or tires_inventory)
  * resolve to the right COA code on auto-repair, Granite State demo, and
    the default seed COA
  * do NOT broaden into unsafe matches (fuel stations, generic "auto",
    ambiguous marketplace purchases)
  * route to review (not silently miscategorize) on coffee-shop and
    design-agency thanks to the block_fallback_intents update
"""

from __future__ import annotations

from ledgerlens.categorizers.rules import RuleOnlyCategorizer, _load_bundled_rules
from ledgerlens.data.business_rule_maps import (
    AUTO_REPAIR_EVAL_INTENT_MAP,
    COFFEE_SHOP_EVAL_INTENT_MAP,
    DESIGN_AGENCY_EVAL_INTENT_MAP,
    GRANITE_STATE_INTENT_MAP,
)
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction


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
        proposed_category_code="5010",
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


# ── Each new parts-vendor rule fires + maps correctly on auto-repair ─────


def test_napa_rule_maps_to_auto_repair_inventory() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts (Resale)"), ("5010", "COGS - Parts"))
    pred = cat.categorize(_make_tx("t1", "NAPA AUTO PARTS #4471 MANCHESTER NH"), biz, coa)
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.predicted_category_code == "1050"
    assert pred.mapping_outcome == "mapped"


def test_autozone_commercial_maps_to_auto_repair_inventory() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"))
    pred = cat.categorize(_make_tx("t2", "AUTOZONE COMMERCIAL #4471"), biz, coa)
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.predicted_category_code == "1050"


def test_oreilly_maps_to_auto_repair_inventory() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"))
    pred = cat.categorize(_make_tx("t3", "O'REILLY AUTO PARTS 4712"), biz, coa)
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.predicted_category_code == "1050"


def test_advance_auto_maps_to_auto_repair_inventory() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"))
    pred = cat.categorize(_make_tx("t4", "ADVANCE AUTO PARTS PO 33812"), biz, coa)
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.predicted_category_code == "1050"


def test_lkq_maps_to_auto_repair_inventory() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"))
    pred = cat.categorize(_make_tx("t5", "LKQ CORPORATION REC PARTS"), biz, coa)
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.predicted_category_code == "1050"


def test_carquest_maps_to_auto_repair_inventory() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"))
    pred = cat.categorize(_make_tx("t6", "CARQUEST PARTS INV 8881"), biz, coa)
    assert pred.matched_rule_intent == "parts_inventory"
    assert pred.predicted_category_code == "1050"


def test_tire_distributor_maps_to_auto_repair_tires() -> None:
    """Tire vendors get the separate tires_inventory intent and land in
    1070 on the auto-repair COA (NOT 1050 parts inventory)."""
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"), ("1070", "Inventory - Tires"))
    pred = cat.categorize(_make_tx("t7", "TIRERACK BULK ORDER"), biz, coa)
    assert pred.matched_rule_intent == "tires_inventory"
    assert pred.predicted_category_code == "1070"
    pred2 = cat.categorize(_make_tx("t8", "SNOW TIRE BULK ORDER"), biz, coa)
    assert pred2.matched_rule_intent == "tires_inventory"
    assert pred2.predicted_category_code == "1070"
    pred3 = cat.categorize(_make_tx("t9", "GRANITE STATE TIRE DIST"), biz, coa)
    assert pred3.matched_rule_intent == "tires_inventory"
    assert pred3.predicted_category_code == "1070"


# ── Safety: fuel stations + generic "auto" do NOT match parts_inventory ──


def test_fuel_station_does_not_map_to_parts_inventory() -> None:
    """SHELL FUEL hits the existing rule.shell.fuel (intent=fuel_vehicle),
    NOT any of the new parts rules. Critical safety check."""
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(
        ("1050", "Inventory - Parts"),
        ("6130", "Shop Supplies"),  # auto-repair eval fuel_vehicle target
    )
    pred = cat.categorize(_make_tx("t10", "SHELL FUEL 03801 NASHUA"), biz, coa)
    assert pred.matched_rule_intent == "fuel_vehicle"
    assert pred.predicted_category_code == "6130"


def test_generic_auto_text_does_not_match_parts_inventory() -> None:
    """No bundled rule fires on bare 'auto' description — the patterns must
    compound a recognizable vendor name. This guards against the
    "every description with AUTO is parts" failure mode."""
    from ledgerlens.services.rule_categorizer import _rule_applies

    rules = _load_bundled_rules()
    parts_rules = [r for r in rules if r.intent == "parts_inventory"]
    assert parts_rules, "expected at least one parts_inventory rule loaded"
    for desc in (
        "AUTO REPAIR SHOP INVOICE",
        "AUTO INSURANCE PREMIUM",
        "WALMART AUTO CENTER",  # Walmart routes via marketplace template, not parts
    ):
        upper = desc.upper()
        merchant = upper.split(" ", 1)[0]
        matches = [r for r in parts_rules if _rule_applies(r, merchant, upper)]
        assert matches == [], f"unexpected parts rule match on '{desc}': {[r.id for r in matches]}"


# ── Granite State demo (production map) ──────────────────────────────────


def test_napa_maps_to_granite_state_cogs_in_demo() -> None:
    """On the production Granite State demo map, parts_inventory →
    5010 (COGS) per the existing demo categorization."""
    assert GRANITE_STATE_INTENT_MAP.resolve("parts_inventory") == "5010"
    # Tires also routed to COGS on the demo (no separate tires account).
    assert GRANITE_STATE_INTENT_MAP.resolve("tires_inventory") == "5010"


# ── Eval map confirmation ────────────────────────────────────────────────


def test_auto_repair_eval_map_carries_both_inventory_intents() -> None:
    assert AUTO_REPAIR_EVAL_INTENT_MAP.resolve("parts_inventory") == "1050"
    assert AUTO_REPAIR_EVAL_INTENT_MAP.resolve("tires_inventory") == "1070"


# ── Safety: coffee-shop + design-agency block the parts intents ──────────


def test_coffee_shop_blocks_parts_inventory_fallback() -> None:
    """A NAPA charge on a coffee-shop business must NOT silently classify
    as COGS - Green Coffee. block_fallback ensures route-to-review."""
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("coffee-shop")
    # 5010 exists on coffee-shop COA but means "COGS - Green Coffee."
    coa = _coa(("5010", "COGS - Green Coffee"))
    pred = cat.categorize(_make_tx("t11", "NAPA AUTO PARTS"), biz, coa)
    assert pred.predicted_category_code == "UNCATEGORIZABLE"
    assert pred.mapping_outcome == "routed_to_review"
    assert COFFEE_SHOP_EVAL_INTENT_MAP.is_fallback_blocked("parts_inventory") is True
    assert COFFEE_SHOP_EVAL_INTENT_MAP.is_fallback_blocked("tires_inventory") is True


def test_design_agency_blocks_parts_inventory_fallback() -> None:
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("design-agency")
    coa = _coa(("6150", "Office Supplies"))  # 5010 not on design-agency COA
    pred = cat.categorize(_make_tx("t12", "NAPA AUTO PARTS"), biz, coa)
    assert pred.predicted_category_code == "UNCATEGORIZABLE"
    assert pred.mapping_outcome == "routed_to_review"
    assert DESIGN_AGENCY_EVAL_INTENT_MAP.is_fallback_blocked("parts_inventory") is True


# ── Ambiguous merchants still route to review/questions ──────────────────


def test_amazon_still_routes_via_existing_low_confidence_rule() -> None:
    """Amazon rule has confidence 0.4 (below review threshold) and intent
    `office_supplies`. Adding parts rules must not change Amazon's
    behavior — it should still surface as ambiguous, not auto-apply."""
    rules = _load_bundled_rules()
    amazon = next((r for r in rules if r.id == "rule.amazon.review"), None)
    assert amazon is not None
    assert amazon.intent == "office_supplies"
    assert amazon.confidence == 0.4  # never auto-approves


def test_home_depot_lowes_have_no_parts_rule() -> None:
    """Home Depot / Lowe's are owner-question templates, not parts
    auto-categorization."""
    cat = RuleOnlyCategorizer(use_business_mapping=True)
    biz = _make_business("auto-repair")
    coa = _coa(("1050", "Inventory - Parts"))
    pred = cat.categorize(_make_tx("t13", "HOME DEPOT #2841 CONCORD"), biz, coa)
    # No parts rule should match; the categorizer returns UNCATEGORIZABLE.
    assert pred.predicted_category_code == "UNCATEGORIZABLE"
    pred2 = cat.categorize(_make_tx("t14", "LOWE'S COMMERCIAL #1142"), biz, coa)
    assert pred2.predicted_category_code == "UNCATEGORIZABLE"
