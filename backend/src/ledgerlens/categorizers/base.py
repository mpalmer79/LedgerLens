from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field

from ledgerlens.evals.schemas import Account, Business, Transaction


class CategorizationResult(BaseModel):
    transaction_id: str
    predicted_category_code: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    alternative_category_code: str | None = None
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    model: str | None = None
    # Per-business rule mapping provenance — populated only by the mapped
    # rule categorizers (rules-only-mapped, hybrid-rules-model-mapped).
    # Stays None on every other prediction so existing JSON deserializes.
    matched_rule_intent: str | None = None
    # One of: "mapped" (override resolved a category), "fallback_to_default"
    # (no mapping but the rule's own category_code worked), "routed_to_review"
    # (no mapping, rule's own code invalid → predicted UNCATEGORIZABLE),
    # or None (mapping disabled or no rule matched).
    mapping_outcome: str | None = None


@runtime_checkable
class Categorizer(Protocol):
    name: str

    def categorize(
        self,
        transaction: Transaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult: ...
