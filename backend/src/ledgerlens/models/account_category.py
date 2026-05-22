from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


class AccountCategory(Base):
    """An account in the chart of accounts.

    Codes follow standard bookkeeping convention (1xxx assets, 2xxx
    liabilities, ..., 8xxx other expense). The `type` field carries the
    category family for routing and reporting.
    """

    __tablename__ = "account_categories"

    code: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
