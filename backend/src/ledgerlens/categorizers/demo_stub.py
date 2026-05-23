"""Portfolio-safe demo stub categorizer.

When `CATEGORIZER_MODE=demo_stub` (the default for public deployments), this
categorizer is the fallback layer. It runs *after* correction memory and the
deterministic rule layer have failed to classify a transaction.

Design rules:

- **No external calls.** This module deliberately does not import the
  `anthropic` SDK or any other network client. It must be safe to deploy
  without any API keys.
- **No guessing.** The stub never auto-approves an unknown transaction. It
  returns `UNCATEGORIZABLE` so the existing routing logic in
  `services/categorize.py::_route_status` will set the result status to
  `UNCATEGORIZABLE` (which is honest) — or, if a caller routes UNCATEGORIZABLE
  through some other path, the low confidence guarantees it never auto-posts.
- **Honest framing.** The provider name is `demo_stub`, the model name is
  `portfolio_stub_v1`, and the explanation tells the reviewer exactly what
  happened: correction memory and rules didn't match, so the transaction
  is going to human review instead of a paid model.

This is not AI. It does not learn. It does not call anything. It is a
deterministic placeholder whose only job is keeping the workflow clickable
in a zero-cost portfolio demo.
"""

from __future__ import annotations

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals.schemas import Account, Business, Transaction

DEMO_STUB_PROVIDER = "demo_stub"
DEMO_STUB_MODEL_NAME = "portfolio_stub_v1"

# Sentinel kept in sync with `services/categorize.UNCATEGORIZABLE_SENTINEL`.
# Importing the production constant would create a service↔categorizer cycle,
# and the value is stable.
UNCATEGORIZABLE_SENTINEL = "UNCATEGORIZABLE"

_EXPLANATION = (
    "Portfolio demo stub: no correction memory or deterministic rule matched, "
    "so this transaction is routed to human review instead of calling a paid "
    "model provider."
)


class DemoStubCategorizer:
    """Deterministic, zero-cost fallback for the portfolio demo deployment.

    Implements the `Categorizer` protocol. Always emits an UNCATEGORIZABLE
    result at a low (but non-zero) confidence, so:

    - The transaction lands in the review queue.
    - The provider tag clearly says `demo_stub`, not `anthropic`.
    - Estimated cost is exactly $0.00.
    """

    name = "demo-stub-v1"

    def categorize(
        self,
        transaction: Transaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        return CategorizationResult(
            transaction_id=transaction.id,
            predicted_category_code=UNCATEGORIZABLE_SENTINEL,
            confidence=0.40,
            reasoning=_EXPLANATION,
            alternative_category_code=None,
            cost_usd=0.0,
            latency_ms=0.0,
            model=DEMO_STUB_MODEL_NAME,
        )
