"""Per-business rule intent → COA mapping.

The mapping layer decouples a rule's *intent* (e.g. `parts_inventory`) from
the COA code the active business uses for that intent. Tests assert:

- Loader picks up the `intent` field from category_rules.json.
- Resolver returns the mapped code when a mapping exists, else falls back.
- Unknown business ids fall back to DEFAULT_INTENT_MAP.
- Unknown intents return the rule's own fallback code.
- The Granite State map resolves `parts_inventory` to COGS (5010).
"""

from __future__ import annotations

from ledgerlens.data.business_rule_maps import (
    DEFAULT_INTENT_MAP,
    GRANITE_STATE_INTENT_MAP,
    active_business_id,
    get_business_rule_map,
    resolve_category_for_intent,
)
from ledgerlens.services.rule_categorizer import _coerce_rule

# ── Loader ────────────────────────────────────────────────────────────────


def test_coerce_rule_extracts_intent() -> None:
    raw = {
        "id": "rule.napa.parts",
        "name": "NAPA → parts",
        "active": True,
        "priority": 80,
        "match_type": "merchant_contains",
        "merchant_patterns": ["NAPA"],
        "description_patterns": [],
        "category_code": "5010",
        "confidence": 0.9,
        "intent": "parts_inventory",
    }
    rule = _coerce_rule(raw)
    assert rule is not None
    assert rule.intent == "parts_inventory"


def test_coerce_rule_intent_is_optional() -> None:
    raw = {
        "id": "rule.x.misc",
        "name": "X",
        "active": True,
        "priority": 50,
        "match_type": "merchant_contains",
        "merchant_patterns": ["XYZ"],
        "description_patterns": [],
        "category_code": "6060",
        "confidence": 0.9,
    }
    rule = _coerce_rule(raw)
    assert rule is not None
    assert rule.intent is None


# ── Resolver ──────────────────────────────────────────────────────────────


def test_resolve_returns_mapped_code_when_present() -> None:
    code = resolve_category_for_intent(
        "parts_inventory",
        business_id="granite_state_auto_repair",
        fallback_code="9999",
    )
    assert code == "5010"


def test_resolve_falls_back_when_intent_unmapped() -> None:
    code = resolve_category_for_intent(
        "tax_planning_special",
        business_id="granite_state_auto_repair",
        fallback_code="9999",
    )
    # Unknown intent → fallback wins.
    assert code == "9999"


def test_resolve_falls_back_when_intent_is_none() -> None:
    code = resolve_category_for_intent(
        None, business_id="granite_state_auto_repair", fallback_code="6060"
    )
    assert code == "6060"


def test_unknown_business_id_falls_back_to_default_map() -> None:
    rule_map = get_business_rule_map("does-not-exist")
    assert rule_map is DEFAULT_INTENT_MAP


def test_granite_state_specific_overrides() -> None:
    # Comcast Business should land in internet/telecom (6150), not the
    # default's plain Utilities (6020).
    assert GRANITE_STATE_INTENT_MAP.resolve("internet_telecom") == "6150"
    # Parts inventory routes to COGS for an auto shop.
    assert GRANITE_STATE_INTENT_MAP.resolve("parts_inventory") == "5010"
    # The default map doesn't claim parts_inventory at all.
    assert DEFAULT_INTENT_MAP.resolve("parts_inventory") is None


def test_active_business_id_resolves_to_granite_state() -> None:
    # SAMPLE_SCENARIO is hard-pinned to Granite State Auto Repair.
    assert active_business_id() == "granite_state_auto_repair"
