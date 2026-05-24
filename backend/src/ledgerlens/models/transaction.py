import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"tx_{uuid.uuid4().hex[:16]}"


class Transaction(Base):
    """A bank or card transaction submitted for categorization."""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    # Phase 3 tenant-boundary: business_id is nullable in the DB
    # schema so the migration can backfill demo rows safely, but the
    # service layer treats it as required for every new row.
    business_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    raw_description: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_description: Mapped[str] = mapped_column(String(512), nullable=False)
    merchant: Mapped[str | None] = mapped_column(String(256), nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="api")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
