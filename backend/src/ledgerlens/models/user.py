"""User model — schema foundation only.

This sprint does not implement password hashing, login, or sessions.
The model exists so future migrations can target a stable schema.
See `docs/AUTH_TENANT_PHASE_1.md` for the boundary.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"usr_{uuid.uuid4().hex[:16]}"


class User(Base):
    """A user account.

    No password column exists yet because no login flow exists yet.
    When Phase 2 lands, it will add `password_hash` (argon2) and a
    related `Session` table. Keeping the User model in place now
    means the FK targets for `Membership.user_id` and
    `AuditEvent.actor_user_id` (future) are stable.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    # `email` is a logical identifier today (no email is ever sent
    # by this app). Stored lowercased + unique.
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
