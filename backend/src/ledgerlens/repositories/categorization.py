from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ledgerlens.models import CategorizationResult, ResultStatus


class CategorizationRepo:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, result: CategorizationResult) -> CategorizationResult:
        self.db.add(result)
        self.db.flush()
        return result

    def get(self, result_id: str) -> CategorizationResult | None:
        return self.db.get(CategorizationResult, result_id)

    def latest_for_transaction(self, tx_id: str) -> CategorizationResult | None:
        stmt = (
            select(CategorizationResult)
            .where(CategorizationResult.transaction_id == tx_id)
            .order_by(desc(CategorizationResult.created_at))
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def list_for_transaction(self, tx_id: str) -> list[CategorizationResult]:
        stmt = (
            select(CategorizationResult)
            .where(CategorizationResult.transaction_id == tx_id)
            .order_by(desc(CategorizationResult.created_at))
        )
        return list(self.db.scalars(stmt))

    def list_by_status(
        self,
        status: ResultStatus,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CategorizationResult]:
        stmt = (
            select(CategorizationResult)
            .where(CategorizationResult.status == status)
            .order_by(desc(CategorizationResult.created_at))
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))
