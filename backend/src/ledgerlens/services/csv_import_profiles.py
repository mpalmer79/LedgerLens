"""Persistent CSV import profile service.

Stores column-mapping metadata only — never raw rows. The wizard
calls into here to save / load / validate profiles for a recurring
bank export. See `docs/SAVED_CSV_IMPORT_PROFILES_AUDIT.md`.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ledgerlens.data.business_rule_maps import active_business_id
from ledgerlens.data.sample_scenario import SAMPLE_SCENARIO
from ledgerlens.models import CsvImportProfile

SEED_SAMPLE_PROFILE_NAME = "Granite State sample bank CSV"

SUPPORTED_AMOUNT_MODES: frozenset[str] = frozenset({"signed", "debit_credit"})


# ── Validation ────────────────────────────────────────────────────────


class ProfileValidationError(ValueError):
    """Raised when a profile config is internally inconsistent."""


@dataclass(frozen=True)
class ProfileInput:
    name: str
    amount_mode: str
    date_column: str
    description_column: str
    amount_column: str | None = None
    debit_column: str | None = None
    credit_column: str | None = None
    merchant_column: str | None = None
    account_column: str | None = None
    memo_column: str | None = None
    reference_column: str | None = None
    expected_headers: list[str] | None = None

    def validate(self) -> None:
        if not self.name.strip():
            raise ProfileValidationError("Profile name cannot be blank.")
        if self.amount_mode not in SUPPORTED_AMOUNT_MODES:
            raise ProfileValidationError(
                f"amount_mode must be one of {sorted(SUPPORTED_AMOUNT_MODES)!r}; "
                f"got {self.amount_mode!r}."
            )
        if not self.date_column.strip():
            raise ProfileValidationError("date_column is required.")
        if not self.description_column.strip():
            raise ProfileValidationError("description_column is required.")
        if self.amount_mode == "signed":
            if not (self.amount_column or "").strip():
                raise ProfileValidationError("Signed amount mode requires amount_column.")
        else:  # debit_credit
            if not (self.debit_column or "").strip():
                raise ProfileValidationError("Debit/credit amount mode requires debit_column.")
            if not (self.credit_column or "").strip():
                raise ProfileValidationError("Debit/credit amount mode requires credit_column.")


# ── Seeded sample profile ─────────────────────────────────────────────


def _seed_profile_input() -> ProfileInput:
    return ProfileInput(
        name=SEED_SAMPLE_PROFILE_NAME,
        amount_mode="debit_credit",
        date_column="Posted Date",
        description_column="Description",
        debit_column="Debit",
        credit_column="Credit",
        account_column="Account",
        reference_column="Reference",
        expected_headers=[
            "Posted Date",
            "Description",
            "Debit",
            "Credit",
            "Account",
            "Reference",
        ],
    )


def _ensure_seed_profile(db: Session, business_id: str) -> CsvImportProfile:
    """Idempotently create the seeded sample profile for a business."""
    existing = (
        db.query(CsvImportProfile)
        .filter(
            CsvImportProfile.business_id == business_id,
            CsvImportProfile.name == SEED_SAMPLE_PROFILE_NAME,
        )
        .one_or_none()
    )
    if existing is not None:
        return existing
    seed = _seed_profile_input()
    profile = _build_profile(business_id, seed, source="seed")
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# ── CRUD ──────────────────────────────────────────────────────────────


def _build_profile(
    business_id: str, payload: ProfileInput, *, source: str = "user"
) -> CsvImportProfile:
    return CsvImportProfile(
        business_id=business_id,
        name=payload.name.strip(),
        source=source,
        amount_mode=payload.amount_mode,
        date_column=payload.date_column.strip(),
        description_column=payload.description_column.strip(),
        amount_column=(payload.amount_column or "").strip() or None,
        debit_column=(payload.debit_column or "").strip() or None,
        credit_column=(payload.credit_column or "").strip() or None,
        merchant_column=(payload.merchant_column or "").strip() or None,
        account_column=(payload.account_column or "").strip() or None,
        memo_column=(payload.memo_column or "").strip() or None,
        reference_column=(payload.reference_column or "").strip() or None,
        expected_headers_json=list(payload.expected_headers or []),
    )


def list_profiles(db: Session, business_id: str | None = None) -> list[CsvImportProfile]:
    bid = business_id or active_business_id()
    _ensure_seed_profile(db, bid)
    return (
        db.query(CsvImportProfile)
        .filter(CsvImportProfile.business_id == bid)
        .order_by(CsvImportProfile.source.desc(), CsvImportProfile.name)
        .all()
    )


def get_profile(db: Session, profile_id: str) -> CsvImportProfile | None:
    return db.query(CsvImportProfile).filter(CsvImportProfile.id == profile_id).one_or_none()


def create_profile(
    db: Session, payload: ProfileInput, *, business_id: str | None = None
) -> CsvImportProfile:
    payload.validate()
    bid = business_id or active_business_id()
    profile = _build_profile(bid, payload, source="user")
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_profile(db: Session, profile_id: str, payload: ProfileInput) -> CsvImportProfile:
    payload.validate()
    profile = get_profile(db, profile_id)
    if profile is None:
        raise LookupError(profile_id)
    profile.name = payload.name.strip()
    profile.amount_mode = payload.amount_mode
    profile.date_column = payload.date_column.strip()
    profile.description_column = payload.description_column.strip()
    profile.amount_column = (payload.amount_column or "").strip() or None
    profile.debit_column = (payload.debit_column or "").strip() or None
    profile.credit_column = (payload.credit_column or "").strip() or None
    profile.merchant_column = (payload.merchant_column or "").strip() or None
    profile.account_column = (payload.account_column or "").strip() or None
    profile.memo_column = (payload.memo_column or "").strip() or None
    profile.reference_column = (payload.reference_column or "").strip() or None
    profile.expected_headers_json = list(payload.expected_headers or [])
    db.commit()
    db.refresh(profile)
    return profile


def delete_profile(db: Session, profile_id: str) -> CsvImportProfile:
    profile = get_profile(db, profile_id)
    if profile is None:
        raise LookupError(profile_id)
    if profile.source == "seed":
        raise PermissionError(
            "Seeded profiles cannot be deleted. Use POST /import-profiles/reset to restore "
            "the seeded profile."
        )
    db.delete(profile)
    db.commit()
    return profile


def reset_to_seed(db: Session, business_id: str | None = None) -> CsvImportProfile:
    """Restore the seeded sample profile in case the user deleted it
    or edited it beyond recognition."""
    bid = business_id or active_business_id()
    existing = (
        db.query(CsvImportProfile)
        .filter(
            CsvImportProfile.business_id == bid,
            CsvImportProfile.name == SEED_SAMPLE_PROFILE_NAME,
        )
        .one_or_none()
    )
    seed = _seed_profile_input()
    if existing is not None:
        db.delete(existing)
        db.commit()
    seeded = _build_profile(bid, seed, source="seed")
    db.add(seeded)
    db.commit()
    db.refresh(seeded)
    return seeded


# ── Header validation ─────────────────────────────────────────────────


@dataclass(frozen=True)
class HeaderValidation:
    matched_headers: list[str]
    missing_headers: list[str]
    extra_headers: list[str]
    profile_applicable: bool
    warnings: list[str]


def _required_columns(profile: CsvImportProfile) -> list[str]:
    cols = [profile.date_column, profile.description_column]
    if profile.amount_mode == "signed":
        if profile.amount_column:
            cols.append(profile.amount_column)
    else:
        if profile.debit_column:
            cols.append(profile.debit_column)
        if profile.credit_column:
            cols.append(profile.credit_column)
    return cols


def _all_mapped_columns(profile: CsvImportProfile) -> list[str]:
    return [
        c
        for c in (
            profile.date_column,
            profile.description_column,
            profile.amount_column,
            profile.debit_column,
            profile.credit_column,
            profile.merchant_column,
            profile.account_column,
            profile.memo_column,
            profile.reference_column,
        )
        if c
    ]


def validate_headers(profile: CsvImportProfile, headers: Iterable[str]) -> HeaderValidation:
    incoming = [h.strip() for h in headers if h and h.strip()]
    seen = set(incoming)
    required = _required_columns(profile)
    mapped = _all_mapped_columns(profile)
    missing = [c for c in required if c not in seen]
    matched = [c for c in mapped if c in seen]
    # "Extra" = headers in the upload that the profile doesn't reference.
    extras = [h for h in incoming if h not in set(mapped)]
    warnings: list[str] = []
    if missing:
        warnings.append(
            "Your bank may have changed the export format. The saved profile "
            "expects columns that are not present in this upload."
        )
    if extras:
        warnings.append("Extra columns are okay. LedgerLens ignores columns you do not map.")
    return HeaderValidation(
        matched_headers=matched,
        missing_headers=missing,
        extra_headers=extras,
        profile_applicable=not missing,
        warnings=warnings,
    )


# ── Demo metadata ─────────────────────────────────────────────────────


def business_display_name(business_id: str) -> str | None:
    if business_id == "granite_state_auto_repair":
        return SAMPLE_SCENARIO["business_name"]
    return None
