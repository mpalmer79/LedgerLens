import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"aud_{uuid.uuid4().hex[:16]}"


class AuditEvent(Base):
    """A timestamped record of a state-changing operation.

    Generic enough to cover transaction creation, categorization, review
    actions, and ledger exports. Details are a JSON blob — kept loose
    intentionally so adding a new audited action does not require a schema
    change.
    """

    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )
