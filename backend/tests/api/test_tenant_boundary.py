"""Tenant-boundary regression tests.

Phase 3 sprint enforces that every core workflow query/mutation is
scoped to the actor's ``business_id``. Today the public demo only ever
runs as the seeded Granite State actor, so the cleanest way to prove
"no cross-business leakage" is to:

1. Let the demo seed create Business A (Granite State).
2. Seed a synthetic Business B directly in the test DB.
3. Plant a Transaction (and full categorization + review + correction
   memory chain) under each business.
4. Call every public read endpoint and assert Business B's rows never
   appear, and every direct-by-id read of B's rows returns 404.

These tests are the **regression** part of the tenant-boundary work.
Until real auth lands, they pin the scoping; once auth lands, the
fixture will swap in the real authenticated actor and the same
assertions should keep passing.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ledgerlens.models import (
    Business,
    CategorizationResult,
    CorrectionMemory,
    ResultStatus,
    ReviewDecision,
    ReviewerAction,
    Tenant,
    Transaction,
)
from ledgerlens.seed import seed_demo_tenant


def _seed_other_business(db: Session) -> Business:
    """Create a synthetic second tenant+business in the same DB."""
    tenant = Tenant(name="Other Co Tenant", slug="other-co")
    db.add(tenant)
    db.flush()
    business = Business(
        tenant_id=tenant.id,
        name="Other Co",
        slug="other-co",
        industry="other",
    )
    db.add(business)
    db.flush()
    return business


def _plant_chain(
    db: Session,
    *,
    business_id: str,
    description: str,
    merchant: str,
    selected_code: str = "5010",
) -> tuple[Transaction, CategorizationResult, ReviewDecision, CorrectionMemory]:
    """Plant a Transaction → CategorizationResult → ReviewDecision → CorrectionMemory chain."""
    tx = Transaction(
        business_id=business_id,
        transaction_date=date(2026, 1, 15),
        description=description,
        raw_description=description,
        normalized_description=description.upper(),
        merchant=merchant,
        amount_cents=-12345,
        currency="USD",
        source="test",
    )
    db.add(tx)
    db.flush()

    cat = CategorizationResult(
        business_id=business_id,
        transaction_id=tx.id,
        predicted_category_code=selected_code,
        predicted_category_name="Cost of Goods Sold",
        confidence=0.95,
        explanation="seeded for tenant-boundary test",
        model_provider="rule_categorizer",
        latency_ms=0,
        estimated_cost_usd=0.0,
        status=ResultStatus.NEEDS_REVIEW,
    )
    db.add(cat)
    db.flush()

    review = ReviewDecision(
        business_id=business_id,
        transaction_id=tx.id,
        categorization_result_id=cat.id,
        reviewer_action=ReviewerAction.CORRECT,
        selected_category_code=selected_code,
        reviewer_note="seeded review for tenant-boundary test",
    )
    db.add(review)
    db.flush()

    memory = CorrectionMemory(
        business_id=business_id,
        merchant_key=merchant.upper(),
        description_key=description.upper(),
        selected_category_code=selected_code,
        source_transaction_id=tx.id,
        source_review_decision_id=review.id,
        match_count=0,
        active=True,
        created_at=datetime.now(UTC),
    )
    db.add(memory)
    db.flush()
    db.commit()
    return tx, cat, review, memory


@pytest.fixture
def two_business_chain(
    db_session: Session,
) -> dict[str, object]:
    """Seed Business A (the demo) and Business B (synthetic) with a full
    transaction → categorization → review → correction-memory chain each."""
    _tenant_a, business_a = seed_demo_tenant(db_session)
    business_b = _seed_other_business(db_session)

    a_tx, a_cat, a_rev, a_mem = _plant_chain(
        db_session,
        business_id=business_a.id,
        description="A-only test row",
        merchant="ATEST_MERCHANT_A",
        selected_code="5010",
    )
    b_tx, b_cat, b_rev, b_mem = _plant_chain(
        db_session,
        business_id=business_b.id,
        description="B-only test row",
        merchant="BTEST_MERCHANT_B",
        selected_code="5010",
    )
    return {
        "business_a": business_a,
        "business_b": business_b,
        "a_tx": a_tx,
        "a_cat": a_cat,
        "a_rev": a_rev,
        "a_mem": a_mem,
        "b_tx": b_tx,
        "b_cat": b_cat,
        "b_rev": b_rev,
        "b_mem": b_mem,
    }


# ── /transactions ─────────────────────────────────────────────────────


def test_transactions_list_excludes_other_business(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/transactions", params={"limit": 200})
    assert res.status_code == 200, res.text
    ids = {item["id"] for item in res.json()["items"]}
    assert two_business_chain["a_tx"].id in ids  # type: ignore[union-attr]
    assert two_business_chain["b_tx"].id not in ids  # type: ignore[union-attr]


def test_transactions_get_other_business_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_tx = two_business_chain["b_tx"]
    res = client.get(f"/transactions/{b_tx.id}")  # type: ignore[union-attr]
    assert res.status_code == 404


# ── /review-queue ─────────────────────────────────────────────────────


def test_review_queue_excludes_other_business(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/review-queue", params={"limit": 200})
    assert res.status_code == 200, res.text
    tx_ids = {item["transaction"]["id"] for item in res.json()["items"]}
    assert two_business_chain["a_tx"].id in tx_ids  # type: ignore[union-attr]
    assert two_business_chain["b_tx"].id not in tx_ids  # type: ignore[union-attr]


def test_review_approve_other_business_tx_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_tx = two_business_chain["b_tx"]
    res = client.post(
        f"/review-queue/{b_tx.id}/approve",  # type: ignore[union-attr]
        json={"reviewer_note": "should not be allowed"},
    )
    assert res.status_code == 404


def test_review_correct_other_business_tx_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_tx = two_business_chain["b_tx"]
    res = client.post(
        f"/review-queue/{b_tx.id}/correct",  # type: ignore[union-attr]
        json={"selected_category_code": "5010", "reviewer_note": "should not be allowed"},
    )
    assert res.status_code == 404


# ── /corrections ──────────────────────────────────────────────────────


def test_corrections_list_excludes_other_business(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/corrections", params={"limit": 200})
    assert res.status_code == 200, res.text
    ids = {item["id"] for item in res.json()["items"]}
    assert two_business_chain["a_mem"].id in ids  # type: ignore[union-attr]
    assert two_business_chain["b_mem"].id not in ids  # type: ignore[union-attr]


def test_corrections_get_other_business_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_mem = two_business_chain["b_mem"]
    res = client.get(f"/corrections/{b_mem.id}")  # type: ignore[union-attr]
    assert res.status_code == 404


def test_corrections_patch_other_business_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_mem = two_business_chain["b_mem"]
    res = client.patch(
        f"/corrections/{b_mem.id}",  # type: ignore[union-attr]
        json={"active": False},
    )
    assert res.status_code == 404


def test_corrections_delete_other_business_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_mem = two_business_chain["b_mem"]
    res = client.delete(f"/corrections/{b_mem.id}")  # type: ignore[union-attr]
    assert res.status_code == 404


def test_memory_match_for_other_business_tx_404s(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    b_tx = two_business_chain["b_tx"]
    res = client.get(f"/transactions/{b_tx.id}/memory-matches")  # type: ignore[union-attr]
    assert res.status_code == 404


# ── /ledger ───────────────────────────────────────────────────────────


def test_ledger_excludes_other_business(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/ledger")
    assert res.status_code == 200, res.text
    tx_ids = {row["transaction_id"] for row in res.json()["rows"]}
    assert two_business_chain["a_tx"].id in tx_ids  # type: ignore[union-attr]
    assert two_business_chain["b_tx"].id not in tx_ids  # type: ignore[union-attr]


def test_ledger_csv_excludes_other_business(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/ledger/export.csv")
    assert res.status_code == 200
    body = res.text
    assert "A-only test row" in body
    assert "B-only test row" not in body


# ── /handoff ──────────────────────────────────────────────────────────


def test_handoff_excludes_other_business(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/handoff")
    assert res.status_code == 200, res.text
    body = res.json()
    all_tx_ids: set[str] = set()
    for bucket_key in ("ready_for_accountant", "needs_review", "accountant_review_required"):
        for row in body.get(bucket_key, []):
            all_tx_ids.add(row["transaction_id"])
    for answer in body.get("owner_answers", []):
        all_tx_ids.add(answer["transaction_id"])
    assert two_business_chain["b_tx"].id not in all_tx_ids  # type: ignore[union-attr]

    correction_ids = {c["id"] for c in body.get("corrections_learned", [])}
    assert two_business_chain["b_mem"].id not in correction_ids  # type: ignore[union-attr]


def test_handoff_markdown_excludes_other_business_description(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    res = client.get("/handoff/export.md")
    assert res.status_code == 200
    body = res.text
    assert "B-only test row" not in body
    assert "BTEST_MERCHANT_B" not in body


# ── /mapping/apply-preview ────────────────────────────────────────────


def test_mapping_apply_other_business_tx_is_rejected(
    client: TestClient, two_business_chain: dict[str, object]
) -> None:
    """Server-side eligibility recompute must reject another business's tx."""
    b_tx = two_business_chain["b_tx"]
    res = client.post(
        "/mapping/apply-preview",
        json={
            "intent": "parts_inventory",
            "proposed_category_code": "5010",
            "block_fallback": False,
            "selected_transaction_ids": [b_tx.id],  # type: ignore[union-attr]
        },
    )
    # Either the route 4xxs on unknown intent for the demo's rule map OR
    # it 200s but every cross-business id is rejected. Both outcomes are
    # safe — what we forbid is the row actually being mutated. Cover both.
    if res.status_code == 200:
        body = res.json()
        assert body["applied_count"] == 0
        rejected_ids = {r["transaction_id"] for r in body["rejected_rows"]}
        assert b_tx.id in rejected_ids  # type: ignore[union-attr]
    else:
        assert res.status_code in (400, 422)


