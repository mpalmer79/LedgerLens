from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ledgerlens.models import Transaction


class TransactionRepo:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, tx: Transaction) -> Transaction:
        self.db.add(tx)
        self.db.flush()
        return tx

    def add_many(self, txs: Iterable[Transaction]) -> list[Transaction]:
        out = list(txs)
        self.db.add_all(out)
        self.db.flush()
        return out

    def get(self, tx_id: str) -> Transaction | None:
        return self.db.get(Transaction, tx_id)

    def get_for_business(self, tx_id: str, business_id: str | None) -> Transaction | None:
        """Return the transaction only if it belongs to ``business_id``.

        Tenant-boundary guard for callers that already know the actor's
        business. A ``None`` ``business_id`` matches only legacy rows whose
        tenant column is NULL — never another business's rows.
        """
        tx = self.db.get(Transaction, tx_id)
        if tx is None:
            return None
        if tx.business_id != business_id:
            return None
        return tx

    def list(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Transaction]:
        stmt = (
            select(Transaction)
            .order_by(desc(Transaction.transaction_date), desc(Transaction.created_at))
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def list_for_business(
        self,
        business_id: str | None,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Transaction]:
        """List transactions scoped to one business.

        A ``None`` ``business_id`` matches only legacy rows whose tenant
        column is NULL — never another business's rows.
        """
        stmt = select(Transaction)
        if business_id is None:
            stmt = stmt.where(Transaction.business_id.is_(None))
        else:
            stmt = stmt.where(Transaction.business_id == business_id)
        stmt = (
            stmt.order_by(desc(Transaction.transaction_date), desc(Transaction.created_at))
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def count(self) -> int:
        from sqlalchemy import func

        return int(self.db.scalar(select(func.count()).select_from(Transaction)) or 0)
