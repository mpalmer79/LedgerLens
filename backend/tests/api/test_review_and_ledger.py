"""End-to-end workflow: import → categorize → review → ledger export."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.services import categorize as categorize_svc


def _fake(code: str, confidence: float) -> MagicMock:
    cat = MagicMock()
    cat.categorize.return_value = CategorizationResult(
        transaction_id="ignored",
        predicted_category_code=code,
        confidence=confidence,
        reasoning="test reasoning",
        alternative_category_code=None,
        cost_usd=0.001,
        latency_ms=1234,
        model="claude-haiku-test",
    )
    return cat


@pytest.fixture
def patch_categorizer(monkeypatch: pytest.MonkeyPatch):
    def _set(code: str, confidence: float) -> None:
        monkeypatch.setattr(
            categorize_svc, "get_default_categorizer", lambda: _fake(code, confidence)
        )

    return _set


def _make_tx(client: TestClient, description: str = "Test Vendor") -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": description,
            "amount_cents": -2500,
            "currency": "USD",
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def test_review_queue_lists_needs_review(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.75)  # mid confidence → needs_review
    tx_id = _make_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.get("/review-queue")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    tx_ids = {item["transaction"]["id"] for item in body["items"]}
    assert tx_id in tx_ids


def test_approve_review(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.75)
    tx_id = _make_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.post(
        f"/review-queue/{tx_id}/approve",
        json={"reviewer_note": "Looks right"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["reviewer_action"] == "approve"
    assert body["selected_category_code"] == "6070"


def test_correct_review_updates_final_category(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.75)
    tx_id = _make_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "Professional services"},
    )
    assert res.status_code == 201
    assert res.json()["reviewer_action"] == "correct"


def test_correct_rejects_unknown_category(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.75)
    tx_id = _make_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "9999", "reviewer_note": ""},
    )
    assert res.status_code == 422
    assert res.json()["detail"]["error"] == "validation_failed"


def test_mark_uncategorizable(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.75)
    tx_id = _make_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.post(
        f"/review-queue/{tx_id}/uncategorizable",
        json={"reviewer_note": "Personal expense on the wrong card"},
    )
    assert res.status_code == 201
    assert res.json()["reviewer_action"] == "mark_uncategorizable"


def test_ledger_reflects_reviewed_state(client: TestClient, patch_categorizer) -> None:
    # Three transactions: one auto-approved, one corrected, one needs-review.
    patch_categorizer("6070", 0.95)  # high — auto
    tx_auto = _make_tx(client, "QuickBooks subscription")
    client.post("/categorize", json={"transaction_id": tx_auto})

    patch_categorizer("6070", 0.75)  # mid — needs review
    tx_corr = _make_tx(client, "Misclassified vendor")
    client.post("/categorize", json={"transaction_id": tx_corr})
    client.post(
        f"/review-queue/{tx_corr}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "fixed"},
    )

    patch_categorizer("6070", 0.75)
    tx_pending = _make_tx(client, "Still ambiguous")
    client.post("/categorize", json={"transaction_id": tx_pending})

    res = client.get("/ledger")
    assert res.status_code == 200
    body = res.json()
    rows_by_tx = {r["transaction_id"]: r for r in body["rows"]}

    assert rows_by_tx[tx_auto]["category_code"] == "6070"
    assert rows_by_tx[tx_auto]["categorization_status"] == "auto_approved"

    assert rows_by_tx[tx_corr]["category_code"] == "6080"
    assert rows_by_tx[tx_corr]["categorization_status"] == "corrected"
    assert rows_by_tx[tx_corr]["reviewed"] is True

    assert rows_by_tx[tx_pending]["category_code"] is None
    assert rows_by_tx[tx_pending]["categorization_status"] == "needs_review"
    assert body["unresolved"] >= 1


def test_ledger_csv_export(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.95)
    tx_id = _make_tx(client, "Adobe CC")
    client.post("/categorize", json={"transaction_id": tx_id})

    res = client.get("/ledger/export.csv")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    text = res.text
    assert "transaction_date" in text.splitlines()[0]
    assert "Adobe CC" in text


def test_audit_events_recorded_throughout(client: TestClient, patch_categorizer) -> None:
    patch_categorizer("6070", 0.75)
    tx_id = _make_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "fix"},
    )

    res = client.get("/audit/events")
    assert res.status_code == 200
    actions = [e["action"] for e in res.json()]
    assert "created" in actions
    assert "categorized" in actions
    assert "correct" in actions
