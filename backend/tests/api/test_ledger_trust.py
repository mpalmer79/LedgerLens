"""Ledger trust metric.

A finalized ledger row is *verified* only when it came through a defensible
path: human review, correction memory, or a rule-layer auto-approval. The
trust block in /ledger and the verified column in /ledger/export.csv both
depend on that contract; these tests pin it down.
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


def _create_tx(
    client: TestClient,
    *,
    description: str,
    merchant: str | None = None,
) -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": description,
            "merchant": merchant,
            "amount_cents": -2400,
            "currency": "USD",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def _categorize(client: TestClient, tx_id: str) -> dict:  # type: ignore[type-arg]
    return client.post("/categorize", json={"transaction_id": tx_id}).json()


# ── Rule auto-approval counts as verified ─────────────────────────────────


def test_rule_auto_approval_is_verified(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)  # model never called
    tx_id = _create_tx(client, description="ADOBE CREATIVE CLOUD MO", merchant="Adobe")
    res = _categorize(client, tx_id)
    assert res["model_provider"] == "rule_categorizer"
    assert res["status"] == "auto_approved"

    body = client.get("/ledger").json()
    assert body["trust"]["finalized_count"] == 1
    assert body["trust"]["verified_count"] == 1
    assert body["trust"]["unverified_finalized_count"] == 0
    assert body["trust"]["verification_rate"] == 1.0


# ── Correction memory counts as verified ──────────────────────────────────


def test_correction_memory_replay_is_verified(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)
    # First Adobe → rule wins. Correct to 6080 → memory rule recorded.
    seed_id = _create_tx(client, description="ADOBE CC 2026-03", merchant="Adobe")
    _categorize(client, seed_id)
    client.post(
        f"/review-queue/{seed_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "services"},
    )
    # Future Adobe → categorized from memory.
    replay_id = _create_tx(client, description="ADOBE CC 2026-04", merchant="Adobe")
    replay = _categorize(client, replay_id)
    assert replay["model_provider"] == "correction_memory"

    body = client.get("/ledger").json()
    # Both rows finalized; both verified (one by review, one by memory).
    assert body["trust"]["finalized_count"] == 2
    assert body["trust"]["verified_count"] == 2
    assert body["trust"]["human_reviewed_count"] == 1
    assert body["trust"]["deterministic_count"] >= 1


# ── Demo-stub is NEVER verified ───────────────────────────────────────────


def test_demo_stub_result_is_not_finalized(client: TestClient, fake_factory: MagicMock) -> None:
    # Force demo-stub mode without touching the model factory.
    import importlib

    from ledgerlens.categorizers.demo_stub import DemoStubCategorizer

    fake_factory.side_effect = lambda: DemoStubCategorizer()
    importlib.reload  # noqa: B018 — sanity

    tx_id = _create_tx(client, description="OBSCURE INDIE VENDOR", merchant="Obscure")
    res = _categorize(client, tx_id)
    assert res["model_provider"] == "demo_stub"
    assert res["status"] == "uncategorizable"

    body = client.get("/ledger").json()
    # Uncategorizable is not finalized, so trust.finalized_count = 0.
    assert body["trust"]["finalized_count"] == 0
    assert body["trust"]["verified_count"] == 0
    assert body["trust"]["unverified_finalized_count"] == 0
    # Trust rate is 1.0 by definition when no finalized rows exist.
    assert body["trust"]["verification_rate"] == 1.0


# ── Anthropic auto-approval without review is NOT verified ────────────────


def test_anthropic_auto_approval_without_review_is_unverified(
    client: TestClient, fake_factory: MagicMock
) -> None:
    # Use a description that bypasses correction memory and the rule layer.
    fake_factory.return_value = _fake_cat("6010", 0.95)
    tx_id = _create_tx(client, description="LANDLORD JONES RENT JUN", merchant="Jones Property")
    res = _categorize(client, tx_id)
    assert res["model_provider"] == "anthropic"
    assert res["status"] == "auto_approved"

    body = client.get("/ledger").json()
    assert body["trust"]["finalized_count"] == 1
    # Auto-approved by the model with no human review → unverified.
    assert body["trust"]["verified_count"] == 0
    assert body["trust"]["unverified_finalized_count"] == 1
    assert body["trust"]["verification_rate"] == 0.0


# ── Approval after the fact promotes the row to verified ──────────────────


def test_human_approval_promotes_anthropic_to_verified(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("6010", 0.95)
    tx_id = _create_tx(client, description="LANDLORD JONES RENT JUL", merchant="Jones Property")
    _categorize(client, tx_id)
    # A bookkeeper signs off.
    approve = client.post(f"/review-queue/{tx_id}/approve", json={"reviewer_note": "ok"})
    assert approve.status_code == 201

    body = client.get("/ledger").json()
    assert body["trust"]["finalized_count"] == 1
    assert body["trust"]["verified_count"] == 1
    assert body["trust"]["unverified_finalized_count"] == 0
    assert body["trust"]["human_reviewed_count"] == 1


def test_accountant_review_row_is_unfinalized(client: TestClient, fake_factory: MagicMock) -> None:
    """A row deferred to an accountant must not be finalized or verified."""
    fake_factory.return_value = _fake_cat("6080", 0.5)
    tx_id = _create_tx(client, description="ACH DEBIT UNKNOWN", merchant=None)
    _categorize(client, tx_id)
    res = client.post(
        f"/review-queue/{tx_id}/accountant-review",
        json={
            "owner_question_key": "unknown_ach_transfer",
            "owner_answer_label": "Needs accountant review",
        },
    )
    assert res.status_code == 201

    trust = client.get("/ledger").json()["trust"]
    assert trust["finalized_count"] == 0
    assert trust["verified_count"] == 0
    assert trust["review_required_count"] >= 1


# ── CSV export carries the verified column ────────────────────────────────


def test_csv_export_carries_verified_column(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)
    tx_id = _create_tx(client, description="ZOOM.US MONTHLY", merchant="Zoom")
    _categorize(client, tx_id)
    csv_res = client.get("/ledger/export.csv")
    assert csv_res.status_code == 200
    header = csv_res.text.splitlines()[0]
    assert "model_provider" in header
    assert "verified" in header
    row = csv_res.text.splitlines()[1]
    # Rule auto-approval → verified=true.
    assert "true" in row
