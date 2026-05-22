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


@runtime_checkable
class Categorizer(Protocol):
    name: str

    def categorize(
        self,
        transaction: Transaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult: ...
