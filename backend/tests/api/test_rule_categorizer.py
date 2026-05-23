"""Tests for the deterministic rule layer and its integration with categorize."""

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from ledgerlens.categorizers.base import CategorizationResult as PredResult
from ledgerlens.services import categorize as categorize_svc
from ledgerlens.services import rule_categorizer as rule_svc


def _fake_cat(code: str, confidence: float = 0.95) -> MagicMock:
    fake = MagicMock()
    fake.categorize.return_value = PredResult(
        transaction_id="ignored",
        predicted_category_code=code,
        confidence=confidence,
        reasoning="model says so",
        alternative_category_code=None,
        cost_usd=0.001,
        latency_ms=1234,
        model="claude-haiku-test",
    )
    return fake


@pytest.fixture
def fake_factory(monkeypatch: pytest.MonkeyPatch) -> Iterator[MagicMock]:
    factory = MagicMock()
    monkeypatch.setattr(categorize_svc, "get_default_categorizer", factory)
    yield factory


def _create_tx(
    client: TestClient,
    *,
    description: str,
    merchant: str | None = None,
    amount_cents: int = -2400,
) -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": description,
            "merchant": merchant,
            "amount_cents": amount_cents,
            "currency": "USD",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ── Rule auto-approve ──────────────────────────────────────────────────────


def test_exact_merchant_rule_auto_approves(client: TestClient, fake_factory: MagicMock) -> None:
    tx_id = _create_tx(client, description="ADOBE CREATIVE CLOUD MO", merchant="Adobe")
    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["model_provider"] == "rule_categorizer"
    assert body["model_name"] == "rule.adobe.software"
    assert body["predicted_category_code"] == "6070"
    assert body["estimated_cost_usd"] == 0.0
    assert body["status"] == "auto_approved"


def test_rule_categorization_does_not_call_model(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.99)
    tx_id = _create_tx(client, description="STAPLES STORE 4421", merchant="Staples")
    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201
    assert res.json()["model_provider"] == "rule_categorizer"
    # The factory was never called → the model was never built or invoked.
    assert fake_factory.call_count == 0


def test_audit_event_written_for_rule_match(client: TestClient, fake_factory: MagicMock) -> None:
    tx_id = _create_tx(client, description="ZOOM.US MONTHLY", merchant="Zoom")
    client.post("/categorize", json={"transaction_id": tx_id})
    events = client.get("/audit/events?entity_type=categorization_result").json()
    actions = [e["action"] for e in events]
    assert "categorized_from_rules" in actions


