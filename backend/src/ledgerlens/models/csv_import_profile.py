"""Saved CSV import profile — header metadata + column mapping only.

Stores enough configuration to pre-fill the `/transactions/import`
wizard for a recurring bank export. **Never** stores raw rows,
transaction descriptions, account numbers, or any other row-level
financial data. See `docs/SAVED_CSV_IMPORT_PROFILES_AUDIT.md` for
the boundary.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ledgerlens.db import Base


def _new_id() -> str:
    return f"cip_{uuid.uuid4().hex[:16]}"


class CsvImportProfile(Base):
    """A reusable CSV column-mapping for a recurring bank export.

    The unique constraint is `(business_id, name)` so the same
    business cannot have two profiles with the same display name.
    """

    __tablename__ = "csv_import_profiles"
    __table_args__ = (
        UniqueConstraint("business_id", "name", name="uq_csv_import_profiles_business_name"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    business_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    source: Mapped[str] = mapped_column(
        String(16), nullable=False, default="user", server_default="user"
    )
    # "signed" or "debit_credit".
    amount_mode: Mapped[str] = mapped_column(String(16), nullable=False)

    # Required column mappings.
    date_column: Mapped[str] = mapped_column(String(64), nullable=False)
    description_column: Mapped[str] = mapped_column(String(64), nullable=False)

    # Amount-mode-dependent columns. The validator enforces the
    # "signed-mode needs amount_column; debit_credit-mode needs both
    # debit + credit" invariants; the schema stays permissive so
    # one row can represent either mode.
    amount_column: Mapped[str | None] = mapped_column(String(64), nullable=True)
    debit_column: Mapped[str | None] = mapped_column(String(64), nullable=True)
    credit_column: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Optional column mappings the wizard already tracks.
    merchant_column: Mapped[str | None] = mapped_column(String(64), nullable=True)
    account_column: Mapped[str | None] = mapped_column(String(64), nullable=True)
    memo_column: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reference_column: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # The header row the bank exported when the profile was saved.
    # JSON-encoded list[str] — used by the validate endpoint to
    # detect "the bank changed the export format". Never contains
    # row data.
    expected_headers_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
