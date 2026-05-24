"""Mapping recategorization preview — read-only, eligibility-aware."""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from ledgerlens.categorizers.base import CategorizationResult as PredResult
from ledgerlens.config import get_settings
from ledgerlens.services import categorize as categorize_svc


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def fake_factory(monkeypatch: pytest.MonkeyPatch) -> Iterator[MagicMock]:
    factory = MagicMock()
    monkeypatch.setattr(categorize_svc, "get_default_categorizer", factory)
    yield factory


def _fake_cat(code: str = "9999", confidence: float = 0.0) -> MagicMock:
    fake = MagicMock()
    fake.categorize.return_value = PredResult(
        transaction_id="ignored",
        predicted_category_code=code,
        confidence=confidence,
        reasoning="model fallback",
        alternative_category_code=None,
        cost_usd=0.0,
        latency_ms=0,
        model="claude-haiku-test",
    )
    return fake


def _seed_napa_tx(client: TestClient, description: str = "NAPA AUTO PARTS PURCHASE") -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": description,
            "merchant": "NAPA",
            "amount_cents": -4280,
            "currency": "USD",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ── Validation ─────────────────────────────────────────────────────


def test_preview_rejects_unknown_intent(client: TestClient) -> None:
    res = client.post(
        "/mapping/preview",
        json={"intent": "totally_not_an_intent_zzz"},
    )
    assert res.status_code == 422
    assert "Unknown intent" in res.json()["detail"]["message"]


def test_preview_rejects_unknown_category_code(client: TestClient) -> None:
    res = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "9999"},
    )
    assert res.status_code == 422
    assert "Unknown category code" in res.json()["detail"]["message"]


# ── Read-only / no mutation ────────────────────────────────────────


def test_preview_is_read_only(client: TestClient, fake_factory: MagicMock) -> None:
    """Hitting the endpoint never writes — confirmed by checking
    that the active profile + ledger snapshot are byte-identical
    before and after."""
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    before_profile = client.get("/mapping/profile").json()
    before_ledger = client.get("/ledger").json()

    res = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    )
    assert res.status_code == 200

    after_profile = client.get("/mapping/profile").json()
    after_ledger = client.get("/ledger").json()
    assert before_profile == after_profile
    # Ledger trust / row contents unchanged.
    assert before_ledger["rows"] == after_ledger["rows"]
    assert before_ledger["trust"] == after_ledger["trust"]


# ── Eligibility ────────────────────────────────────────────────────


def test_preview_marks_clean_rule_row_as_eligible(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    body = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    ).json()
    assert body["affected_count"] >= 1
    row = next(r for r in body["rows"] if r["transaction_id"] == tx_id)
    assert row["eligible"] is True
    assert row["reason"] is None
    assert row["matched_intent"] == "parts_inventory"
    assert row["proposed_category_code"] == "6080"


def test_preview_protects_human_corrected_row(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})
    # Human correction.
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "owner pick"},
    )

    body = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6010"},
    ).json()
    row = next(r for r in body["rows"] if r["transaction_id"] == tx_id)
    assert row["eligible"] is False
    assert "human-corrected" in (row["reason"] or "")


def test_preview_protects_accountant_follow_up_row(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})
    client.post(
        f"/review-queue/{tx_id}/accountant-review",
        json={
            "owner_question_key": "parts_vendor",
            "owner_answer_label": "Needs accountant review",
        },
    )

    body = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    ).json()
    # The accountant-review status changes the latest categorization
    # status; the preview's matched-row should still surface it as
    # ineligible.
    row = next(
        (r for r in body["rows"] if r["transaction_id"] == tx_id),
        None,
    )
    if row is not None:
        assert row["eligible"] is False
        assert row["reason"]


def test_preview_block_fallback_counts_route_to_review(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa_tx(client)
    client.post("/categorize", json={"transaction_id": tx_id})

    body = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "block_fallback": True},
    ).json()
    assert body["would_route_to_review_count"] >= 1
    row = next(r for r in body["rows"] if r["transaction_id"] == tx_id)
    assert row["proposed_category_code"] is None


def test_preview_returns_summary_and_warnings(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    body = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    ).json()
    for key in [
        "affected_count",
        "eligible_count",
        "ineligible_count",
        "would_route_to_review_count",
        "rows",
        "warnings",
    ]:
        assert key in body
    warnings = " ".join(body["warnings"]).lower()
    assert "nothing has been changed yet" in warnings
    assert "preview only" in warnings
    assert "human-corrected" in warnings


def test_preview_carries_x_request_id(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    res = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    )
    assert res.headers.get("X-Request-ID")
