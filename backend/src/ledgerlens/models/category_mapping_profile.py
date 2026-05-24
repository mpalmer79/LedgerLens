"""Future per-business intent → COA mapping persistence.

Schema only. The mapping editor UI does not yet write to these
tables — the active mapping is still resolved from
`backend/src/ledgerlens/data/business_rule_maps.py` so the public
demo and existing tests remain unchanged.

These models exist now so the next sprint can:

1. Migrate the Python map into seeded `CategoryMappingProfile` rows.
2. Wire the read path (`/rules.mapping`, `/mapping`) to read from
   the database with the Python file as a fallback.
3. Add the editor UI behind the future auth/tenant Phase 2.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_profile_id() -> str:
    return f"cmp_{uuid.uuid4().hex[:16]}"


def _new_entry_id() -> str:
    return f"cme_{uuid.uuid4().hex[:16]}"


class CategoryMappingProfile(Base):
    """A named intent → category mapping owned by a business.

    A business can have multiple profiles (e.g. "default",
    "tax-season-2026"); the active one is the row with
    `is_active=True`. The unique constraint is on (business_id,
    name) so a business cannot have two profiles with the same
    name.
    """

    __tablename__ = "category_mapping_profiles"
    __table_args__ = (
        UniqueConstraint("business_id", "name", name="uq_category_mapping_profiles_business_name"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_profile_id)
    business_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("businesses.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # How this profile got here. "seed" = re-seedable from the Python
    # registry; "user" = the owner edited it; future Phase 2 may add
    # "imported" for accountant-supplied profiles. Stored as a plain
    # string to keep migrations simple.
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="seed", server_default="seed"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )


class CategoryMappingEntry(Base):
    """A single (intent → COA code) row inside a profile.

    `block_fallback=True` mirrors the
    `BusinessRuleMap.block_fallback_intents` set today: when set,
    matching rows are routed to review instead of being
    auto-categorized from the rule's own default code.
    """

    __tablename__ = "category_mapping_entries"
    __table_args__ = (
        UniqueConstraint("profile_id", "intent", name="uq_category_mapping_entries_profile_intent"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_entry_id)
    profile_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("category_mapping_profiles.id"),
        nullable=False,
        index=True,
    )
    intent: Mapped[str] = mapped_column(String(64), nullable=False)
    # Nullable so an entry can represent "intentionally unmapped"
    # (when paired with block_fallback=True or simply pending an
    # owner decision).
    category_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    category_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    block_fallback: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    notes: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
