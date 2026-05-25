"""Transaction split-line service.

Lets an owner or reviewer split a single bank transaction across
multiple categories. The split is a reviewed-categorization tool for
the accountant handoff — not double-entry accounting.

Rules:
- Split lines must belong to the same business_id as the transaction.
- The sum of split amounts must equal the transaction amount for the
  split to be considered complete.
- Incomplete splits are flagged in exports but do not block other rows.
- Category codes must exist in the active chart of accounts.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ledgerlens.errors import NotFound, ValidationFailed
from ledgerlens.models import Transaction, TransactionSplitLine
from ledgerlens.repositories import CategoryRepo


@dataclass(frozen=True)
class SplitLineInput:
    amount_cents: int
    category_code: str | None
    note: str | None = None


@dataclass(frozen=True)
class SplitValidation:
    transaction_amount_cents: int
    split_total_cents: int
    is_complete: bool
    remainder_cents: int
    line_count: int


def _get_tx_for_business(db: Session, transaction_id: str, business_id: str | None) -> Transaction:
    """Load a transaction and verify it belongs to the active business.

    Raises NotFound if the transaction doesn't exist OR belongs to a
    different business — so callers never leak cross-business data.
    """
    tx = db.get(Transaction, transaction_id)
    if tx is None or tx.business_id != business_id:
        raise NotFound("transaction", transaction_id)
    return tx


def list_splits(
    db: Session, *, transaction_id: str, business_id: str | None
) -> list[TransactionSplitLine]:
    stmt = (
        select(TransactionSplitLine)
        .where(TransactionSplitLine.transaction_id == transaction_id)
        .order_by(TransactionSplitLine.line_index)
    )
    if business_id is None:
        stmt = stmt.where(TransactionSplitLine.business_id.is_(None))
    else:
        stmt = stmt.where(TransactionSplitLine.business_id == business_id)
    return list(db.scalars(stmt))


def replace_splits(
    db: Session,
    *,
    transaction_id: str,
    business_id: str | None,
    lines: list[SplitLineInput],
    source: str = "owner_review",
) -> list[TransactionSplitLine]:
    """Replace all split lines for a transaction.

    Validates category codes against the active COA. Does NOT require
    the total to match the transaction amount — incomplete splits are
    allowed but flagged.
    """
    _get_tx_for_business(db, transaction_id, business_id)

    cat_repo = CategoryRepo(db)
    for i, line in enumerate(lines):
        if line.category_code and not cat_repo.exists(line.category_code):
            raise ValidationFailed(f"Split line {i}: unknown category code '{line.category_code}'")

    db.execute(
        delete(TransactionSplitLine).where(
            TransactionSplitLine.transaction_id == transaction_id,
            TransactionSplitLine.business_id == business_id
            if business_id
            else TransactionSplitLine.business_id.is_(None),
        )
    )

    created: list[TransactionSplitLine] = []
    for i, line in enumerate(lines):
        cat_name: str | None = None
        if line.category_code:
            cat = cat_repo.get(line.category_code)
            cat_name = cat.name if cat else None
        row = TransactionSplitLine(
            transaction_id=transaction_id,
            business_id=business_id,
            line_index=i,
            amount_cents=line.amount_cents,
            category_code=line.category_code,
            category_name=cat_name,
            note=line.note,
            source=source,
        )
        db.add(row)
        created.append(row)

    db.flush()
    return created


def delete_splits(db: Session, *, transaction_id: str, business_id: str | None) -> int:
    _get_tx_for_business(db, transaction_id, business_id)
    if business_id is None:
        result = db.execute(
            delete(TransactionSplitLine).where(
                TransactionSplitLine.transaction_id == transaction_id,
                TransactionSplitLine.business_id.is_(None),
            )
        )
    else:
        result = db.execute(
            delete(TransactionSplitLine).where(
                TransactionSplitLine.transaction_id == transaction_id,
                TransactionSplitLine.business_id == business_id,
            )
        )
    db.flush()
    return int(getattr(result, "rowcount", 0) or 0)


def validate_split_total(
    db: Session, *, transaction_id: str, business_id: str | None
) -> SplitValidation:
    tx = _get_tx_for_business(db, transaction_id, business_id)
    lines = list_splits(db, transaction_id=transaction_id, business_id=business_id)
    split_total = sum(line.amount_cents for line in lines)
    remainder = tx.amount_cents - split_total
    return SplitValidation(
        transaction_amount_cents=tx.amount_cents,
        split_total_cents=split_total,
        is_complete=remainder == 0 and len(lines) > 0,
        remainder_cents=remainder,
        line_count=len(lines),
    )
