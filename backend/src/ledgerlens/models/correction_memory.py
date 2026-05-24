import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"mem_{uuid.uuid4().hex[:16]}"


class CorrectionMemory(Base):
    """A reusable signal derived from a human correction.

    One row per (merchant_key, description_key, selected_category_code).
    Re-correcting the same merchant updates `match_count` and `last_used_at`
    rather than creating a duplicate row.
    """

    __tablename__ = "correction_memory"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    # Tenant-boundary scope; nullable in schema for safe backfill.
    business_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    merchant_key: Mapped[str] = mapped_column(String(128), index=True, nullable=False, default="")
    description_key: Mapped[str] = mapped_column(
        String(512), index=True, nullable=False, default=""
    )
    selected_category_code: Mapped[str] = mapped_column(String(16), nullable=False)

    source_transaction_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("transactions.id"), nullable=False
    )
    source_review_decision_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("review_decisions.id"), nullable=False
    )

    match_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
