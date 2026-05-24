"""Owner Answers v2 — structured fields persist through review endpoints
and surface in the handoff JSON + markdown export.

The v1 contract (reviewer_note free-text) keeps working unchanged. v2
adds question_key / question_text / answer_label / owner_note /
suggested_resolution / accountant_follow_up_required.
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


def _fake_cat(code: str, confidence: float = 0.4) -> MagicMock:
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


def _seed_pending(client: TestClient, *, description: str, merchant: str | None = None) -> str:
    res = client.post(
        "/transactions",
        json={
            "transaction_date": "2026-03-14",
            "description": description,
            "merchant": merchant,
            "amount_cents": -67500,
            "currency": "USD",
        },
    )
    tx_id: str = res.json()["id"]
    client.post("/categorize", json={"transaction_id": tx_id})
    return tx_id


# ── Persistence ──────────────────────────────────────────────────────────


def test_correct_endpoint_persists_v2_fields(client: TestClient, fake_factory: MagicMock) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="ACH TRANSFER VENDOR REF 41281")

    res = client.post(
        f"/review-queue/{tx_id}/correct",
        json={
            "selected_category_code": "6080",
            "reviewer_note": "Owner: vendor payment.",
            "owner_question_key": "unknown_ach_transfer",
            "owner_question_text": "What was this transfer for?",
            "owner_answer_label": "Vendor payment",
            "owner_note": "Wholesale parts vendor, see receipt #221.",
            "suggested_resolution": "vendor_payment",
            "accountant_follow_up_required": False,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["owner_question_key"] == "unknown_ach_transfer"
    assert body["owner_answer_label"] == "Vendor payment"
    assert body["owner_note"] == "Wholesale parts vendor, see receipt #221."
    assert body["suggested_resolution"] == "vendor_payment"
    assert body["accountant_follow_up_required"] is False


def test_approve_endpoint_rejects_accountant_follow_up_flag(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """Safety backstop: a payload with accountant_follow_up_required=True
    must NOT be accepted by /approve — it would silently finalize the
    predicted category. The /questions UI must route such answers to the
    accountant-review endpoint instead."""
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="OWNER TRANSFER TO PERSONAL")

    res = client.post(
        f"/review-queue/{tx_id}/approve",
        json={
            "reviewer_note": "Owner: needs accountant review.",
            "owner_question_key": "owner_transfer",
            "owner_question_text": "What was this transfer?",
            "owner_answer_label": "Needs accountant review",
            "accountant_follow_up_required": True,
        },
    )
    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "validation_failed"
    assert "accountant-review" in detail["message"]


def test_approve_endpoint_still_accepts_explicit_approve(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """A v2 caller can still approve the predicted category when the answer
    is explicit ('approve this prediction') and accountant_follow_up_required
    is False."""
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="ADOBE CREATIVE CLOUD", merchant="Adobe")

    res = client.post(
        f"/review-queue/{tx_id}/approve",
        json={
            "reviewer_note": "Owner: approved predicted category.",
            "owner_question_key": "default_uncertain_transaction",
            "owner_answer_label": "It's a normal business expense",
            "accountant_follow_up_required": False,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["accountant_follow_up_required"] is False


def test_accountant_review_endpoint_records_follow_up_decision(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """The new /accountant-review endpoint records a ReviewDecision that
    does not finalize the predicted category."""
    fake_factory.return_value = _fake_cat("6080", 0.5)
    tx_id = _seed_pending(client, description="ACH DEBIT — UNKNOWN COUNTERPARTY")

    res = client.post(
        f"/review-queue/{tx_id}/accountant-review",
        json={
            "reviewer_note": "Owner: needs accountant review.",
            "owner_question_key": "unknown_ach_transfer",
            "owner_question_text": "What was this transfer for?",
            "owner_answer_label": "Needs accountant review",
            "owner_note": "Counterparty not familiar; ask bookkeeper.",
            # Even if the inbound value is missing, the endpoint forces True.
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["reviewer_action"] == "mark_for_accountant_review"
    assert body["selected_category_code"] is None
    assert body["accountant_follow_up_required"] is True
    assert body["owner_answer_label"] == "Needs accountant review"


def test_accountant_review_does_not_finalize_predicted_category(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """An accountant-review row is not finalized and not verified."""
    fake_factory.return_value = _fake_cat("6080", 0.5)
    tx_id = _seed_pending(client, description="ACH DEBIT — UNKNOWN VENDOR")

    client.post(
        f"/review-queue/{tx_id}/accountant-review",
        json={
            "owner_question_key": "unknown_ach_transfer",
            "owner_answer_label": "Needs accountant review",
        },
    )

    ledger = client.get("/ledger").json()
    row = next(r for r in ledger["rows"] if r["transaction_id"] == tx_id)
    # Must not be auto-approved or corrected.
    assert row["categorization_status"] == "accountant_review_required"
    # No category code adopted.
    assert row["category_code"] is None
    # Trust metric does not count it as finalized or verified.
    trust = ledger["trust"]
    # The single seeded tx is the only row; it must not be counted finalized.
    assert trust["finalized_count"] == 0
    assert trust["verified_count"] == 0
    # It does appear in the unresolved/review-required count.
    assert ledger["unresolved"] >= 1


def test_uncategorizable_endpoint_persists_v2_fields(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="VENMO PAYMENT - JON")

    res = client.post(
        f"/review-queue/{tx_id}/uncategorizable",
        json={
            "reviewer_note": "Owner: not sure.",
            "owner_question_key": "owner_transfer",
            "owner_question_text": "What was this transfer?",
            "owner_answer_label": "Not sure",
            "accountant_follow_up_required": True,
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["owner_question_key"] == "owner_transfer"
    assert body["accountant_follow_up_required"] is True


def test_v1_callers_still_work_without_v2_fields(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """The /review page (and any old client) submits only reviewer_note. The
    new fields default to None/False and the row persists fine."""
    fake_factory.return_value = _fake_cat("6010", 0.4)
    tx_id = _seed_pending(client, description="ADOBE CC", merchant="Adobe")

    res = client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "Move to consulting."},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["owner_question_key"] is None
    assert body["accountant_follow_up_required"] is False
    # Legacy free-text note still recorded.
    assert body["reviewer_note"] == "Move to consulting."


# ── Handoff surfacing ────────────────────────────────────────────────────


def test_handoff_returns_structured_owner_answers(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="OWNER TRANSFER TO PERSONAL")
    client.post(
        f"/review-queue/{tx_id}/approve",
        json={
            "reviewer_note": "Owner: owner draw.",
            "owner_question_key": "owner_transfer",
            "owner_question_text": "What was this transfer?",
            "owner_answer_label": "Owner draw",
            "owner_note": "Pulled cash for personal use.",
            "suggested_resolution": "owner_draw",
            "accountant_follow_up_required": False,
        },
    )

    body = client.get("/handoff").json()
    answers = body["owner_answers"]
    assert len(answers) == 1
    a = answers[0]
    assert a["owner_question_key"] == "owner_transfer"
    assert a["owner_answer_label"] == "Owner draw"
    assert a["owner_note"] == "Pulled cash for personal use."
    assert a["suggested_resolution"] == "owner_draw"
    assert a["accountant_follow_up_required"] is False
    # Transaction metadata is included for the markdown export.
    assert a["transaction_date"] == "2026-03-14"
    assert a["amount_cents"] == -67500
    assert a["currency"] == "USD"


def test_handoff_markdown_renders_structured_answers(
    client: TestClient, fake_factory: MagicMock
) -> None:
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="ATM WITHDRAWAL TD BANK")
    client.post(
        f"/review-queue/{tx_id}/uncategorizable",
        json={
            "reviewer_note": "Owner: needs accountant review.",
            "owner_question_key": "owner_transfer",
            "owner_question_text": "What was this transfer?",
            "owner_answer_label": "Needs accountant review",
            "owner_note": "Branch withdrawal — need to confirm with bookkeeper.",
            "accountant_follow_up_required": True,
        },
    )

    res = client.get("/handoff/export.md")
    assert res.status_code == 200
    body = res.text
    assert "What was this transfer?" in body
    assert "**Needs accountant review**" in body
    assert "Branch withdrawal" in body
    assert "[needs accountant follow-up]" in body


def test_handoff_markdown_handles_legacy_v1_notes(
    client: TestClient, fake_factory: MagicMock
) -> None:
    """A ReviewDecision created the old way (reviewer_note only) still
    renders as a legacy review note in the markdown."""
    fake_factory.return_value = _fake_cat("9999", 0.4)
    tx_id = _seed_pending(client, description="ADOBE CREATIVE CLOUD", merchant="Adobe")
    client.post(
        f"/review-queue/{tx_id}/correct",
        json={"selected_category_code": "6080", "reviewer_note": "Legacy: not software."},
    )

    body = client.get("/handoff/export.md").text
    assert "## Questions answered by owner" in body
    # Renders under the legacy block when no v2 fields are present.
    assert "Legacy: not software." in body
