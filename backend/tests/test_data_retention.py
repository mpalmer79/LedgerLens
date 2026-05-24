"""Tests for the tenant-scoped data retention/deletion primitive."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ledgerlens.db import Base
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
from ledgerlens.services.data_retention import delete_business_workflow_data


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    make_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = make_session()
    yield session
    session.close()
    engine.dispose()


def _seed_business(db: Session, slug: str, name: str) -> Business:
    tenant = Tenant(name=f"{name} Tenant", slug=f"{slug}-ten")
    db.add(tenant)
    db.flush()
    business = Business(tenant_id=tenant.id, name=name, slug=slug)
    db.add(business)
    db.flush()
    return business


def _plant_chain(db: Session, business_id: str, description: str) -> None:
    tx = Transaction(
        business_id=business_id,
        transaction_date=date(2026, 1, 15),
        description=description,
        raw_description=description,
        normalized_description=description.upper(),
        merchant="VENDOR",
        amount_cents=-12345,
        currency="USD",
        source="test",
    )
    db.add(tx)
    db.flush()
    cat = CategorizationResult(
        business_id=business_id,
        transaction_id=tx.id,
        predicted_category_code="5010",
        predicted_category_name="Cost of Goods Sold",
        confidence=0.95,
        explanation="seeded",
        model_provider="rule_categorizer",
        latency_ms=0,
        estimated_cost_usd=0.0,
        status=ResultStatus.NEEDS_REVIEW,
    )
    db.add(cat)
    db.flush()
    rev = ReviewDecision(
        business_id=business_id,
        transaction_id=tx.id,
        categorization_result_id=cat.id,
        reviewer_action=ReviewerAction.CORRECT,
        selected_category_code="5010",
        reviewer_note="seeded",
    )
    db.add(rev)
    db.flush()
    mem = CorrectionMemory(
        business_id=business_id,
        merchant_key="VENDOR",
        description_key=description.upper(),
        selected_category_code="5010",
        source_transaction_id=tx.id,
        source_review_decision_id=rev.id,
        match_count=0,
        active=True,
        created_at=datetime.now(UTC),
    )
    db.add(mem)
    db.flush()
    db.commit()


def test_delete_business_workflow_data_only_removes_target_business(
    db_session: Session,
) -> None:
    business_a = _seed_business(db_session, "biz-a", "A")
    business_b = _seed_business(db_session, "biz-b", "B")
    _plant_chain(db_session, business_a.id, "A-only row")
    _plant_chain(db_session, business_b.id, "B-only row")

    summary = delete_business_workflow_data(db_session, business_id=business_b.id, commit=True)

    assert summary.business_id == business_b.id
    assert summary.deleted_transactions == 1
    assert summary.deleted_categorization_results == 1
    assert summary.deleted_review_decisions == 1
    assert summary.deleted_correction_memory == 1
    assert summary.total_rows == 4

    # Business A is intact.
    assert (
        db_session.query(Transaction).filter(Transaction.business_id == business_a.id).count() == 1
    )
    assert (
        db_session.query(CorrectionMemory)
        .filter(CorrectionMemory.business_id == business_a.id)
        .count()
        == 1
    )
    # Business B is gone.
    for model in (Transaction, CategorizationResult, ReviewDecision, CorrectionMemory):
        assert db_session.query(model).filter(model.business_id == business_b.id).count() == 0


def test_delete_business_workflow_data_refuses_empty_business_id(
    db_session: Session,
) -> None:
    with pytest.raises(ValueError):
        delete_business_workflow_data(db_session, business_id="")


def test_delete_business_workflow_data_is_idempotent(db_session: Session) -> None:
    business = _seed_business(db_session, "biz", "X")
    _plant_chain(db_session, business.id, "row")

    first = delete_business_workflow_data(db_session, business_id=business.id, commit=True)
    assert first.total_rows == 4

    # Second call on the same business returns zeroes; no exceptions.
    second = delete_business_workflow_data(db_session, business_id=business.id, commit=True)
    assert second.total_rows == 0
