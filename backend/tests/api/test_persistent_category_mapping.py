"""Persistent editable category mapping v1.

Covers:
- GET /mapping/profile seeds + returns the active profile.
- PUT /mapping/profile/entries/{intent} validates inputs.
- POST /mapping/profile/reset re-seeds from the registry.
- The persistent profile overrides the Python registry at
  categorize time.
- block_fallback=True routes the row to review, not auto-approve.
- Existing config behavior is unchanged when no profile is edited.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

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
        reasoning="model would fall back here",
        alternative_category_code=None,
        cost_usd=0.0,
        latency_ms=0,
        model="claude-haiku-test",
    )
    return fake


# ── Read endpoint ────────────────────────────────────────────────────


def test_mapping_profile_seeded_from_registry_on_first_read(client: TestClient) -> None:
    res = client.get("/mapping/profile")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["profile_name"] == "active"
    assert body["source"] == "seed"
    assert body["business_id"] == "granite_state_auto_repair"
    assert body["business_name"] == "Granite State Auto Repair"
    # Granite State map carries at least these intents.
    intents = {e["intent"]: e for e in body["entries"]}
    assert "parts_inventory" in intents
    assert intents["parts_inventory"]["status"] == "mapped"
    assert intents["parts_inventory"]["category_code"] is not None
    # Available COA categories include a known seed code.
    codes = {c["code"] for c in body["available_categories"]}
    assert "6080" in codes
    # Public-demo warnings are echoed.
    warnings = " ".join(body["warnings"]).lower()
    assert "public demo" in warnings
    assert "do not upload real bank" in warnings
    assert "not a true accounting ledger" in warnings


def test_mapping_profile_persists_across_requests(client: TestClient) -> None:
    """A second GET returns the same profile id — no re-seed."""
    first = client.get("/mapping/profile").json()
    second = client.get("/mapping/profile").json()
    assert first["profile_id"] == second["profile_id"]
    assert first["source"] == second["source"] == "seed"


# ── Write endpoint ───────────────────────────────────────────────────


def test_put_entry_updates_category_code(client: TestClient) -> None:
    res = client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": "6080", "block_fallback": False, "notes": "moved to services"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    intents = {e["intent"]: e for e in body["entries"]}
    parts = intents["parts_inventory"]
    assert parts["category_code"] == "6080"
    assert parts["notes"] == "moved to services"
    assert body["source"] == "user"


def test_put_entry_enables_block_fallback(client: TestClient) -> None:
    res = client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": None, "block_fallback": True},
    )
    assert res.status_code == 200
    intents = {e["intent"]: e for e in res.json()["entries"]}
    parts = intents["parts_inventory"]
    assert parts["block_fallback"] is True
    assert parts["category_code"] is None
    assert parts["status"] == "fallback_blocked"


def test_put_entry_rejects_unknown_intent(client: TestClient) -> None:
    res = client.put(
        "/mapping/profile/entries/totally_bogus_intent_zzz",
        json={"category_code": "6080", "block_fallback": False},
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["error"] == "validation_failed"
    assert "Unknown intent" in detail["message"]


def test_put_entry_rejects_unknown_category_code(client: TestClient) -> None:
    res = client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": "9999", "block_fallback": False},
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["error"] == "validation_failed"
    assert "Unknown category code" in detail["message"]


def test_put_entry_rejects_empty_intent(client: TestClient) -> None:
    res = client.put(
        "/mapping/profile/entries/%20",
        json={"category_code": "6080", "block_fallback": False},
    )
    assert res.status_code == 422


# ── Reset ────────────────────────────────────────────────────────────


def test_reset_profile_returns_to_seed(client: TestClient) -> None:
    # First edit something.
    client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": "6080", "block_fallback": False, "notes": "edited"},
    )
    edited = client.get("/mapping/profile").json()
    assert edited["source"] == "user"
    edited_parts = next(e for e in edited["entries"] if e["intent"] == "parts_inventory")
    assert edited_parts["notes"] == "edited"

    # Reset.
    res = client.post("/mapping/profile/reset")
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "seed"
    parts = next(e for e in body["entries"] if e["intent"] == "parts_inventory")
    assert parts["notes"] in (None, "")  # seed entries do not carry notes


# ── Categorization integration ───────────────────────────────────────


def _seed_napa_tx(client: TestClient) -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": "NAPA AUTO PARTS PURCHASE",
            "merchant": "NAPA",
            "amount_cents": -4280,
            "currency": "USD",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_persistent_mapping_overrides_registry_on_categorize(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """Edit `parts_inventory` to 6080; a future NAPA categorize should
    apply 6080 instead of the registry's mapped code."""
    fake_factory.return_value = _fake_cat()
    # Override the mapping first.
    res = client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": "6080", "block_fallback": False},
    )
    assert res.status_code == 200

    tx_id = _seed_napa_tx(client)
    cat = client.post("/categorize", json={"transaction_id": tx_id}).json()
    assert cat["model_provider"] == "rule_categorizer"
    assert cat["predicted_category_code"] == "6080"


def test_block_fallback_routes_to_review_not_auto_approve(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """When the owner blocks fallback for parts_inventory, a NAPA row
    matched by the parts-vendor rule must route to needs_review rather
    than auto_approve on the rule's own default code."""
    fake_factory.return_value = _fake_cat()
    client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": None, "block_fallback": True},
    )
    tx_id = _seed_napa_tx(client)
    cat = client.post("/categorize", json={"transaction_id": tx_id}).json()
    assert cat["model_provider"] == "rule_categorizer"
    assert cat["status"] == "needs_review"


def test_no_persistent_profile_falls_back_to_registry(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """Without any user edits, NAPA still categorizes through the
    registry's parts_inventory → 5010 mapping (the seed default)."""
    fake_factory.return_value = _fake_cat()
    tx_id = _seed_napa_tx(client)
    cat = client.post("/categorize", json={"transaction_id": tx_id}).json()
    assert cat["model_provider"] == "rule_categorizer"
    assert cat["status"] == "auto_approved"
    # Seeded registry maps parts_inventory → 5010 (Cost of Goods Sold).
    assert cat["predicted_category_code"] == "5010"


# ── Public-demo regression ────────────────────────────────────────────


def test_mapping_routes_return_x_request_id(client: TestClient) -> None:
    for url, method in [
        ("/mapping/profile", "GET"),
        ("/mapping/profile/entries/parts_inventory", "PUT"),
        ("/mapping/profile/reset", "POST"),
    ]:
        if method == "GET":
            r = client.get(url)
        elif method == "PUT":
            r = client.put(url, json={"category_code": "5010", "block_fallback": False})
        else:
            r = client.post(url)
        rid = r.headers.get("X-Request-ID")
        assert rid is not None and len(rid) >= 8, f"{method} {url} missing X-Request-ID"


def test_seed_resilience_when_session_already_open(db_session: Session) -> None:
    """The seeding function is idempotent within a single session."""
    from ledgerlens.services.category_mapping import (
        get_active_profile_with_entries,
    )

    p1, e1 = get_active_profile_with_entries(db_session, "granite_state_auto_repair")
    p2, e2 = get_active_profile_with_entries(db_session, "granite_state_auto_repair")
    assert p1.id == p2.id
    assert len(e1) == len(e2)
    assert len(e1) > 0
