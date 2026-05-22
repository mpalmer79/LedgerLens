import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


class ReviewerAction(enum.StrEnum):
    APPROVE = "approve"
    CORRECT = "correct"
    MARK_UNCATEGORIZABLE = "mark_uncategorizable"


def _new_id() -> str:
    return f"rev_{uuid.uuid4().hex[:16]}"


class ReviewDecision(Base):
    """A human review action against a categorization result."""

    __tablename__ = "review_decisions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    transaction_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("transactions.id"), nullable=False, index=True
    )
    categorization_result_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("categorization_results.id"), nullable=False
    )

    reviewer_action: Mapped[ReviewerAction] = mapped_column(
        Enum(ReviewerAction, name="reviewer_action"), nullable=False
    )
    selected_category_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    reviewer_note: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
