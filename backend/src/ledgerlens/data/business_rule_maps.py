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
    """An (intent → COA category code) map for a single business.

    The optional `block_fallback_intents` set lists intents the active
    business knows should NEVER auto-resolve via the rule's own
    `category_code` fallback. This matters when a rule's hardcoded
    default code (calibrated to the seed COA) happens to refer to a
    completely different category in this business's COA — for example
    the bundled Intuit rule defaults to 6070 (Software Subscriptions in
    the seed COA), but on the design-agency eval COA 6070 is "Merchant
    Processing Fees." Silently auto-applying 6070 there would post
    Intuit as a merchant fee, which is wrong. Listing
    `software_subscription` in `block_fallback_intents` for that map
    causes the rule layer to abstain (route to review) instead.
    """

    business_id: str
    intent_to_code: dict[str, str]
    block_fallback_intents: frozenset[str] = frozenset()

    def resolve(self, intent: str | None) -> str | None:
        """Return the COA code mapped to this intent, or None if there is no
        explicit override. None means "let the rule's own category_code stand
        unless the intent is also in `block_fallback_intents`."
        """
        if not intent:
            return None
        return self.intent_to_code.get(intent)

    def is_fallback_blocked(self, intent: str | None) -> bool:
        """True iff this business explicitly wants the rule layer to NOT
        fall back to `rule.category_code` for this intent. The caller
        should route to review when this returns True and no override
        exists.
        """
        if not intent:
            return False
        return intent in self.block_fallback_intents


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
        # Auto-parts / tires intents (introduced by Batch #1) — the seed
        # COA has only "Cost of Goods Sold" (5010); both intents land there
        # on the default map. Business-specific maps (auto-repair-eval,
        # Granite State demo) carry their own COA-correct overrides.
        "parts_inventory": "5010",
        "tires_inventory": "5010",
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
        "tires_inventory": "5010",  # Demo's COGS bucket (Batch #1)
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


# ── Granite State Auto Service (auto-repair eval dataset) ─────────────────
#
# The eval dataset `evals/datasets/v0/auto-repair/` ships its own per-business
# chart of accounts that *differs* from the default seed COA. Parts purchases
# go to **1050 Inventory - Parts (Resale)** as an asset (then move to COGS
# 5010 when installed), not directly to the seed COA's 5010 Cost of Goods
# Sold. This mapping is the honest answer to "what does a real auto repair
# shop COA look like?" — and it's what the `rules-only-mapped` eval mode uses.
#
# Distinct from `GRANITE_STATE_INTENT_MAP` (which is keyed to the production
# demo's *default seed* COA). Two maps; same business identity; different COAs.
AUTO_REPAIR_EVAL_INTENT_MAP = BusinessRuleMap(
    business_id="auto_repair_eval",
    intent_to_code={
        # Parts go to inventory first; COGS only after they're consumed on a
        # work order. The auto-repair COA models this explicitly.
        "parts_inventory": "1050",
        # Tires get their own inventory bucket (1070) — separate from parts
        # (1050) — per the auto-repair eval COA. Batch #1 adds this intent.
        "tires_inventory": "1070",
        "tools_equipment": "6150",  # Small Tools (Expensed)
        # Utilities split into electric vs gas/water vs telecom on this COA.
        "utilities": "6020",  # Electric (default — the rule may match gas too)
        "internet_telecom": "6250",  # Telephone & Internet
        "waste_services": "6170",  # Waste Disposal
        # Operating expenses
        "rent": "6010",
        "payroll": "6040",  # Wages - Technicians
        "payroll_taxes": "6060",
        "insurance": "6090",  # General Liability (rule may match workers comp 6080 too)
        "software_subscription": "6190",
        "professional_services": "6220",  # Professional Services - Accounting
        "marketing_advertising": "6200",
        "merchant_fees": "6110",
        "office_supplies": "6140",
        "fuel_vehicle": "6130",  # Shop Supplies — fuel for shop vehicles
        "vehicle_maintenance": "6160",  # Repairs & Maintenance
        "meals_entertainment": "6240",  # Continuing Education — closest neutral analog
        "travel": "6240",
        "training_education": "6240",
        # Revenue side
        "customer_revenue": "4010",  # Sales - Labor
        "service_revenue": "4010",
        # Owner side
        "owner_draw": "3030",
        "owner_contribution": "3010",
    },
)


