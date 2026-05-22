from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ledgerlens.models import ReviewDecision


class ReviewRepo:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, decision: ReviewDecision) -> ReviewDecision:
        self.db.add(decision)
        self.db.flush()
        return decision

    def list_for_transaction(self, tx_id: str) -> list[ReviewDecision]:
        stmt = (
            select(ReviewDecision)
            .where(ReviewDecision.transaction_id == tx_id)
            .order_by(desc(ReviewDecision.created_at))
        )
        return list(self.db.scalars(stmt))

    def latest_for_transaction(self, tx_id: str) -> ReviewDecision | None:
        decisions = self.list_for_transaction(tx_id)
        return decisions[0] if decisions else None
