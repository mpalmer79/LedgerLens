from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals.schemas import Account, Business, Transaction


class StubCategorizer:
    """Deterministic, intentionally-bad categorizer for harness validation.

    Always returns the first account whose type is `expense` (or the first account
    overall if no expense exists). Confidence is constant 0.5. Used to verify that
    the harness can compute metrics end-to-end against a real categorizer surface.
    """

    name = "stub-v1"

    def categorize(
        self,
        transaction: Transaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        expenses = [a for a in chart_of_accounts if a.type == "expense"]
        primary = expenses[0] if expenses else chart_of_accounts[0]
        alternative = expenses[1].code if len(expenses) > 1 else None
        return CategorizationResult(
            transaction_id=transaction.id,
            predicted_category_code=primary.code,
            confidence=0.5,
            reasoning=(
                "Stub categorizer; returns first expense account regardless of transaction content."
            ),
            alternative_category_code=alternative,
            cost_usd=0.0,
            latency_ms=0.0,
            model=None,
        )
