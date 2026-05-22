from sqlalchemy import select
from sqlalchemy.orm import Session

from ledgerlens.models import AccountCategory


class CategoryRepo:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, code: str) -> AccountCategory | None:
        return self.db.get(AccountCategory, code)

    def list_active(self) -> list[AccountCategory]:
        stmt = (
            select(AccountCategory)
            .where(AccountCategory.active.is_(True))
            .order_by(AccountCategory.code)
        )
        return list(self.db.scalars(stmt))

    def exists(self, code: str) -> bool:
        return self.get(code) is not None

    def upsert(self, cat: AccountCategory) -> AccountCategory:
        existing = self.get(cat.code)
        if existing is None:
            self.db.add(cat)
        else:
            existing.name = cat.name
            existing.description = cat.description
            existing.type = cat.type
            existing.active = cat.active
        self.db.flush()
        return self.get(cat.code) or cat
