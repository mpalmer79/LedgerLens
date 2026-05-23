"""Portfolio-safe demo stub mode: no Anthropic, no cost, no autop-approval.

These tests exercise the real `get_default_categorizer` (no monkeypatching)
under `CATEGORIZER_MODE=demo_stub`. The only way the test could leak to
Anthropic is if the production code regressed — which is the point.
"""

from __future__ import annotations

import sys

import pytest
from fastapi.testclient import TestClient

from ledgerlens.config import Settings, get_settings
from ledgerlens.services import categorize as categorize_svc


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    """`get_settings` is lru_cached; flush so per-test env changes take effect."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _force_demo_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATEGORIZER_MODE", "demo_stub")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")  # explicitly absent
    get_settings.cache_clear()


def _force_anthropic_mode(monkeypatch: pytest.MonkeyPatch, *, key: str | None = None) -> None:
    monkeypatch.setenv("CATEGORIZER_MODE", "anthropic")
    if key is None:
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    else:
        monkeypatch.setenv("ANTHROPIC_API_KEY", key)
    get_settings.cache_clear()


def _create_tx(
    client: TestClient,
    *,
    description: str = "OBSCURE INDIE VENDOR",
    merchant: str | None = None,
) -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": description,
            "merchant": merchant,
            "amount_cents": -4321,
            "currency": "USD",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ── Config validation ─────────────────────────────────────────────────────


def test_invalid_categorizer_mode_raises_validation_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CATEGORIZER_MODE", "ferret")
    get_settings.cache_clear()
    with pytest.raises(Exception) as info:
        Settings()
    assert "CATEGORIZER_MODE" in str(info.value)


def test_default_mode_is_demo_stub(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CATEGORIZER_MODE", raising=False)
    get_settings.cache_clear()
    settings = Settings()
    assert settings.categorizer_mode == "demo_stub"
    assert settings.is_demo_mode is True


# ── Factory honors mode ───────────────────────────────────────────────────


def test_factory_returns_demo_stub_in_demo_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    _force_demo_mode(monkeypatch)
    cat = categorize_svc.get_default_categorizer()
    assert cat.name == "demo-stub-v1"


def test_factory_does_not_import_anthropic_in_demo_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _force_demo_mode(monkeypatch)
    # Drop any cached anthropic import so we can detect a fresh one.
    sys.modules.pop("anthropic", None)
    categorize_svc.get_default_categorizer()
    assert "anthropic" not in sys.modules, "demo_stub mode must NOT import the anthropic SDK"


def test_factory_anthropic_mode_missing_key_raises_provider_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _force_anthropic_mode(monkeypatch, key=None)
    from ledgerlens.errors import MissingProviderConfig

    with pytest.raises(MissingProviderConfig):
        categorize_svc.get_default_categorizer()


# ── End-to-end categorize without ANTHROPIC_API_KEY ───────────────────────


def test_categorize_in_demo_mode_routes_to_review_at_zero_cost(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_demo_mode(monkeypatch)
    tx_id = _create_tx(client)
    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["model_provider"] == "demo_stub"
    assert body["model_name"] == "portfolio_stub_v1"
    assert body["estimated_cost_usd"] == 0.0
    assert body["status"] == "uncategorizable"
    assert "demo stub" in body["explanation"].lower()


def test_demo_stub_audit_event_written(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _force_demo_mode(monkeypatch)
    tx_id = _create_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})
    events = client.get("/audit/events?entity_type=categorization_result").json()
    actions = [e["action"] for e in events]
    assert "categorized_by_demo_stub" in actions


def test_correction_memory_still_beats_demo_stub(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_demo_mode(monkeypatch)
    # First categorize Adobe (rule wins → 6070), then correct to 6080 so
    # memory holds that mapping. A later Adobe tx must come from memory,
    # NOT the demo stub.
    tx_id = _create_tx(client, description="ADOBE CC 2026-03", merchant="Adobe")
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "actually services"},
    )
    new_tx = _create_tx(client, description="ADOBE CC 2026-04", merchant="Adobe")
    res = client.post("/categorize", json={"transaction_id": new_tx})
    body = res.json()
    assert body["model_provider"] == "correction_memory"
    assert body["predicted_category_code"] == "6080"


def test_rule_layer_still_beats_demo_stub(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_demo_mode(monkeypatch)
    tx_id = _create_tx(client, description="ZOOM.US MONTHLY SUBSCRIPTION")
    res = client.post("/categorize", json={"transaction_id": tx_id})
    body = res.json()
    assert body["model_provider"] == "rule_categorizer"
    assert body["model_name"] == "rule.zoom.software"
    assert body["status"] == "auto_approved"


# ── Readiness reflects mode ───────────────────────────────────────────────


def test_ready_reports_demo_mode_without_anthropic(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_demo_mode(monkeypatch)
    res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is True
    cat = body["checks"]["categorizer"]
    assert cat["mode"] == "demo_stub"
    assert cat["demo_mode"] is True
    anth = body["checks"]["anthropic"]
    assert anth["configured"] is False
    assert anth["required_for_current_mode"] is False


def test_ready_flips_not_ready_in_anthropic_mode_without_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _force_anthropic_mode(monkeypatch, key=None)
    res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is False
    anth = body["checks"]["anthropic"]
    assert anth["configured"] is False
    assert anth["required_for_current_mode"] is True
