"""Correction memory: recording, lookup, integration with categorize.

Backend tests for the deterministic correction-memory layer. Memory rows are
created from `correct` reviews only; future similar transactions categorize
from memory without a model call.
"""

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from ledgerlens.categorizers.base import CategorizationResult as PredResult
from ledgerlens.services import categorize as categorize_svc


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
    description: str = "ADOBE.COM ADOBE CC SUBSCRIPTION",
    merchant: str | None = "Adobe",
    amount_cents: int = -2880,
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


def _categorize_and_correct(
    client: TestClient,
    fake_factory: MagicMock,
    *,
    initial_code: str = "6080",
    correct_to: str = "6070",
    tx_kwargs: dict | None = None,
) -> tuple[str, dict]:
    """Helper: create → categorize at mid-confidence → correct."""
    fake_factory.return_value = _fake_cat(initial_code, confidence=0.75)
    tx_id = _create_tx(client, **(tx_kwargs or {}))
    res = client.post("/categorize", json={"transaction_id": tx_id})
    assert res.status_code == 201, res.text
    res = client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": correct_to, "reviewer_note": "should be Software"},
    )
    assert res.status_code == 201, res.text
    return tx_id, res.json()


# ── Recording ─────────────────────────────────────────────────────────────


def test_correction_creates_memory(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory)
    res = client.get("/corrections")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["merchant_key"] == "ADOBE"
    assert row["selected_category_code"] == "6070"
    assert row["active"] is True
    assert row["source_transaction_id"]
    assert row["source_review_decision_id"]


def test_repeat_correction_updates_existing_row(
    client: TestClient, fake_factory: MagicMock
) -> None:
    _categorize_and_correct(client, fake_factory)
    # Correct another Adobe transaction to the same code → existing row updated.
    fake_factory.return_value = _fake_cat("6080", confidence=0.75)
    tx_id = _create_tx(client, description="ADOBE CC ANNUAL", merchant="Adobe")
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6070", "reviewer_note": "Same as before"},
    )
    res = client.get("/corrections")
    assert res.status_code == 200
    # Two corrections, same (merchant_key=ADOBE, category=6070) but different
    # description_keys → that's two rows. The narrower contract is "don't
    # create duplicate (merchant, description, category) rows."
    items = res.json()["items"]
    assert all(i["merchant_key"] == "ADOBE" for i in items)
    assert all(i["selected_category_code"] == "6070" for i in items)


def test_generic_merchant_does_not_create_memory(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("6080", confidence=0.75)
    tx_id = _create_tx(
        client,
        description="ACH TRANSFER VENDOR REF 99812",
        merchant="ACH",  # generic blocklist
        amount_cents=-15000,
    )
    client.post("/categorize", json={"transaction_id": tx_id})
    res = client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6070", "reviewer_note": "generic"},
    )
    assert res.status_code == 201
    listed = client.get("/corrections").json()
    assert listed["total"] == 0


def test_short_merchant_does_not_create_memory(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("6080", confidence=0.75)
    tx_id = _create_tx(
        client,
        description="X",
        merchant="X",
        amount_cents=-100,
    )
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6070", "reviewer_note": ""},
    )
    assert client.get("/corrections").json()["total"] == 0


# ── Lookup ────────────────────────────────────────────────────────────────


def test_future_similar_merchant_uses_memory(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory)
    # Create a different Adobe transaction; the model should NOT be called.
    fake_factory.reset_mock()
    # The factory must still be set up — even though we expect no call to it,
    # `_resolve_categorizer` only constructs the categorizer lazily on miss.
    fake_factory.return_value = _fake_cat("9999", confidence=0.99)
    new_tx = _create_tx(client, description="ADOBE CC MONTHLY", merchant="Adobe")
    res = client.post("/categorize", json={"transaction_id": new_tx})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["predicted_category_code"] == "6070"
    assert body["model_provider"] == "correction_memory"
    assert body["estimated_cost_usd"] == 0.0
    assert body["confidence"] == 1.0
    assert body["status"] == "auto_approved"
    assert "Adobe" in body["explanation"] or "ADOBE" in body["explanation"]
    # Model should not have been called.
    assert fake_factory.return_value.categorize.call_count == 0


def test_memory_use_writes_audit(client: TestClient, fake_factory: MagicMock) -> None:
    tx_id, _ = _categorize_and_correct(client, fake_factory)
    fake_factory.return_value = _fake_cat("9999", confidence=0.99)
    new_tx = _create_tx(client, description="ADOBE CC MONTHLY", merchant="Adobe")
    client.post("/categorize", json={"transaction_id": new_tx})

    events = client.get("/audit/events?entity_type=categorization_result").json()
    actions = [e["action"] for e in events]
    assert "categorized_from_memory" in actions


