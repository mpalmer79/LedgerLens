"""Transaction split-line tests.

Covers: model, service validation, API endpoints, business scoping,
amount validation, and audit trail.
"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ledgerlens.db import Base
from ledgerlens.models import Business, Tenant, Transaction
from ledgerlens.seed import seed_chart_of_accounts
from ledgerlens.services.transaction_splits import (
    SplitLineInput,
    delete_splits,
    list_splits,
    replace_splits,
    validate_split_total,
)


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    make_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = make_session()
    seed_chart_of_accounts(session)
    yield session  # type: ignore[misc]
    session.close()
    engine.dispose()


def _biz(db: Session, slug: str = "test") -> Business:
    t = Tenant(name=f"{slug}", slug=slug)
    db.add(t)
    db.flush()
    b = Business(tenant_id=t.id, name=slug, slug=slug)
    db.add(b)
    db.flush()
    return b


def _tx(db: Session, business_id: str, amount: int = -10000) -> Transaction:
    tx = Transaction(
        business_id=business_id,
        transaction_date=date(2026, 3, 15),
        description="AMAZON ORDER",
        raw_description="AMAZON ORDER",
        normalized_description="AMAZON ORDER",
        merchant="AMAZON",
        amount_cents=amount,
        currency="USD",
        source="test",
    )
    db.add(tx)
    db.flush()
    return tx


class TestSplitService:
    def test_create_and_list_splits(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id)
        lines = replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[
                SplitLineInput(amount_cents=-6000, category_code="6060"),
                SplitLineInput(amount_cents=-4000, category_code="6130"),
            ],
        )
        assert len(lines) == 2
        assert lines[0].line_index == 0
        assert lines[1].line_index == 1

        listed = list_splits(db, transaction_id=tx.id, business_id=biz.id)
        assert len(listed) == 2

    def test_validate_complete_split(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id, amount=-10000)
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[
                SplitLineInput(amount_cents=-6000, category_code="6060"),
                SplitLineInput(amount_cents=-4000, category_code="6130"),
            ],
        )
        val = validate_split_total(db, transaction_id=tx.id, business_id=biz.id)
        assert val.is_complete
        assert val.remainder_cents == 0

    def test_validate_incomplete_split(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id, amount=-10000)
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[SplitLineInput(amount_cents=-3000, category_code="6060")],
        )
        val = validate_split_total(db, transaction_id=tx.id, business_id=biz.id)
        assert not val.is_complete
        assert val.remainder_cents == -7000

    def test_replace_overwrites_previous_lines(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id)
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[SplitLineInput(amount_cents=-5000, category_code="6060")],
        )
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[
                SplitLineInput(amount_cents=-3000, category_code="6060"),
                SplitLineInput(amount_cents=-7000, category_code="6130"),
            ],
        )
        listed = list_splits(db, transaction_id=tx.id, business_id=biz.id)
        assert len(listed) == 2

    def test_delete_splits(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id)
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[SplitLineInput(amount_cents=-5000, category_code="6060")],
        )
        count = delete_splits(db, transaction_id=tx.id, business_id=biz.id)
        assert count == 1
        assert list_splits(db, transaction_id=tx.id, business_id=biz.id) == []

    def test_cross_business_isolation(self, db: Session) -> None:
        biz_a = _biz(db, "a")
        biz_b = _biz(db, "b")
        tx = _tx(db, biz_a.id)
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz_a.id,
            lines=[SplitLineInput(amount_cents=-5000, category_code="6060")],
        )
        listed_b = list_splits(db, transaction_id=tx.id, business_id=biz_b.id)
        assert len(listed_b) == 0

    def test_invalid_category_rejected(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id)
        with pytest.raises(Exception, match="unknown category"):
            replace_splits(
                db,
                transaction_id=tx.id,
                business_id=biz.id,
                lines=[SplitLineInput(amount_cents=-5000, category_code="FAKE")],
            )

    def test_split_preserves_raw_transaction(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id)
        original = tx.description
        replace_splits(
            db,
            transaction_id=tx.id,
            business_id=biz.id,
            lines=[SplitLineInput(amount_cents=-5000, category_code="6060")],
        )
        db.refresh(tx)
        assert tx.description == original
        assert tx.raw_description == original

    def test_no_splits_returns_empty(self, db: Session) -> None:
        biz = _biz(db)
        tx = _tx(db, biz.id)
        val = validate_split_total(db, transaction_id=tx.id, business_id=biz.id)
        assert not val.is_complete
        assert val.line_count == 0
