import time
from typing import Any, ClassVar

import anthropic
from pydantic import ValidationError

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.categorizers.prompts import build_system_prompt, build_user_prompt
from ledgerlens.config import get_settings
from ledgerlens.evals.schemas import Account, Business, Transaction

UNCATEGORIZABLE_CODE = "UNCATEGORIZABLE"

# Pricing for claude-haiku-4-5-20251001 as of 2026-05-21, per Anthropic's
# published price list. Point-in-time values; revisit when a new Haiku ships.
HAIKU_INPUT_PRICE_PER_MTOKEN_USD = 1.00
HAIKU_OUTPUT_PRICE_PER_MTOKEN_USD = 5.00


class ClaudeHaikuCategorizer:
    """Single-call categorizer that asks Claude Haiku to pick an account.

    The categorizer makes one API call per transaction. Structured output is
    obtained via Anthropic's tool_use feature with the model forced to invoke
    `submit_categorization`. On Pydantic validation failure (model returned
    fields outside the schema), one retry is issued with a stricter reminder;
    on a second failure, a synthetic UNCATEGORIZABLE result is returned. API
    errors return UNCATEGORIZABLE without an in-call retry — retry-on-API-
    error is the harness's responsibility, not the categorizer's.
    """

    name: str = "claude-haiku-v1"

    TOOL_SCHEMA: ClassVar[dict[str, Any]] = {
        "name": "submit_categorization",
        "description": (
            "Submit the categorization decision for this transaction. Pick "
            "exactly one account code from the chart of accounts shown above."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "predicted_category_code": {
                    "type": "string",
                    "description": "The account code chosen for this transaction.",
                },
                "confidence": {
                    "type": "number",
                    "minimum": 0.0,
                    "maximum": 1.0,
                    "description": ("Likelihood that the chosen category is correct, in [0, 1]."),
                },
                "reasoning": {
                    "type": "string",
                    "description": ("1-2 sentences explaining the categorization choice."),
                },
                "alternative_category_code": {
                    "type": "string",
                    "description": (
                        "Optional second-choice category code; omit if no plausible alternative."
                    ),
                },
            },
            "required": ["predicted_category_code", "confidence", "reasoning"],
        },
    }

    def __init__(
        self,
        client: anthropic.Anthropic,
        model: str = "claude-haiku-4-5-20251001",
    ) -> None:
        self.client = client
        self.model = model

    def _build_messages(
        self,
        transaction: Transaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> tuple[str, str]:
        return (
            build_system_prompt(),
            build_user_prompt(transaction, business, chart_of_accounts),
        )

    def _call_sdk(self, system: str, messages: list[dict[str, Any]]) -> anthropic.types.Message:
        return self.client.messages.create(  # type: ignore[call-overload]
            model=self.model,
            max_tokens=1024,
            system=system,
            messages=messages,
            tools=[self.TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "submit_categorization"},
        )

    def _extract_tool_input(self, response: anthropic.types.Message) -> dict[str, Any]:
        for block in response.content:
            if block.type == "tool_use" and block.name == "submit_categorization":
                if isinstance(block.input, dict):
                    return block.input
        raise ValueError("Response contained no submit_categorization tool_use block.")

    def _cost(self, response: anthropic.types.Message) -> float:
        usage = response.usage
        return (
            usage.input_tokens * HAIKU_INPUT_PRICE_PER_MTOKEN_USD / 1_000_000
            + usage.output_tokens * HAIKU_OUTPUT_PRICE_PER_MTOKEN_USD / 1_000_000
        )

    def _uncategorizable(
        self, transaction_id: str, reasoning: str, latency_ms: float, cost_usd: float
    ) -> CategorizationResult:
        return CategorizationResult(
            transaction_id=transaction_id,
            predicted_category_code=UNCATEGORIZABLE_CODE,
            confidence=0.0,
            reasoning=reasoning,
            alternative_category_code=None,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            model=self.model,
        )

    def categorize(
        self,
        transaction: Transaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        system, user = self._build_messages(transaction, business, chart_of_accounts)
        messages: list[dict[str, Any]] = [{"role": "user", "content": user}]
        start = time.perf_counter()
        cost = 0.0

        try:
            response = self._call_sdk(system, messages)
            cost += self._cost(response)
            tool_input = self._extract_tool_input(response)
            try:
                return CategorizationResult(
                    transaction_id=transaction.id,
                    cost_usd=cost,
                    latency_ms=(time.perf_counter() - start) * 1000.0,
                    model=self.model,
                    **tool_input,
                )
            except ValidationError as first_err:
                messages.append({"role": "assistant", "content": response.content})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "Your previous response did not conform to the schema. "
                            f"Field error: {first_err.errors()[0].get('msg', 'unknown')}. "
                            "Please respond again using submit_categorization with all "
                            "required fields and valid values."
                        ),
                    }
                )
                retry = self._call_sdk(system, messages)
                cost += self._cost(retry)
                try:
                    retry_input = self._extract_tool_input(retry)
                    return CategorizationResult(
                        transaction_id=transaction.id,
                        cost_usd=cost,
                        latency_ms=(time.perf_counter() - start) * 1000.0,
                        model=self.model,
                        **retry_input,
                    )
                except ValidationError as second_err:
                    msg = second_err.errors()[0].get("msg", "unknown")
                    return self._uncategorizable(
                        transaction.id,
                        f"Schema validation failed twice: {msg}",
                        (time.perf_counter() - start) * 1000.0,
                        cost,
                    )
        except anthropic.APIError as api_err:
            return self._uncategorizable(
                transaction.id,
                f"Anthropic API error ({type(api_err).__name__}); harness did not retry.",
                (time.perf_counter() - start) * 1000.0,
                cost,
            )


def build_client_from_settings() -> anthropic.Anthropic:
    """Construct an Anthropic client using ANTHROPIC_API_KEY from settings.

    Called by the CLI when the user selects `--categorizer claude-haiku-v1`.
    Tests construct their own MagicMock clients and do not use this function.
    """
    settings = get_settings()
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)
