"""Batch #1 parts-vendor rules — production rule_categorizer path.

Confirms the new rules fire through the production `find_rule_match`
(not just the eval-side categorizer), so a NAPA transaction in a live
demo seed actually auto-categorizes.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from ledgerlens.models import Transaction
from ledgerlens.repositories import TransactionRepo
from ledgerlens.services.normalize import normalize_description
from ledgerlens.services.rule_categorizer import find_rule_match


def test_napa_rule_fires_via_find_rule_match(db_session: Session) -> None:
    tx = Transaction(
        transaction_date=date(2026, 3, 14),
        description="NAPA AUTO PARTS INV 88421",
        raw_description="NAPA AUTO PARTS INV 88421",
        normalized_description=normalize_description("NAPA AUTO PARTS INV 88421"),
        merchant="NAPA Auto Parts",
        amount_cents=-34250,
        currency="USD",
        source="test",
    )
    TransactionRepo(db_session).add(tx)
    db_session.commit()
    match = find_rule_match(tx, db_session)
    assert match.verdict == "apply"
    assert match.rule is not None
    assert match.rule.intent == "parts_inventory"


def test_autozone_rule_fires_via_find_rule_match(db_session: Session) -> None:
    tx = Transaction(
        transaction_date=date(2026, 3, 14),
        description="AUTOZONE COMMERCIAL #4471",
        raw_description="AUTOZONE COMMERCIAL #4471",
        normalized_description=normalize_description("AUTOZONE COMMERCIAL #4471"),
        merchant="AutoZone Commercial",
        amount_cents=-18760,
        currency="USD",
        source="test",
    )
    TransactionRepo(db_session).add(tx)
    db_session.commit()
    match = find_rule_match(tx, db_session)
    assert match.verdict == "apply"
    assert match.rule is not None
    assert match.rule.intent == "parts_inventory"


def test_lkq_rule_fires_via_find_rule_match(db_session: Session) -> None:
    tx = Transaction(
        transaction_date=date(2026, 3, 14),
        description="LKQ CORPORATION REC PARTS",
        raw_description="LKQ CORPORATION REC PARTS",
        normalized_description=normalize_description("LKQ CORPORATION REC PARTS"),
        merchant="LKQ Corporation",
        amount_cents=-56720,
        currency="USD",
        source="test",
    )
    TransactionRepo(db_session).add(tx)
    db_session.commit()
    match = find_rule_match(tx, db_session)
    assert match.verdict == "apply"
    assert match.rule is not None
    assert match.rule.intent == "parts_inventory"


def test_granite_state_tire_rule_fires_via_find_rule_match(db_session: Session) -> None:
    tx = Transaction(
        transaction_date=date(2026, 3, 14),
        description="GRANITE STATE TIRE DIST",
        raw_description="GRANITE STATE TIRE DIST",
        normalized_description=normalize_description("GRANITE STATE TIRE DIST"),
        merchant="Granite State Tire Distributor",
        amount_cents=-184500,
        currency="USD",
        source="test",
    )
    TransactionRepo(db_session).add(tx)
    db_session.commit()
    match = find_rule_match(tx, db_session)
    assert match.verdict == "apply"
    assert match.rule is not None
    assert match.rule.intent == "tires_inventory"
