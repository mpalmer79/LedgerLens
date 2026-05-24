"""/rules endpoint surfaces rule intents + the active business mapping."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_rules_endpoint_exposes_intent_and_mapping(client: TestClient) -> None:
    res = client.get("/rules")
    assert res.status_code == 200
    body = res.json()
    # Mapping snapshot is attached and names the active business.
    assert body["mapping"] is not None
    assert body["mapping"]["business_id"] == "granite_state_auto_repair"
    intents = {e["intent"]: e["category_code"] for e in body["mapping"]["entries"]}
    assert intents["parts_inventory"] == "5010"
    assert intents["internet_telecom"] == "6150"
    # Individual rules carry their intent + mapped category code.
    intuit = next((r for r in body["items"] if r["id"] == "rule.intuit.software"), None)
    assert intuit is not None
    assert intuit["intent"] == "software_subscription"
    assert intuit["mapped_category_code"] == "6070"


def test_rule_categorize_uses_business_mapping(client: TestClient) -> None:
    """End-to-end: a transaction that hits a rule with an `intent` should
    persist a CategorizationResult whose code matches the active business
    mapping (and equal the rule's own code when the mapping matches)."""
    # QuickBooks Online hits rule.intuit.software (intent=software_subscription).
    # Default & Granite State maps both resolve software_subscription → 6070,
    # which is the rule's own category_code, so the persisted result is 6070.
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-02",
            "description": "QUICKBOOKS ONLINE PLUS",
            "merchant": "Intuit",
            "amount_cents": -8000,
            "currency": "USD",
        },
    )
    tx_id: str = res.json()["id"]
    cat = client.post("/categorize", json={"transaction_id": tx_id}).json()
    assert cat["predicted_category_code"] == "6070"
    assert cat["model_provider"] == "rule_categorizer"
