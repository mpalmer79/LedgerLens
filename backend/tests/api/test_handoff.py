"""Accountant handoff endpoints.

The handoff is a *view* over persisted state: it must reflect what's
already in the ledger / review / correction-memory tables and must not
introduce new claims (no fake categories, no new "verified" criteria,
no inflated time-saved figures).
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
        latency_ms=1000,
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


def _categorize(client: TestClient, tx_id: str) -> None:
    client.post("/categorize", json={"transaction_id": tx_id})


# ── Empty-database shape ──────────────────────────────────────────────────


def test_handoff_empty_db_shape(client: TestClient) -> None:
    res = client.get("/handoff")
    assert res.status_code == 200
    body = res.json()
    assert body["cleanup_period_label"]  # non-empty fallback
    assert body["trust"]["finalized_count"] == 0
    assert body["trust"]["verification_rate"] == 1.0
    assert body["impact"]["transactions_imported"] == 0
    assert body["impact"]["estimated_minutes_saved"] == 0.0
    assert body["ready_for_accountant"] == []
    assert body["needs_review"] == []
    assert body["owner_answers"] == []
    assert body["corrections_learned"] == []


# ── Mixed verified / unverified ───────────────────────────────────────────


def test_handoff_splits_ready_and_needs_review(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("6010", 0.5)  # model would only mid-confidence
    # Adobe hits the rule layer → auto_approved + verified.
    rule_tx = _create_tx(client, description="ADOBE CREATIVE CLOUD MO", merchant="Adobe")
    _categorize(client, rule_tx)
    # Unknown vendor → demo-stub or anthropic; here the fake returns 0.5 so
    # the model auto_approves at mid-confidence → still finalized but
    # NOT verified (no review).
    fake_factory.return_value = _fake_cat("6010", 0.5)
    obscure = _create_tx(client, description="OBSCURE INDIE VENDOR")
    _categorize(client, obscure)
    # Mid-confidence routes to needs_review. Mark above auto_threshold
    # to land in finalized-but-unverified for the second tx.
    fake_factory.return_value = _fake_cat("6010", 0.95)
    obscure2 = _create_tx(client, description="OTHER OBSCURE VENDOR")
    _categorize(client, obscure2)

    res = client.get("/handoff")
    body = res.json()
    # At least one ready (rule) and the model auto-approval is unverified.
    assert body["trust"]["finalized_count"] >= 2
    assert body["trust"]["verified_count"] >= 1
    assert any("ADOBE" in r["description"] for r in body["ready_for_accountant"])


def test_handoff_review_items_surface_under_needs_review(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("6010", 0.4)  # below review_threshold floor
    tx_id = _create_tx(client, description="UNKNOWN ACH REF 4421")
    _categorize(client, tx_id)
    res = client.get("/handoff")
    body = res.json()
    statuses = {r["categorization_status"] for r in body["needs_review"]}
    assert "needs_review" in statuses


# ── Owner-note pass-through ───────────────────────────────────────────────


def test_handoff_surfaces_owner_notes_from_review_decisions(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)
    tx_id = _create_tx(client, description="ADOBE CC", merchant="Adobe")
    _categorize(client, tx_id)
    # The owner answers a plain-English question — recorded in
    # reviewer_note via the existing correct endpoint.
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={
            "selected_category_code": "6080",
            "reviewer_note": "This was a consulting subscription, not software.",
        },
    )
    res = client.get("/handoff")
    body = res.json()
    assert len(body["owner_answers"]) == 1
    answer = body["owner_answers"][0]
    assert "consulting subscription" in answer["answer"]
    assert answer["reviewer_action"] == "correct"
    assert answer["selected_category_code"] == "6080"


# ── Impact-summary math ───────────────────────────────────────────────────


def test_handoff_impact_uses_conservative_minute_estimates(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)
    # Two rule-handled transactions → 2 × 1.5 = 3.0 minutes.
    _categorize(client, _create_tx(client, description="ADOBE CC", merchant="Adobe"))
    _categorize(client, _create_tx(client, description="ZOOM.US MONTHLY", merchant="Zoom"))
    res = client.get("/handoff")
    body = res.json()
    # We expect at least 3 minutes saved (could be more if memory also
    # kicked in for repeats, which it does not in this two-rule test).
    assert body["impact"]["handled_by_rules_or_memory"] >= 2
    assert body["impact"]["estimated_minutes_saved"] >= 3.0


# ── Markdown export ───────────────────────────────────────────────────────


def test_handoff_markdown_export_includes_required_sections(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)
    _categorize(client, _create_tx(client, description="STAPLES STORE 9", merchant="Staples"))

    res = client.get("/handoff/export.md")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/markdown")
    body = res.text
    # Required sections.
    assert "# LedgerLens — accountant handoff package" in body
    assert "## Cleanup summary" in body
    assert "## Ready for accountant" in body
    assert "## Needs owner / accountant review" in body
    assert "## Questions answered by owner" in body
    assert "## Corrections learned this month" in body
    assert "## Notes for the accountant" in body
    # Honesty disclaimers.
    assert "workflow-level, not raw model accuracy" in body
    assert "not a financial guarantee" in body


def test_handoff_markdown_writes_audit_event(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.0)
    _categorize(client, _create_tx(client, description="ZOOM.US MONTHLY", merchant="Zoom"))
    client.get("/handoff/export.md")
    events = client.get("/audit/events?entity_type=handoff").json()
    actions = [e["action"] for e in events]
    assert "exported" in actions


# ── Sample-business scenario surfacing ─────────────────────────────────────


def _force_demo_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CATEGORIZER_MODE", "demo_stub")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    get_settings.cache_clear()


def test_handoff_scenario_is_none_without_demo_data(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """When the handoff only contains non-demo transactions the scenario
    field is null and the markdown heading falls back to the generic
    title."""
    fake_factory.return_value = _fake_cat("9999", 0.0)
    _categorize(client, _create_tx(client, description="ZOOM.US MONTHLY", merchant="Zoom"))
    body = client.get("/handoff").json()
    assert body["scenario"] is None
    md = client.get("/handoff/export.md").text
    assert "# LedgerLens — accountant handoff package" in md


def test_handoff_scenario_surfaces_for_demo_seeded_rows(
    client: TestClient, fake_factory: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When demo-seeded rows are part of the handoff the scenario object
    surfaces the fictional business name and the markdown heading uses it."""
    fake_factory.return_value = _fake_cat("9999", 0.0)
    _force_demo_mode(monkeypatch)
    seed = client.post("/demo/seed").json()
    # Categorize one row so it has at least one ledger entry.
    client.post("/categorize", json={"transaction_id": seed["created"][0]["id"]})

    body = client.get("/handoff").json()
    scenario = body["scenario"]
    assert scenario is not None
    assert scenario["business_name"] == "Granite State Auto Repair"
    assert scenario["cleanup_month"] == "March 2026"
    assert scenario["handoff_filename"] == "handoff-granite-state-auto-repair-2026-03.md"

    res = client.get("/handoff/export.md")
    md = res.text
    assert "Granite State Auto Repair — March 2026 accountant handoff" in md
    assert "Independent auto repair shop" in md
    assert "fictional sample scenario" in md.lower()
    # Disclaimer is always present.
    assert "not tax advice" in md.lower()
    # Filename in Content-Disposition uses the scenario filename.
    assert "handoff-granite-state-auto-repair-2026-03.md" in res.headers["content-disposition"]
