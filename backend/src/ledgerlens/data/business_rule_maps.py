"""Per-business rule intent → category mapping.

The deterministic rule layer ships with a `category_code` per rule. That
hard-codes the rule against a single chart of accounts. Per-business rule
mapping decouples a rule's *intent* (e.g. `parts_inventory`, `payroll`,
`fuel_vehicle`) from the actual COA code the active business uses for
that intent.

This is a single-tenant codebase today, so the "active business" is
resolved through `ledgerlens.data.sample_scenario` — the demo always
runs as the Granite State Auto Repair scenario. A real multi-tenant
deploy would resolve the active business from the request context.

Design rules:

1. If a rule has no `intent`, the mapping layer is a no-op — the rule's
   own `category_code` is used. (Backward compatible with v1.)
2. If a rule has an `intent` and the active business has a mapped code,
   the mapped code wins.
3. If a rule has an `intent` and the active business has **no** mapping
   for it, the rule's own `category_code` is used as a safe fallback.
4. If a mapped code points at a COA category that doesn't exist on the
   active business, the rule_categorizer falls back to the rule's
   original code (the rules loader already filters rules whose
   `category_code` doesn't validate against the COA).

Add a new intent here by adding it to `BusinessRuleMap.intent_to_code`.
A blank value means "intentionally do not auto-categorize this intent for
this business — route to review instead."
"""

from __future__ import annotations

from dataclasses import dataclass

from ledgerlens.data.sample_scenario import SAMPLE_SCENARIO


@dataclass(frozen=True)
class BusinessRuleMap:
    """An (intent → COA category code) map for a single business."""

    business_id: str
    intent_to_code: dict[str, str]

    def resolve(self, intent: str | None) -> str | None:
        """Return the COA code mapped to this intent, or None if there is no
        explicit override. None means "let the rule's own category_code stand."
        """
        if not intent:
            return None
        return self.intent_to_code.get(intent)


# ── Default mapping ─────────────────────────────────────────────────────────
#
# Used when the active business has no explicit mapping. Resolves only the
# intents that are unambiguous against the default seed COA.
DEFAULT_INTENT_MAP = BusinessRuleMap(
    business_id="default",
    intent_to_code={
        # Operating expenses
        "rent": "6010",
        "utilities": "6020",
        "payroll": "6030",
        "payroll_taxes": "6040",
        "insurance": "6050",
        "office_supplies": "6060",
        "software_subscription": "6070",
        "professional_services": "6080",
        "marketing_advertising": "6090",
        "merchant_fees": "6100",
        "travel": "6110",
        "meals_entertainment": "6120",
        "fuel_vehicle": "6130",
        "repairs_maintenance": "6140",
        "internet_telecom": "6150",
        "training_education": "6160",
        "equipment_expensed": "6170",
        "supplies_general": "6180",
        # Revenue
        "customer_revenue": "4010",
        "service_revenue": "4020",
        # Owner-side movement
        "owner_draw": "3030",
        "owner_contribution": "3010",
        # Intentionally blank — these should never auto-categorize without
        # an owner question. The rule_categorizer will see `None` here and
        # leave the rule's own category_code in place; if the rule's own
        # code is also a "review me" hint (e.g. the Amazon ambiguity rule
        # at confidence 0.4), the routing logic will catch it.
    },
)


# ── Granite State Auto Repair ───────────────────────────────────────────────
#
# Sample-scenario mapping for the fictional auto repair shop. Parts and
# customer-job inventory map to Cost of Goods Sold (5010). Comcast Business
# is treated as Internet/Telecom (6150) rather than generic Utilities (6020).
# Fuel and vehicle maintenance keep their distinct codes (6130 vs 6140).
GRANITE_STATE_INTENT_MAP = BusinessRuleMap(
    business_id="granite_state_auto_repair",
    intent_to_code={
        # Auto-shop-specific
        "parts_inventory": "5010",  # Cost of Goods Sold
        "tools_equipment": "6170",
        "vehicle_maintenance": "6140",  # Repairs & Maintenance
        # Operating expenses (overrides where the auto shop's preference
        # differs from the generic default)
        "rent": "6010",
        "utilities": "6020",  # Eversource electric, water
        "internet_telecom": "6150",  # Comcast Business → telecom, not utilities
        "waste_services": "6020",  # Waste Management → utilities bucket
        "payroll": "6030",
        "payroll_taxes": "6040",
        "insurance": "6050",  # Hanover garage liability + Concord Group health
        "software_subscription": "6070",  # QuickBooks, Mitchell1, Google Workspace
        "fuel_vehicle": "6130",
        "merchant_fees": "6100",  # Stripe / Square processing fees
        "professional_services": "6080",
        "loan_payment": "8010",  # Interest Expense — accountant will split principal vs interest
        # Revenue
        "customer_revenue": "4010",  # Customer check deposits, Stripe payouts
        "service_revenue": "4020",
        # Owner-side
        "owner_draw": "3030",
        "owner_contribution": "3010",
    },
)


# ── Registry ─────────────────────────────────────────────────────────────────
_REGISTRY: dict[str, BusinessRuleMap] = {
    DEFAULT_INTENT_MAP.business_id: DEFAULT_INTENT_MAP,
    GRANITE_STATE_INTENT_MAP.business_id: GRANITE_STATE_INTENT_MAP,
}


def get_business_rule_map(business_id: str | None) -> BusinessRuleMap:
    """Look up the rule map for a given business id.

    Falls back to `DEFAULT_INTENT_MAP` for unknown ids or `None`. This is the
    single read path the rule_categorizer uses; tests can override behavior by
    passing a specific business_id.
    """
    if business_id and business_id in _REGISTRY:
        return _REGISTRY[business_id]
    return DEFAULT_INTENT_MAP


def active_business_id() -> str:
    """Return the currently active business id for the single-tenant deploy.

    Hard-coded to the sample scenario today. A real multi-tenant deploy
    would resolve this from the request (session, JWT, tenant header).
    """
    # SAMPLE_SCENARIO names the fictional business; we slugify the canonical
    # business_id so it's stable across renames in the human-readable name.
    name = SAMPLE_SCENARIO["business_name"]
    if name == "Granite State Auto Repair":
        return GRANITE_STATE_INTENT_MAP.business_id
    return DEFAULT_INTENT_MAP.business_id


def resolve_category_for_intent(
    intent: str | None,
    *,
    business_id: str | None = None,
    fallback_code: str,
) -> str:
    """Resolve an intent to a COA code for the active (or named) business.

    Returns the mapped code if a mapping exists, else `fallback_code`. This
    is the single entry point the rule_categorizer calls; the fallback path
    means "no business override — use the rule's own code."
    """
    bid = business_id or active_business_id()
    mapped = get_business_rule_map(bid).resolve(intent)
    return mapped if mapped else fallback_code
