import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"spl_{uuid.uuid4().hex[:16]}"


class TransactionSplitLine(Base):
    """A category-split line on a transaction.

    When a single bank transaction covers multiple categories (e.g.
    Amazon order containing shop supplies + personal items), the owner
    or reviewer can split it into multiple lines, each with its own
    category and amount.

    Rules enforced by the service layer, not the DB schema:
    - Sum of split amounts must equal the parent transaction amount.
    - Lines must share the parent's business_id.
    - Incomplete splits route to review/follow-up.

    This is reviewed-categorization splitting, not double-entry
    accounting. The accountant takes these lines and books the
    offsetting entries in their system.
    """

    __tablename__ = "transaction_split_lines"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    transaction_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("transactions.id"), nullable=False, index=True
    )
    business_id: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)

    line_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    category_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    category_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    note: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="owner_review")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
