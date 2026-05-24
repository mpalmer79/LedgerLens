"""Safe selected-row mapping apply.

The apply endpoint:
- only touches explicitly-selected transaction ids;
- recalculates eligibility server-side;
- rejects human-corrected, accountant-follow-up,
  ACCOUNTANT_REVIEW_REQUIRED, UNCATEGORIZABLE, and
  correction-memory rows;
- records an audit event with actor metadata.
"""

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


def _fake_cat(code: str = "9999") -> MagicMock:
    fake = MagicMock()
    fake.categorize.return_value = PredResult(
        transaction_id="ignored",
        predicted_category_code=code,
        confidence=0.0,
        reasoning="fallback",
        alternative_category_code=None,
        cost_usd=0.0,
        latency_ms=0,
        model="claude-haiku-test",
    )
    return fake


def _seed_napa(client: TestClient, description: str = "NAPA AUTO PARTS PURCHASE") -> str:
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
    tx_id = res.json()["id"]
    client.post("/categorize", json={"transaction_id": tx_id})
    return tx_id


# ── Validation ─────────────────────────────────────────────────────


def test_apply_rejects_unknown_intent(client: TestClient) -> None:
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "nope_zzz",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": ["tx_anything"],
        },
    )
    assert res.status_code == 422


def test_apply_rejects_unknown_category_code(client: TestClient) -> None:
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "9999",
            "block_fallback": False,
            "selected_transaction_ids": ["tx_anything"],
        },
    )
    assert res.status_code == 422


def test_apply_rejects_empty_selected_ids(client: TestClient) -> None:
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": [],
        },
    )
    assert res.status_code == 422


# ── Happy path ─────────────────────────────────────────────────────


def test_apply_changes_only_selected_eligible_rows(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa(client)

    # Confirm the row is eligible per the preview.
    pre = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    ).json()
    row = next(r for r in pre["rows"] if r["transaction_id"] == tx_id)
    assert row["eligible"] is True
    old_code = row["current_category_code"]

    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": [tx_id],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["requested_count"] == 1
    assert body["applied_count"] == 1
    assert body["rejected_count"] == 0
    assert body["audit_event_id"]

    # Ledger row now carries the new code.
    ledger = client.get("/ledger").json()
    row = next(r for r in ledger["rows"] if r["transaction_id"] == tx_id)
    assert row["category_code"] == "6080"
    assert old_code != "6080"


def test_apply_audit_event_is_recorded_with_actor(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa(client)
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": [tx_id],
        },
    )
    assert res.status_code == 200
    events = client.get("/audit-events?action=mapping_apply.selected_rows_applied").json()["events"]
    assert events
    e = events[0]
    assert e["actor_display_name"] == "Demo Owner"
    metadata = e["details"].get("metadata") or {}
    assert metadata["requested_count"] == 1
    assert metadata["applied_count"] == 1
    assert metadata["rejected_count"] == 0


# ── Server-side eligibility (frontend cannot bypass) ───────────────


def test_apply_rejects_human_corrected_row(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa(client)
    # Human correction makes the row protected.
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "owner pick"},
    )

    # Frontend supplies the protected tx id anyway — server must reject it.
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6010",
            "block_fallback": False,
            "selected_transaction_ids": [tx_id],
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["applied_count"] == 0
    assert body["rejected_count"] == 1
    assert "human-corrected" in body["rejected_rows"][0]["reason"]


def test_apply_rejects_accountant_review_row(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa(client)
    client.post(
        f"/review-queue/{tx_id}/accountant-review",
        json={
            "owner_question_key": "parts_vendor",
            "owner_answer_label": "Needs accountant review",
        },
    )

    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": [tx_id],
        },
    )
    body = res.json()
    assert body["applied_count"] == 0
    assert body["rejected_count"] == 1


def test_apply_rejects_unknown_transaction(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": ["tx_does_not_exist"],
        },
    )
    body = res.json()
    assert body["applied_count"] == 0
    assert body["rejected_count"] == 1
    assert "transaction not found" in body["rejected_rows"][0]["reason"]


def test_apply_block_fallback_routes_selected_rows_to_review(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa(client)
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": None,
            "block_fallback": True,
            "selected_transaction_ids": [tx_id],
        },
    )
    body = res.json()
    assert body["applied_count"] == 1
    # Status flipped to needs_review; trust panel no longer counts it
    # as verified finalized.
    ledger = client.get("/ledger").json()
    row = next(r for r in ledger["rows"] if r["transaction_id"] == tx_id)
    assert row["categorization_status"] == "needs_review"


def test_apply_does_not_touch_unselected_rows(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat()
    target_id = _seed_napa(client, description="NAPA AUTO PARTS A")
    untouched_id = _seed_napa(client, description="NAPA AUTO PARTS B")

    pre_ledger = client.get("/ledger").json()
    before_untouched = next(r for r in pre_ledger["rows"] if r["transaction_id"] == untouched_id)

    client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "6080",
            "block_fallback": False,
            "selected_transaction_ids": [target_id],
        },
    )
    post_ledger = client.get("/ledger").json()
    after_untouched = next(r for r in post_ledger["rows"] if r["transaction_id"] == untouched_id)
    assert before_untouched == after_untouched