# ── Lighthouse Roasters (coffee-shop eval dataset) ─────────────────────────
#
# Inventory-heavy COA with multi-level COGS. Mappings target the actual
# coffee-shop COA codes. Several intents are deliberately routed to review
# via `block_fallback_intents` because the rule's seed-COA default code
# means something entirely different on this COA (e.g. seed 6120 =
# Meals & Entertainment vs coffee-shop 6120 = Office Supplies).
COFFEE_SHOP_EVAL_INTENT_MAP = BusinessRuleMap(
    business_id="coffee_shop_eval",
    intent_to_code={
        # Operating expenses
        "rent": "6010",
        "utilities": "6020",  # Electric (gas/water is 6030)
        "payroll": "6040",  # Wages - Baristas
        "payroll_taxes": "6060",
        "insurance": "6090",  # General Liability
        "office_supplies": "6120",  # Mapped explicitly: seed's 6060 → Payroll Taxes here
        "software_subscription": "6170",  # Mapped explicitly: seed's 6070 → Payroll Service Fees
        "professional_services": "6180",
        "marketing_advertising": "6160",
        "merchant_fees": "6100",  # Merchant Processing Fees (same code as seed; safe)
        "fuel_vehicle": "6210",  # Vehicle & Delivery (seed's 6130 collides with Cleaning here)
        "repairs_maintenance": "6140",
        "vehicle_maintenance": "6140",
        "internet_telecom": "6200",
        "training_education": "6230",
        "tools_equipment": "6150",
        "supplies_general": "6130",  # Cleaning & Sanitation
        # Revenue
        "customer_revenue": "4010",  # Retail Beverages
        "service_revenue": "4010",  # no service line; map to beverages
        # Owner-side
        "owner_draw": "3030",
        "owner_contribution": "3010",
    },
    block_fallback_intents=frozenset(
        {
            # rule default 6120 = Office Supplies on this COA — Starbucks/Dunkin
            # rules would silently classify as Office Supplies. Route to review.
            "meals_entertainment",
            # rule default 6110 = Bank Service Charges on this COA. Route to review.
            "travel",
            # Batch #1 parts-vendor rules — a coffee shop should not auto-
            # categorize NAPA/AutoZone/etc. as Green Coffee or any COGS.
            # Rule default 5010 on coffee-shop COA = "COGS - Green Coffee".
            "parts_inventory",
            "tires_inventory",
        }
    ),
)


# ── Northwind Design Co. (design-agency eval dataset) ──────────────────────
#
# Service business, no inventory. Software-dense COA with five separate
# software accounts (6100–6140). Many seed-COA defaults are unsafe here
# because design-agency uses the same code numbers for different concepts
# (e.g. seed's 6070 = Software is design-agency's 6070 = Merchant Fees).
DESIGN_AGENCY_EVAL_INTENT_MAP = BusinessRuleMap(
    business_id="design_agency_eval",
    intent_to_code={
        # Operating expenses
        "rent": "6010",  # Coworking & Office Rent
        "payroll_taxes": "6030",  # Self-Employment Tax Set-Aside
        "insurance": "6050",  # Professional Liability
        "office_supplies": "6150",  # Mapped: seed's 6060 → Health Insurance here
        "software_subscription": "6140",  # Mapped: seed's 6070 → Merchant Fees here
        "professional_services": "6180",  # Accounting (legal is 6190)
        "marketing_advertising": "6170",
        "merchant_fees": "6070",  # Merchant Processing Fees
        "meals_entertainment": "6220",  # design-agency HAS this category
        "travel": "6210",  # Conferences & Travel
        "tools_equipment": "6160",  # Computer Hardware - Expensed
        "training_education": "6200",  # Professional Development
        "internet_telecom": "6230",
        # Revenue
        "customer_revenue": "4010",  # Web Design
        "service_revenue": "4030",  # Retainer
        # Owner-side
        "owner_draw": "3030",
        "owner_contribution": "3010",
    },
    block_fallback_intents=frozenset(
        {
            # Design agency is a sole proprietor — no Wages account. Rule
            # default 6030 = Self-Employment Tax here, not wages.
            "payroll",
            # No utilities account. Rule default 6020 = Owner Salary - N/A.
            "utilities",
            # No vehicle accounts. Rule default 6130 = Software - Communication.
            "fuel_vehicle",
            "vehicle_maintenance",
            # No facility maintenance. Rule default 6140 = Software - Other.
            "repairs_maintenance",
            "supplies_general",
            "waste_services",
            # Batch #1 parts-vendor intents — design agency has no parts
            # or tires concept. Rule default 5010 doesn't exist on this COA
            # so the fallback would already drop, but listing explicitly
            # for safety + clarity.
            "parts_inventory",
            "tires_inventory",
        }
    ),
)


# ── Registry ─────────────────────────────────────────────────────────────────
_REGISTRY: dict[str, BusinessRuleMap] = {
    DEFAULT_INTENT_MAP.business_id: DEFAULT_INTENT_MAP,
    GRANITE_STATE_INTENT_MAP.business_id: GRANITE_STATE_INTENT_MAP,
    AUTO_REPAIR_EVAL_INTENT_MAP.business_id: AUTO_REPAIR_EVAL_INTENT_MAP,
    COFFEE_SHOP_EVAL_INTENT_MAP.business_id: COFFEE_SHOP_EVAL_INTENT_MAP,
    DESIGN_AGENCY_EVAL_INTENT_MAP.business_id: DESIGN_AGENCY_EVAL_INTENT_MAP,
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
