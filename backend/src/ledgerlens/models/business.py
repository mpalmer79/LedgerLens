"""Business — a real-world business owned by a tenant.

One tenant can have many businesses (an accountant managing several
clients). Per-business chart of accounts and per-business rule
mapping will eventually attach here. Schema foundation only — no
existing rows are scoped to a business yet.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"biz_{uuid.uuid4().hex[:16]}"


class Business(Base):
    """A business owned by a tenant."""

    __tablename__ = "businesses"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_businesses_tenant_slug"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    industry: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
