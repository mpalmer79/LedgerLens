"""Categorize endpoint tests with a deterministic fake categorizer.

The production categorizer hits the Anthropic API. These tests inject a fake
that returns a known prediction so we can assert the routing and persistence
behavior without touching the network.
"""

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.errors import MissingProviderConfig
from ledgerlens.services import categorize as categorize_svc


@pytest.fixture
def fake_categorizer_factory(monkeypatch: pytest.MonkeyPatch) -> Iterator[MagicMock]:
    factory = MagicMock()
    monkeypatch.setattr(categorize_svc, "get_default_categorizer", factory)
    yield factory


def _fake_cat(code: str, confidence: float, *, reasoning: str = "test") -> MagicMock:
    fake = MagicMock()
    fake.categorize.return_value = CategorizationResult(
        transaction_id="ignored",
        predicted_category_code=code,
        confidence=confidence,
        reasoning=reasoning,
        alternative_category_code=None,
        cost_usd=0.001,
        latency_ms=1234,
        model="claude-haiku-test",
    )
    return fake


def _create_tx(client: TestClient) -> str:
    # An unbranded description so neither correction memory nor the bundled
    # rule layer matches — the model path is exercised in this test module.
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": "Generic Vendor Invoice 4421",
            "merchant": "GenericVendor",
            "amount_cents": -7000,
            "currency": "USD",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_high_confidence_routes_to_auto_approved(
    client: TestClient, fake_categorizer_factory: MagicMock
) -> None:
    fake_categorizer_factory.return_value = _fake_cat("6070", 0.95)
    tx_id = _create_tx(client)

    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["predicted_category_code"] == "6070"
    assert body["status"] == "auto_approved"
    assert body["model_name"] == "claude-haiku-test"
    assert body["estimated_cost_usd"] == 0.001


def test_mid_confidence_routes_to_needs_review(
    client: TestClient, fake_categorizer_factory: MagicMock
) -> None:
    fake_categorizer_factory.return_value = _fake_cat("6070", 0.75)
    tx_id = _create_tx(client)

    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201
    assert res.json()["status"] == "needs_review"


def test_unknown_category_routes_to_needs_review(
    client: TestClient, fake_categorizer_factory: MagicMock
) -> None:
    fake_categorizer_factory.return_value = _fake_cat("9999", 0.99)
    tx_id = _create_tx(client)

    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201
    # Even though confidence is high, an unknown category cannot be auto-posted.
    assert res.json()["status"] == "needs_review"


def test_uncategorizable_sentinel_routes_correctly(
    client: TestClient, fake_categorizer_factory: MagicMock
) -> None:
    fake_categorizer_factory.return_value = _fake_cat("UNCATEGORIZABLE", 0.0)
    tx_id = _create_tx(client)

    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201
    assert res.json()["status"] == "uncategorizable"


def test_provider_api_error_routes_to_failed(
    client: TestClient, fake_categorizer_factory: MagicMock
) -> None:
    fake_categorizer_factory.return_value = _fake_cat(
        "UNCATEGORIZABLE",
        0.0,
        reasoning="Anthropic APIError; harness did not retry.",
    )
    tx_id = _create_tx(client)

    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201
    assert res.json()["status"] == "failed"


def test_categorize_nonexistent_transaction_404(client: TestClient) -> None:
    res = client.post("/categorize", json={"transaction_id": "tx_nope"})
    assert res.status_code == 404


def test_missing_provider_config_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom() -> None:
        raise MissingProviderConfig("Anthropic", "ANTHROPIC_API_KEY")

    monkeypatch.setattr(categorize_svc, "get_default_categorizer", boom)
    tx_id = _create_tx(client)

    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 503
    detail = res.json()["detail"]
    assert detail["error"] == "missing_provider_config"
    assert detail["env_var"] == "ANTHROPIC_API_KEY"


def test_get_categorization_results_for_transaction(
    client: TestClient, fake_categorizer_factory: MagicMock
) -> None:
    fake_categorizer_factory.return_value = _fake_cat("6070", 0.95)
    tx_id = _create_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.get(f"/transactions/{tx_id}/categorization-results")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