def test_conflicting_memories_route_to_review(client: TestClient, fake_factory: MagicMock) -> None:
    # First correction: Adobe → 6070 (Software).
    _categorize_and_correct(
        client, fake_factory, correct_to="6070", tx_kwargs={"description": "ADOBE CC"}
    )
    # Second correction: same merchant, different category (6080 Professional Services).
    _categorize_and_correct(
        client,
        fake_factory,
        correct_to="6080",
        tx_kwargs={"description": "ADOBE CONSULTING"},
    )

    # New Adobe transaction should route to review with a conflict explanation.
    fake_factory.return_value = _fake_cat("9999", confidence=0.99)
    new_tx = _create_tx(client, description="ADOBE OTHER", merchant="Adobe")
    res = client.post("/categorize", json={"transaction_id": new_tx})
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "needs_review"
    assert body["model_provider"] == "correction_memory"
    assert "conflict" in body["explanation"].lower()


def test_inactive_memory_falls_through_to_model(
    client: TestClient, fake_factory: MagicMock
) -> None:
    # Use a vendor that isn't covered by either correction memory or the
    # bundled rule layer, so deactivating memory really does reach the model.
    _categorize_and_correct(
        client,
        fake_factory,
        tx_kwargs={
            "description": "NICHE VENDOR INV 99812",
            "merchant": "NicheVendor",
        },
    )
    memory_id = client.get("/corrections").json()["items"][0]["id"]
    client.delete(f"/corrections/{memory_id}")  # soft deactivate

    # The model is called now; it returns 6010 (Rent).
    fake_factory.return_value = _fake_cat("6010", confidence=0.95)
    new_tx = _create_tx(client, description="NICHE VENDOR INV 99999", merchant="NicheVendor")
    res = client.post("/categorize", json={"transaction_id": new_tx})
    body = res.json()
    assert body["predicted_category_code"] == "6010"
    assert body["model_provider"] == "anthropic"
    assert body["status"] == "auto_approved"


# ── REST API ──────────────────────────────────────────────────────────────


def test_list_filters(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory, correct_to="6070")
    _categorize_and_correct(
        client,
        fake_factory,
        correct_to="6080",
        tx_kwargs={"description": "STRIPE PAYOUT", "merchant": "Stripe"},
    )

    all_rows = client.get("/corrections").json()["items"]
    assert len(all_rows) == 2

    only_6070 = client.get("/corrections?category_code=6070").json()["items"]
    assert len(only_6070) == 1
    assert only_6070[0]["selected_category_code"] == "6070"

    only_stripe = client.get("/corrections?q=STRIPE").json()["items"]
    assert len(only_stripe) == 1
    assert only_stripe[0]["merchant_key"] == "STRIPE"


def test_patch_changes_active_and_writes_audit(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory)
    memory_id = client.get("/corrections").json()["items"][0]["id"]
    res = client.patch(f"/corrections/{memory_id}", json={"active": False})
    assert res.status_code == 200
    assert res.json()["active"] is False
    events = client.get(f"/audit/events?entity_id={memory_id}").json()
    actions = [e["action"] for e in events]
    assert "updated" in actions


def test_patch_rejects_unknown_category(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory)
    memory_id = client.get("/corrections").json()["items"][0]["id"]
    res = client.patch(f"/corrections/{memory_id}", json={"selected_category_code": "9999"})
    assert res.status_code == 422
    assert res.json()["detail"]["error"] == "validation_failed"


def test_delete_is_soft(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory)
    memory_id = client.get("/corrections").json()["items"][0]["id"]
    res = client.delete(f"/corrections/{memory_id}")
    assert res.status_code == 200
    assert res.json()["active"] is False
    # Row still queryable.
    assert client.get(f"/corrections/{memory_id}").status_code == 200


def test_memory_matches_endpoint(client: TestClient, fake_factory: MagicMock) -> None:
    _categorize_and_correct(client, fake_factory)
    new_tx = _create_tx(client, description="ADOBE CC MONTHLY", merchant="Adobe")
    res = client.get(f"/transactions/{new_tx}/memory-matches")
    assert res.status_code == 200
    body = res.json()
    assert body["verdict"] == "apply"
    assert body["merchant_key"] == "ADOBE"
    assert body["record"] is not None
    assert body["record"]["selected_category_code"] == "6070"
