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

    def count(self) -> int:
        from sqlalchemy import func

        return int(self.db.scalar(select(func.count()).select_from(Transaction)) or 0)
