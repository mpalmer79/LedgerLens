import time
from typing import Any
from unittest.mock import MagicMock

import anthropic
import pytest

from ledgerlens.categorizers.claude_haiku import (
    HAIKU_INPUT_PRICE_PER_MTOKEN_USD,
    HAIKU_OUTPUT_PRICE_PER_MTOKEN_USD,
    UNCATEGORIZABLE_CODE,
    ClaudeHaikuCategorizer,
)
from ledgerlens.evals.schemas import Account, Business, Transaction


def _business() -> Business:
    return Business(
        id="b",
        name="B Co",
        industry="x",
        description="d",
        fiscal_year_start="01-01",
    )


def _accounts() -> list[Account]:
    return [
        Account(code="6010", name="Rent", description="rent", type="expense"),
        Account(code="6170", name="Software", description="software", type="expense"),
    ]


def _tx() -> Transaction:
    return Transaction(
        id="tx-001",
        date="2025-07-01",
        amount_cents=-10000,
        raw_description="TEST VENDOR",
        proposed_category_code="6010",
        label_confidence="high",
        is_adversarial=False,
        reasoning="t",
    )


def _mock_response(
    tool_input: dict[str, Any] | None,
    input_tokens: int = 1000,
    output_tokens: int = 100,
) -> MagicMock:
    """Build a fake anthropic Message with a tool_use block (or no block)."""
    response = MagicMock()
    if tool_input is None:
        response.content = []
    else:
        block = MagicMock()
        block.type = "tool_use"
        block.name = "submit_categorization"
        block.input = tool_input
        response.content = [block]
    response.usage.input_tokens = input_tokens
    response.usage.output_tokens = output_tokens
    return response


def test_well_formed_response_parses_to_result() -> None:
    client = MagicMock()
    client.messages.create.return_value = _mock_response(
        {
            "predicted_category_code": "6170",
            "confidence": 0.8,
            "reasoning": "Software subscription.",
            "alternative_category_code": "6010",
        }
    )
    cat = ClaudeHaikuCategorizer(client=client)
    result = cat.categorize(_tx(), _business(), _accounts())

    assert client.messages.create.call_count == 1
    assert result.predicted_category_code == "6170"
    assert result.confidence == 0.8
    assert result.reasoning == "Software subscription."
    assert result.alternative_category_code == "6010"
    assert result.model == "claude-haiku-4-5-20251001"
    assert result.cost_usd > 0
    assert result.latency_ms >= 0


def test_malformed_response_triggers_retry() -> None:
    client = MagicMock()
    bad = _mock_response({"predicted_category_code": "6010"})  # missing confidence + reasoning
    good = _mock_response(
        {
            "predicted_category_code": "6010",
            "confidence": 0.7,
            "reasoning": "Rent payment.",
        }
    )
    client.messages.create.side_effect = [bad, good]
    cat = ClaudeHaikuCategorizer(client=client)
    result = cat.categorize(_tx(), _business(), _accounts())

    assert client.messages.create.call_count == 2
    assert result.predicted_category_code == "6010"
    assert result.confidence == 0.7


def test_double_malformed_response_returns_uncategorizable() -> None:
    client = MagicMock()
    bad = _mock_response({"predicted_category_code": "6010"})  # missing required fields
    client.messages.create.side_effect = [bad, bad]
    cat = ClaudeHaikuCategorizer(client=client)
    result = cat.categorize(_tx(), _business(), _accounts())

    assert client.messages.create.call_count == 2
    assert result.predicted_category_code == UNCATEGORIZABLE_CODE
    assert result.confidence == 0.0
    assert "Schema validation failed" in result.reasoning


def test_api_error_returns_uncategorizable_no_retry() -> None:
    client = MagicMock()
    client.messages.create.side_effect = anthropic.APIError(
        message="boom", request=MagicMock(), body=None
    )
    cat = ClaudeHaikuCategorizer(client=client)
    result = cat.categorize(_tx(), _business(), _accounts())

    assert client.messages.create.call_count == 1
    assert result.predicted_category_code == UNCATEGORIZABLE_CODE
    assert result.confidence == 0.0
    assert "APIError" in result.reasoning


def test_cost_computed_from_token_counts() -> None:
    client = MagicMock()
    client.messages.create.return_value = _mock_response(
        {
            "predicted_category_code": "6010",
            "confidence": 0.5,
            "reasoning": "x",
        },
        input_tokens=2000,
        output_tokens=500,
    )
    cat = ClaudeHaikuCategorizer(client=client)
    result = cat.categorize(_tx(), _business(), _accounts())

    expected = (
        2000 * HAIKU_INPUT_PRICE_PER_MTOKEN_USD / 1_000_000
        + 500 * HAIKU_OUTPUT_PRICE_PER_MTOKEN_USD / 1_000_000
    )
    assert result.cost_usd == pytest.approx(expected)


def test_latency_measured() -> None:
    client = MagicMock()

    def slow_call(*args: Any, **kwargs: Any) -> MagicMock:
        time.sleep(0.02)
        return _mock_response(
            {"predicted_category_code": "6010", "confidence": 0.5, "reasoning": "x"}
        )

    client.messages.create.side_effect = slow_call
    cat = ClaudeHaikuCategorizer(client=client)
    result = cat.categorize(_tx(), _business(), _accounts())

    assert result.latency_ms >= 20.0