def test_no_rule_match_falls_through_to_model(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("6010", 0.95)
    tx_id = _create_tx(client, description="LANDLORD JONES RENT MARCH", merchant="Jones Property")
    res = client.post("/categorize", json={"transaction_id": tx_id})
    body = res.json()
    assert body["model_provider"] == "anthropic"
    assert body["predicted_category_code"] == "6010"
    fake_factory.return_value.categorize.assert_called_once()


def test_low_confidence_rule_routes_to_review(client: TestClient, fake_factory: MagicMock) -> None:
    # Amazon rule has confidence 0.4 — below the 0.9 auto threshold and below
    # the 0.6 review threshold, so it must route to needs_review and never auto-apply.
    tx_id = _create_tx(client, description="AMAZON BUSINESS ORDER 113-22", merchant="Amazon")
    res = client.post("/categorize", json={"transaction_id": tx_id})
    body = res.json()
    assert body["model_provider"] == "rule_categorizer"
    assert body["model_name"] == "rule.amazon.review"
    assert body["status"] == "needs_review"


# ── Conflict handling ──────────────────────────────────────────────────────


def test_conflicting_rules_route_to_review(
    client: TestClient,
    fake_factory: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two rules matching the same input but disagreeing → review."""
    custom_rules = [
        {
            "id": "rule.test.a",
            "name": "Test rule A → 6070",
            "active": True,
            "priority": 50,
            "match_type": "merchant_contains",
            "merchant_patterns": ["TESTCO"],
            "description_patterns": [],
            "category_code": "6070",
            "confidence": 0.95,
            "explanation": "test A",
            "notes": "",
        },
        {
            "id": "rule.test.b",
            "name": "Test rule B → 6080",
            "active": True,
            "priority": 50,
            "match_type": "description_contains",
            "merchant_patterns": [],
            "description_patterns": ["TESTCO"],
            "category_code": "6080",
            "confidence": 0.95,
            "explanation": "test B",
            "notes": "",
        },
    ]
    monkeypatch.setattr(rule_svc, "_load_rules_from_resource", lambda: custom_rules)

    tx_id = _create_tx(client, description="TESTCO INVOICE 99", merchant="TestCo")
    res = client.post("/categorize", json={"transaction_id": tx_id})
    body = res.json()
    assert body["status"] == "needs_review"
    assert body["model_provider"] == "rule_categorizer"
    assert "different categories" in body["explanation"].lower()
    # And an audit event was written for the conflict.
    events = client.get("/audit/events?entity_type=categorization_result").json()
    actions = [e["action"] for e in events]
    assert "rule_conflict_routed_to_review" in actions


# ── Layer priority ─────────────────────────────────────────────────────────


def test_correction_memory_beats_rules(client: TestClient, fake_factory: MagicMock) -> None:
    """If correction memory exists, the rule layer must not be consulted."""
    # First categorize Adobe (matches the bundled rule → 6070), then correct
    # to 6080. After that, future Adobe transactions should come from memory
    # (6080), NOT from the rule layer (6070).
    fake_factory.return_value = _fake_cat("9999", 0.0)  # model unused either way
    tx_id = _create_tx(client, description="ADOBE CC 2026-03", merchant="Adobe")
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "actually consulting"},
    )

    new_tx = _create_tx(client, description="ADOBE CC 2026-04", merchant="Adobe")
    res = client.post("/categorize", json={"transaction_id": new_tx})
    body = res.json()
    assert body["model_provider"] == "correction_memory"
    assert body["predicted_category_code"] == "6080"


# ── Loader validation ─────────────────────────────────────────────────────


def test_loader_skips_rule_with_unknown_category(
    client: TestClient,
    fake_factory: MagicMock,
    db_session,  # type: ignore[no-untyped-def]
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    custom_rules = [
        {
            "id": "rule.bogus",
            "name": "Bogus category",
            "active": True,
            "priority": 100,
            "match_type": "merchant_contains",
            "merchant_patterns": ["BOGUSCO"],
            "description_patterns": [],
            "category_code": "9999",  # not in COA
            "confidence": 0.95,
            "explanation": "bogus",
            "notes": "",
        },
    ]
    monkeypatch.setattr(rule_svc, "_load_rules_from_resource", lambda: custom_rules)
    loaded = rule_svc.load_rules(db_session)
    assert loaded == []


def test_loader_skips_inactive_rules(
    db_session,  # type: ignore[no-untyped-def]
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    custom_rules = [
        {
            "id": "rule.inactive",
            "name": "Inactive",
            "active": False,
            "priority": 100,
            "match_type": "merchant_contains",
            "merchant_patterns": ["INACTIVECO"],
            "description_patterns": [],
            "category_code": "6070",
            "confidence": 0.95,
            "explanation": "inactive",
            "notes": "",
        },
    ]
    monkeypatch.setattr(rule_svc, "_load_rules_from_resource", lambda: custom_rules)
    loaded = rule_svc.load_rules(db_session)
    assert loaded == []


def test_loader_drops_generic_only_patterns(
    db_session,  # type: ignore[no-untyped-def]
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    custom_rules = [
        {
            "id": "rule.generic",
            "name": "Generic only",
            "active": True,
            "priority": 100,
            "match_type": "description_contains",
            "merchant_patterns": [],
            "description_patterns": ["ACH", "POS", "X"],  # blocklist + too short
            "category_code": "6070",
            "confidence": 0.95,
            "explanation": "generic",
            "notes": "",
        },
    ]
    monkeypatch.setattr(rule_svc, "_load_rules_from_resource", lambda: custom_rules)
    loaded = rule_svc.load_rules(db_session)
    # All description patterns get stripped, and the rule has no merchant
    # patterns, so it's dropped entirely.
    assert loaded == []


# ── REST endpoints ─────────────────────────────────────────────────────────


def test_list_rules_endpoint(client: TestClient) -> None:
    res = client.get("/rules")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] > 0
    ids = [r["id"] for r in body["items"]]
    assert "rule.adobe.software" in ids
    # All bundled rules must reference a valid COA code (the loader filters
    # the rest out at startup).
    for r in body["items"]:
        assert r["category_code"]
        assert r["category_name"]


def test_rule_matches_endpoint_apply(client: TestClient) -> None:
    tx_id = _create_tx(client, description="ADOBE CREATIVE CLOUD", merchant="Adobe")
    res = client.get(f"/transactions/{tx_id}/rule-matches")
    assert res.status_code == 200
    body = res.json()
    assert body["verdict"] == "apply"
    assert body["rule"]["id"] == "rule.adobe.software"


def test_rule_matches_endpoint_none(client: TestClient) -> None:
    tx_id = _create_tx(client, description="OBSCURE INDIE VENDOR", merchant="Obscure")
    res = client.get(f"/transactions/{tx_id}/rule-matches")
    assert res.status_code == 200
    body = res.json()
    assert body["verdict"] == "none"
    assert body["rule"] is None


def test_categorize_batch_zero_cost_counted(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("6010", 0.95)
    rule_tx = _create_tx(client, description="STAPLES STORE 9", merchant="Staples")
    model_tx = _create_tx(client, description="LANDLORD JONES RENT JUN", merchant="Jones Property")
    res = client.post(
        "/categorize/batch",
        json={"transaction_ids": [rule_tx, model_tx]},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["total"] == 2
    assert body["zero_cost"] == 1
    providers = {r["model_provider"] for r in body["results"]}
    assert providers == {"rule_categorizer", "anthropic"}
