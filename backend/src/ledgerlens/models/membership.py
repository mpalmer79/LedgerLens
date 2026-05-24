"""Membership = (User, Tenant, role) association.

A membership grants a user a role on a tenant. This is the schema
foundation only — no route uses memberships to authorize anything
this sprint.
"""

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


class MembershipRole(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


def _new_id() -> str:
    return f"mem_{uuid.uuid4().hex[:16]}"


class Membership(Base):
    """Associates one user with one tenant at a given role."""

    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_memberships_user_tenant"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("users.id"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("tenants.id"), nullable=False, index=True
    )
    role: Mapped[MembershipRole] = mapped_column(
        Enum(MembershipRole, name="membership_role"),
        nullable=False,
        default=MembershipRole.OWNER,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
