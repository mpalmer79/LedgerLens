"""Guided-demo endpoints: seed, reset, status, sample-transactions.

All write endpoints are guarded to CATEGORIZER_MODE=demo_stub. The reset
must only delete rows that came from demo seeding, never anything else.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from ledgerlens.config import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _force_demo_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATEGORIZER_MODE", "demo_stub")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    get_settings.cache_clear()


def _force_anthropic_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATEGORIZER_MODE", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    get_settings.cache_clear()


def test_status_is_safe_in_any_mode(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _force_anthropic_mode(monkeypatch)
    res = client.get("/demo/status")
    assert res.status_code == 200
    body = res.json()
    assert body["demo_mode"] is False
    assert body["categorizer_mode"] == "anthropic"
    assert "transaction_count" in body


def test_seed_creates_demo_rows_with_source_tag(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_demo_mode(monkeypatch)
    res = client.post("/demo/seed")
    assert res.status_code == 201
    body = res.json()
    assert body["count"] == len(body["created"])
    assert body["count"] >= 10
    assert all(tx["source"] == "demo" for tx in body["created"])

    status_body = client.get("/demo/status").json()
    assert status_body["demo_transaction_count"] == body["count"]


def test_seed_outside_demo_mode_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_anthropic_mode(monkeypatch)
    res = client.post("/demo/seed")
    assert res.status_code == 503
    detail = res.json()["detail"]
    assert detail["error"] == "demo_mode_only"


def test_reset_only_deletes_demo_rows(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _force_demo_mode(monkeypatch)
    # Insert a non-demo transaction through the regular API.
    non_demo_res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-21",
            "description": "GENUINE VENDOR PAYMENT",
            "amount_cents": -9000,
            "currency": "USD",
        },
    )
    assert non_demo_res.status_code == 201
    non_demo_tx_id = non_demo_res.json()["id"]

    # Seed demo data.
    client.post("/demo/seed")
    pre_reset_status = client.get("/demo/status").json()
    assert pre_reset_status["demo_transaction_count"] >= 10
    assert pre_reset_status["transaction_count"] >= 11

    # Reset.
    reset_res = client.post("/demo/reset")
    assert reset_res.status_code == 200
    body = reset_res.json()
    assert body["deleted_transactions"] >= 10

    # Demo rows are gone; the non-demo transaction is untouched.
    post_reset_status = client.get("/demo/status").json()
    assert post_reset_status["demo_transaction_count"] == 0
    assert post_reset_status["transaction_count"] == 1

    # And the non-demo transaction can still be fetched.
    tx_res = client.get(f"/transactions/{non_demo_tx_id}")
    assert tx_res.status_code == 200


def test_reset_outside_demo_mode_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_anthropic_mode(monkeypatch)
    res = client.post("/demo/reset")
    assert res.status_code == 503


def test_seed_then_categorize_produces_mixed_provider_results(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """End-to-end: a seeded demo set should produce results from rules
    (Zoom, QuickBooks, Staples, etc.) AND from the demo stub (unknowns)."""
    _force_demo_mode(monkeypatch)
    seed = client.post("/demo/seed").json()
    tx_ids = [tx["id"] for tx in seed["created"]]
    res = client.post("/categorize/batch", json={"transaction_ids": tx_ids})
    assert res.status_code == 201
    providers = {r["model_provider"] for r in res.json()["results"]}
    assert "rule_categorizer" in providers
    assert "demo_stub" in providers
    # No real model calls.
    assert "anthropic" not in providers


def test_sample_transactions_returns_payload_without_writing(
    client: TestClient,
) -> None:
    res = client.get("/demo/sample-transactions")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 10
    assert all("description" in row and "amount_cents" in row for row in body)
    # Database is unchanged.
    assert client.get("/demo/status").json()["transaction_count"] == 0


# ── Sample-business scenario ───────────────────────────────────────────────


def test_scenario_endpoint_returns_granite_state_profile(client: TestClient) -> None:
    """The shared sample-business-scenario profile is exposed read-only and
    safe to call in any mode."""
    res = client.get("/demo/scenario")
    assert res.status_code == 200
    body = res.json()
    assert body["business_name"] == "Granite State Auto Repair"
    assert body["cleanup_month"] == "March 2026"
    assert body["location"] == "New Hampshire"
    assert "fictional" in body["scenario_summary"].lower()
    assert "fictional" in body["demo_disclaimer"].lower()
    assert body["handoff_filename"] == "handoff-granite-state-auto-repair-2026-03.md"


def test_seed_loads_granite_state_42_row_dataset(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Granite State Auto Repair scenario seeds 42 rows spanning a
    realistic March 2026 transaction mix (parts, payroll, utilities,
    subscriptions, fuel, deposits, ambiguous transfers)."""
    _force_demo_mode(monkeypatch)
    res = client.post("/demo/seed")
    assert res.status_code == 201
    body = res.json()
    assert body["count"] == 42
    assert body["scenario"] == "Granite State Auto Repair"
    assert body["cleanup_month"] == "March 2026"

    descriptions = " | ".join(tx["description"] for tx in body["created"])
    # Auto-repair-specific vendors are represented.
    assert "NAPA AUTO PARTS" in descriptions
    assert "AUTOZONE COMMERCIAL" in descriptions
    assert "O'REILLY AUTO PARTS" in descriptions
    assert "ADP PAYROLL" in descriptions
    assert "MITCHELL1" in descriptions
    # Ambiguous owner-decision items are represented.
    assert "ACH TRANSFER VENDOR REF" in descriptions
    assert "OWNER TRANSFER TO PERSONAL" in descriptions
    assert "ATM WITHDRAWAL" in descriptions
    # Revenue deposits are represented.
    assert "STRIPE DEPOSIT PAYOUT" in descriptions
    assert "CUSTOMER CHECK DEPOSIT" in descriptions
    # Positive amounts exist (deposits) — not just expenses.
    assert any(tx["amount_cents"] > 0 for tx in body["created"])


def test_seed_does_not_import_anthropic_sdk(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regression guard: the demo seed path must not import the Anthropic
    SDK, so the public deploy stays at $0 paid spend."""
    import sys

    _force_demo_mode(monkeypatch)
    # Drop anthropic from sys.modules so a fresh import would be visible.
    sys.modules.pop("anthropic", None)
    res = client.post("/demo/seed")
    assert res.status_code == 201
    assert "anthropic" not in sys.modules
