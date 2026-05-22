import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


class ResultStatus(enum.StrEnum):
    AUTO_APPROVED = "auto_approved"
    NEEDS_REVIEW = "needs_review"
    UNCATEGORIZABLE = "uncategorizable"
    CORRECTED = "corrected"
    REJECTED = "rejected"
    FAILED = "failed"


def _new_id() -> str:
    return f"cat_{uuid.uuid4().hex[:16]}"


class CategorizationResult(Base):
    """A single model prediction against a stored transaction."""

    __tablename__ = "categorization_results"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    transaction_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("transactions.id"), nullable=False, index=True
    )

    predicted_category_code: Mapped[str] = mapped_column(String(16), nullable=False)
    predicted_category_name: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    explanation: Mapped[str] = mapped_column(String(2048), nullable=False, default="")
    alternative_category_code: Mapped[str | None] = mapped_column(String(16), nullable=True)

    model_provider: Mapped[str] = mapped_column(String(32), nullable=False, default="anthropic")
    model_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    status: Mapped[ResultStatus] = mapped_column(
        Enum(ResultStatus, name="result_status"),
        nullable=False,
        default=ResultStatus.NEEDS_REVIEW,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
