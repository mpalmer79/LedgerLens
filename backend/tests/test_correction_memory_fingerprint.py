"""Correction-memory fingerprint matching tests.

Proves that:
1. Exact memory match still wins over fingerprint.
2. Fingerprint match reuses prior corrections across noisy descriptions
   from the same vendor and business when exact keys don't match.
3. Ambiguous vendors (Amazon, Costco, Home Depot, etc.) are blocked
   from fingerprint matching (but exact match still works — a human's
   prior correction for the exact same merchant is defensible).
4. Cross-business fingerprint memory does not leak.
5. Raw transaction descriptions are never modified.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ledgerlens.db import Base
from ledgerlens.models import (
    Business,
    CorrectionMemory,
    ReviewDecision,
    ReviewerAction,
    Tenant,
    Transaction,
)
from ledgerlens.seed import seed_chart_of_accounts
from ledgerlens.services.correction_memory import find_memory_match


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


def _make_business(db: Session, slug: str) -> Business:
    tenant = Tenant(name=f"{slug} Tenant", slug=f"{slug}-ten")
    db.add(tenant)
    db.flush()
    biz = Business(tenant_id=tenant.id, name=slug, slug=slug)
    db.add(biz)
    db.flush()
    return biz


def _make_tx(
    db: Session,
    business_id: str,
    description: str,
    merchant: str | None = None,
) -> Transaction:
    tx = Transaction(
        business_id=business_id,
        transaction_date=date(2026, 3, 15),
        description=description,
        raw_description=description,
        normalized_description=description.upper(),
        merchant=merchant,
        amount_cents=-5000,
        currency="USD",
        source="test",
    )
    db.add(tx)
    db.flush()
    return tx


def _plant_memory(
    db: Session,
    business_id: str,
    merchant_key: str,
    description_key: str,
    category_code: str,
    tx: Transaction,
) -> CorrectionMemory:
    rev = ReviewDecision(
        business_id=business_id,
        transaction_id=tx.id,
        categorization_result_id="cat_fake",
        reviewer_action=ReviewerAction.CORRECT,
        selected_category_code=category_code,
    )
    db.add(rev)
    db.flush()
    mem = CorrectionMemory(
        business_id=business_id,
        merchant_key=merchant_key,
        description_key=description_key,
        selected_category_code=category_code,
        source_transaction_id=tx.id,
        source_review_decision_id=rev.id,
        match_count=0,
        active=True,
        created_at=datetime.now(UTC),
    )
    db.add(mem)
    db.flush()
    db.commit()
    return mem


# ── Tier 1: exact match still wins ───────────────────────────────────


def test_exact_match_still_wins(db: Session) -> None:
    biz = _make_business(db, "exact-test")
    tx1 = _make_tx(db, biz.id, "NAPA AUTO PARTS #1234 MANCHESTER NH", "NAPA AUTO PARTS")
    _plant_memory(db, biz.id, "NAPA AUTO PARTS", "NAPA AUTO PARTS #1234 MANCHESTER NH", "5010", tx1)

    tx2 = _make_tx(db, biz.id, "NAPA AUTO PARTS #1234 MANCHESTER NH", "NAPA AUTO PARTS")
    match = find_memory_match(tx2, db)

    assert match.verdict == "apply"
    assert match.match_type == "exact"
    assert match.record is not None
    assert match.record.selected_category_code == "5010"


# ── Tier 2: fingerprint match across noisy variants ──────────────────
# The key: memory was recorded with a DIFFERENT raw merchant/description
# than the incoming tx, but both normalize to the same fingerprint.


def test_fingerprint_match_napa_noisy_variant(db: Session) -> None:
    biz = _make_business(db, "fp-napa")
    # Memory recorded from one noisy variant (store #4382 in description)
    tx1 = _make_tx(db, biz.id, "POS NAPA AUTO PARTS #4382 MANCHESTER NH 03104", "NAPA AUTO PARTS")
    _plant_memory(
        db, biz.id, "NAPA AUTO PARTS", "POS NAPA AUTO PARTS #4382 MANCHESTER NH 03104", "5010", tx1
    )

    # Incoming tx has a DIFFERENT noisy description — different prefix,
    # different trailing data. The merchant_key is slightly different
    # ("NAPA" alone vs "NAPA AUTO PARTS") so exact won't match, but
    # both fingerprint to the same normalized form.
    tx2 = _make_tx(db, biz.id, "DEBIT CARD PURCHASE NAPA AUTO PARTS 1234567890 05/18", "NAPA")
    match = find_memory_match(tx2, db)

    assert match.verdict == "apply"
    assert match.match_type == "merchant_fingerprint"
    assert match.record is not None
    assert match.record.selected_category_code == "5010"
    assert "fingerprint" in match.reason


def test_fingerprint_match_autozone(db: Session) -> None:
    biz = _make_business(db, "fp-autozone")
    tx1 = _make_tx(db, biz.id, "AUTOZONE COMMERCIAL #456 NH 03301", "AUTOZONE #456")
    _plant_memory(db, biz.id, "AUTOZONE #456", "AUTOZONE COMMERCIAL #456 NH 03301", "5010", tx1)

    tx2 = _make_tx(db, biz.id, "ACH DEBIT AUTOZONE COMMERCIAL #789", "AUTOZONE #789")
    match = find_memory_match(tx2, db)

    assert match.verdict == "apply"
    assert match.match_type == "merchant_fingerprint"


def test_fingerprint_match_adp_payroll(db: Session) -> None:
    biz = _make_business(db, "fp-adp")
    tx1 = _make_tx(db, biz.id, "ACH DEBIT ADP PAYROLL REF:ABC123", "ADP PAYROLL")
    _plant_memory(db, biz.id, "ADP PAYROLL", "ACH DEBIT ADP PAYROLL REF:ABC123", "6030", tx1)

    # Different merchant field ("ADP" alone) so exact key won't match,
    # but both fingerprint to "ADP PAYROLL" or similar.
    tx2 = _make_tx(db, biz.id, "ACH DEBIT ADP PAYROLL REF:XYZ789", "ADP")
    match = find_memory_match(tx2, db)

    assert match.verdict == "apply"
    assert match.match_type == "merchant_fingerprint"
    assert match.record is not None
    assert match.record.selected_category_code == "6030"


# ── Ambiguous vendors: fingerprint blocked, exact still works ────────
# A human's prior correction for the EXACT same merchant is defensible
# (they said "Amazon = X for this business"). But fingerprint match on
# a *different* Amazon variant should not auto-finalize because the
# specific purchase could be personal vs business.


def test_amazon_exact_match_still_applies(db: Session) -> None:
    """Exact merchant_key match on Amazon is defensible — human said so."""
    biz = _make_business(db, "amb-amazon-exact")
    tx1 = _make_tx(db, biz.id, "AMAZON.COM*AB1CD2EF3", "AMAZON")
    _plant_memory(db, biz.id, "AMAZON", "AMAZON.COM*AB1CD2EF3", "6060", tx1)

    tx2 = _make_tx(db, biz.id, "AMAZON.COM*AB1CD2EF3", "AMAZON")
    match = find_memory_match(tx2, db)
    assert match.verdict == "apply"
    assert match.match_type == "exact"


def test_amazon_fingerprint_blocked(db: Session) -> None:
    """Different Amazon variant must not auto-finalize via fingerprint."""
    biz = _make_business(db, "amb-amazon-fp")
    tx1 = _make_tx(db, biz.id, "AMAZON.COM*AB1CD2EF3", "AMAZON.COM*AB1CD2EF3")
    _plant_memory(db, biz.id, "AMAZON.COM*AB1CD2EF3", "AMAZON.COM*AB1CD2EF3", "6060", tx1)

    tx2 = _make_tx(db, biz.id, "AMZN MKTP US*XY9ZW8", "AMZN MKTP US*XY9ZW8")
    match = find_memory_match(tx2, db)

    assert match.verdict == "none"
    assert "ambiguous" in match.reason


def test_home_depot_fingerprint_blocked(db: Session) -> None:
    biz = _make_business(db, "amb-hd")
    tx1 = _make_tx(db, biz.id, "HOME DEPOT #1234 CONCORD NH", "HOME DEPOT #1234")
    _plant_memory(db, biz.id, "HOME DEPOT #1234", "HOME DEPOT #1234 CONCORD NH", "6060", tx1)

    tx2 = _make_tx(db, biz.id, "HOME DEPOT #5678 MANCHESTER NH", "HOME DEPOT #5678")
    match = find_memory_match(tx2, db)

    assert match.verdict == "none"
    assert "ambiguous" in match.reason


def test_costco_fingerprint_blocked(db: Session) -> None:
    biz = _make_business(db, "amb-costco")
    tx1 = _make_tx(db, biz.id, "COSTCO WHSE #1234", "COSTCO WHSE #1234")
    _plant_memory(db, biz.id, "COSTCO WHSE #1234", "COSTCO WHSE #1234", "6060", tx1)

    tx2 = _make_tx(db, biz.id, "COSTCO WHSE #5678", "COSTCO WHSE #5678")
    match = find_memory_match(tx2, db)

    assert match.verdict == "none"
    assert "ambiguous" in match.reason


# ── Cross-business isolation ─────────────────────────────────────────


def test_cross_business_fingerprint_does_not_leak(db: Session) -> None:
    biz_a = _make_business(db, "iso-a")
    biz_b = _make_business(db, "iso-b")

    tx_a = _make_tx(db, biz_a.id, "EVERSOURCE ENERGY PAYMENT", "EVERSOURCE ENERGY")
    _plant_memory(db, biz_a.id, "EVERSOURCE ENERGY", "EVERSOURCE ENERGY PAYMENT", "6020", tx_a)

    tx_b = _make_tx(db, biz_b.id, "EVERSOURCE ENERGY 03/2026", "EVERSOURCE ENERGY")
    match = find_memory_match(tx_b, db)

    assert match.verdict == "none"
    assert match.match_type == "none"


# ── Raw description preserved ────────────────────────────────────────


def test_raw_description_unchanged_after_fingerprint_match(db: Session) -> None:
    biz = _make_business(db, "raw-preserve")
    original_desc = "POS PURCHASE NAPA AUTO PARTS #9999 CONCORD NH 03301"
    tx1 = _make_tx(db, biz.id, "NAPA AUTO PARTS #1111", "NAPA AUTO PARTS #1111")
    _plant_memory(db, biz.id, "NAPA AUTO PARTS #1111", "NAPA AUTO PARTS #1111", "5010", tx1)

    tx2 = _make_tx(db, biz.id, original_desc, "NAPA AUTO PARTS #9999")
    find_memory_match(tx2, db)

    db.refresh(tx2)
    assert tx2.description == original_desc
    assert tx2.raw_description == original_desc


# ── Match metadata ───────────────────────────────────────────────────


def test_match_metadata_includes_type_and_reason(db: Session) -> None:
    biz = _make_business(db, "meta")
    tx1 = _make_tx(db, biz.id, "SHELL OIL #1234", "SHELL OIL #1234")
    _plant_memory(db, biz.id, "SHELL OIL #1234", "SHELL OIL #1234", "6130", tx1)

    tx2 = _make_tx(db, biz.id, "SHELL OIL STATION #5678", "SHELL OIL #5678")
    match = find_memory_match(tx2, db)

    assert match.match_type in ("exact", "merchant_fingerprint")
    assert len(match.reason) > 0
    assert match.merchant_key != ""


def test_no_match_returns_none_type(db: Session) -> None:
    biz = _make_business(db, "no-match")
    tx = _make_tx(db, biz.id, "RANDOM VENDOR NOBODY HEARD OF", "RANDOM VENDOR")
    match = find_memory_match(tx, db)

    assert match.verdict == "none"
    assert match.match_type == "none"
