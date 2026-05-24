"""Tenant (organization) model.

A tenant is a billing scope. One tenant can own many businesses
(e.g. an accountant managing several clients). This is the schema
foundation only — no route protection or tenant scoping is wired
into existing queries this sprint. See
`docs/AUTH_TENANT_PHASE_1.md` for the full boundary.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"ten_{uuid.uuid4().hex[:16]}"


class Tenant(Base):
    """A tenant / organization. Owns one or more businesses."""

    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    # Soft-delete marker. None means active.
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
