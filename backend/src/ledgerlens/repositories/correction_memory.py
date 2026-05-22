from datetime import UTC, datetime

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from ledgerlens.models import CorrectionMemory


class CorrectionMemoryRepo:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, id_: str) -> CorrectionMemory | None:
        return self.db.get(CorrectionMemory, id_)

    def find_for_keys(self, *, merchant_key: str, description_key: str) -> list[CorrectionMemory]:
        """Return all active rows whose merchant_key or description_key matches.

        Order is irrelevant for safety logic; caller resolves conflicts.
        """
        if not merchant_key and not description_key:
            return []
        stmt = select(CorrectionMemory).where(CorrectionMemory.active.is_(True))
        filters = []
        if merchant_key:
            filters.append(CorrectionMemory.merchant_key == merchant_key)
        if description_key:
            filters.append(CorrectionMemory.description_key == description_key)
        stmt = stmt.where(or_(*filters))
        return list(self.db.scalars(stmt))

    def find_exact(
        self,
        *,
        merchant_key: str,
        description_key: str,
        selected_category_code: str,
    ) -> CorrectionMemory | None:
        stmt = (
            select(CorrectionMemory)
            .where(CorrectionMemory.merchant_key == merchant_key)
            .where(CorrectionMemory.description_key == description_key)
            .where(CorrectionMemory.selected_category_code == selected_category_code)
            .limit(1)
        )
        return self.db.scalars(stmt).first()

    def add(self, memory: CorrectionMemory) -> CorrectionMemory:
        self.db.add(memory)
        self.db.flush()
        return memory

    def list(
        self,
        *,
        active: bool | None = None,
        category_code: str | None = None,
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CorrectionMemory]:
        stmt = select(CorrectionMemory).order_by(desc(CorrectionMemory.updated_at))
        if active is not None:
            stmt = stmt.where(CorrectionMemory.active.is_(active))
        if category_code:
            stmt = stmt.where(CorrectionMemory.selected_category_code == category_code)
        if q:
            like = f"%{q.upper()}%"
            stmt = stmt.where(
                or_(
                    CorrectionMemory.merchant_key.like(like),
                    CorrectionMemory.description_key.like(like),
                )
            )
        stmt = stmt.limit(limit).offset(offset)
        return list(self.db.scalars(stmt))

    def count(self, *, active: bool | None = None) -> int:
        from sqlalchemy import func

        stmt = select(func.count()).select_from(CorrectionMemory)
        if active is not None:
            stmt = stmt.where(CorrectionMemory.active.is_(active))
        return int(self.db.scalar(stmt) or 0)

    def mark_used(self, memory: CorrectionMemory) -> None:
        memory.match_count = (memory.match_count or 0) + 1
        memory.last_used_at = datetime.now(UTC)
        self.db.flush()