# ── Correction-memory lookup never crosses businesses ────────────────


def test_correction_memory_match_does_not_cross_business(
    db_session: Session, two_business_chain: dict[str, object]
) -> None:
    """A transaction belonging to Business A must not match a memory row
    that belongs to Business B even when the merchant_key + description_key
    are identical."""
    from ledgerlens.services.correction_memory import find_memory_match

    business_a = two_business_chain["business_a"]
    business_b = two_business_chain["business_b"]
    # Plant a memory under B with the same keys as a brand-new A transaction.
    shared_desc = "SHARED MERCHANT DESCRIPTION"
    shared_merchant = "SHARED_MERCHANT"
    _plant_chain(
        db_session,
        business_id=business_b.id,  # type: ignore[union-attr]
        description=shared_desc,
        merchant=shared_merchant,
        selected_code="5010",
    )
    a_only_tx = Transaction(
        business_id=business_a.id,  # type: ignore[union-attr]
        transaction_date=date(2026, 2, 1),
        description=shared_desc,
        raw_description=shared_desc,
        normalized_description=shared_desc,
        merchant=shared_merchant,
        amount_cents=-9999,
        currency="USD",
        source="test",
    )
    db_session.add(a_only_tx)
    db_session.flush()

    match = find_memory_match(a_only_tx, db_session)
    # Business A has no matching memory row for that key — the only row
    # exists under B. The match must be `none`, not `apply`.
    assert match.verdict == "none", (
        f"correction-memory leaked across businesses: verdict={match.verdict!r}, "
        f"record={match.record!r}"
    )
