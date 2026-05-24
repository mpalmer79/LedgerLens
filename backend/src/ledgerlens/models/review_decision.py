import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


class ReviewerAction(enum.StrEnum):
    APPROVE = "approve"
    CORRECT = "correct"
    MARK_UNCATEGORIZABLE = "mark_uncategorizable"
    # The reviewer explicitly deferred this row to an accountant. The
    # categorization result's status becomes ACCOUNTANT_REVIEW_REQUIRED;
    # selected_category_code stays None; accountant_follow_up_required
    # is recorded as True on the ReviewDecision.
    MARK_FOR_ACCOUNTANT_REVIEW = "mark_for_accountant_review"


def _new_id() -> str:
    return f"rev_{uuid.uuid4().hex[:16]}"


class ReviewDecision(Base):
    """A human review action against a categorization result.

    Owner-answer fields (v2) are nullable additions on top of the original
    v1 columns. v1 free-text answers continue to live in `reviewer_note`;
    v2 captures the structured question key + labelled answer + optional
    free-text owner note + accountant-follow-up flag so the handoff can
    render a labelled "Questions answered by owner" section without
    pattern-matching note text.
    """

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

    # ── Owner Answers v2 (all nullable; v1 rows are unaffected) ──
    owner_question_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    owner_question_text: Mapped[str | None] = mapped_column(String(256), nullable=True)
    owner_answer_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    owner_note: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    suggested_resolution: Mapped[str | None] = mapped_column(String(64), nullable=True)
    accountant_follow_up_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
