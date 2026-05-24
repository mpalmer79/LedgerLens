"""Saved CSV import profile API.

Demo-safe: routes are unauthenticated; the responses carry the
public-demo warning the wizard echoes. See
`docs/SAVED_CSV_IMPORT_PROFILES_AUDIT.md`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.data.business_rule_maps import active_business_id
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound, ValidationFailed
from ledgerlens.services.audit_log import record_audit_event
from ledgerlens.services.csv_import_profiles import (
    SEED_SAMPLE_PROFILE_NAME,
    ProfileInput,
    ProfileValidationError,
    business_display_name,
    create_profile,
    delete_profile,
    get_profile,
    list_profiles,
    reset_to_seed,
    validate_headers,
)

router = APIRouter(prefix="/import-profiles", tags=["import-profiles"])


# ── Schemas ────────────────────────────────────────────────────────────


class CsvImportProfileOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        # The response uses the serialization_alias on each field
        # so the public shape stays plain ("expected_headers", not
        # the internal `_json` suffix).
        ser_json_inf_nan="constants",
    )

    id: str
    business_id: str
    name: str
    source: str  # "seed" | "user"
    amount_mode: str  # "signed" | "debit_credit"
    date_column: str
    description_column: str
    amount_column: str | None
    debit_column: str | None
    credit_column: str | None
    merchant_column: str | None
    account_column: str | None
    memo_column: str | None
    reference_column: str | None
    # The ORM column is named `expected_headers_json` but the API
    # response surface uses the plainer `expected_headers`.
    expected_headers: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("expected_headers", "expected_headers_json"),
        serialization_alias="expected_headers",
    )


class CsvImportProfileListOut(BaseModel):
    business_id: str
    business_name: str | None
    profiles: list[CsvImportProfileOut]
    warnings: list[str]


class CsvImportProfilePayload(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    amount_mode: str = Field(min_length=1, max_length=16)
    date_column: str = Field(min_length=1, max_length=64)
    description_column: str = Field(min_length=1, max_length=64)
    amount_column: str | None = Field(default=None, max_length=64)
    debit_column: str | None = Field(default=None, max_length=64)
    credit_column: str | None = Field(default=None, max_length=64)
    merchant_column: str | None = Field(default=None, max_length=64)
    account_column: str | None = Field(default=None, max_length=64)
    memo_column: str | None = Field(default=None, max_length=64)
    reference_column: str | None = Field(default=None, max_length=64)
    expected_headers: list[str] = Field(default_factory=list)

    def to_input(self) -> ProfileInput:
        return ProfileInput(
            name=self.name,
            amount_mode=self.amount_mode,
            date_column=self.date_column,
            description_column=self.description_column,
            amount_column=self.amount_column,
            debit_column=self.debit_column,
            credit_column=self.credit_column,
            merchant_column=self.merchant_column,
            account_column=self.account_column,
            memo_column=self.memo_column,
            reference_column=self.reference_column,
            expected_headers=list(self.expected_headers),
        )


class ValidateHeadersPayload(BaseModel):
    headers: list[str] = Field(min_length=0, max_length=128)


class ValidateHeadersOut(BaseModel):
    profile_id: str
    profile_name: str
    matched_headers: list[str]
    missing_headers: list[str]
    extra_headers: list[str]
    profile_applicable: bool
    warnings: list[str]


# ── Helpers ────────────────────────────────────────────────────────────


_WARNINGS: list[str] = [
    "Public demo — saved import profiles are not protected by production authentication.",
    "Profiles save column names and mapping choices only — not transaction rows.",
    "Do not upload real bank data. Use synthetic / sample CSVs only.",
]


def _to_out(p) -> CsvImportProfileOut:  # type: ignore[no-untyped-def]
    return CsvImportProfileOut.model_validate(p)


# ── Routes ─────────────────────────────────────────────────────────────


@router.get("", response_model=CsvImportProfileListOut)
def list_import_profiles(db: Session = Depends(get_db)) -> CsvImportProfileListOut:
    bid = active_business_id()
    items = list_profiles(db, bid)
    return CsvImportProfileListOut(
        business_id=bid,
        business_name=business_display_name(bid),
        profiles=[_to_out(p) for p in items],
        warnings=list(_WARNINGS),
    )


@router.post("", response_model=CsvImportProfileOut, status_code=201)
def create_import_profile(
    payload: CsvImportProfilePayload,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CsvImportProfileOut:
    try:
        profile = create_profile(db, payload.to_input())
    except ProfileValidationError as e:
        raise ValidationFailed(str(e)) from e
    except IntegrityError as e:
        # Unique (business_id, name) violation surfaces as 422 with a
        # clear message instead of a generic 500.
        db.rollback()
        raise ValidationFailed(
            f"A profile named {payload.name!r} already exists for this business."
        ) from e
    record_audit_event(
        db,
        actor=actor,
        action="import_profile.created",
        entity_type="csv_import_profile",
        entity_id=profile.id,
        after={"name": profile.name, "amount_mode": profile.amount_mode},
        commit=True,
    )
    return _to_out(profile)


@router.put("/{profile_id}", response_model=CsvImportProfileOut)
def update_import_profile(
    profile_id: str,
    payload: CsvImportProfilePayload,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CsvImportProfileOut:
    from ledgerlens.services.csv_import_profiles import update_profile

    existing = get_profile(db, profile_id)
    if existing is None:
        raise NotFound("csv_import_profile", profile_id)
    before = {"name": existing.name, "amount_mode": existing.amount_mode}
    try:
        profile = update_profile(db, profile_id, payload.to_input())
    except ProfileValidationError as e:
        raise ValidationFailed(str(e)) from e
    record_audit_event(
        db,
        actor=actor,
        action="import_profile.updated",
        entity_type="csv_import_profile",
        entity_id=profile.id,
        before=before,
        after={"name": profile.name, "amount_mode": profile.amount_mode},
        commit=True,
    )
    return _to_out(profile)


@router.delete("/{profile_id}", response_model=CsvImportProfileOut)
def delete_import_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CsvImportProfileOut:
    try:
        profile = delete_profile(db, profile_id)
    except LookupError as e:
        raise NotFound("csv_import_profile", profile_id) from e
    except PermissionError as e:
        raise ValidationFailed(str(e)) from e
    record_audit_event(
        db,
        actor=actor,
        action="import_profile.deleted",
        entity_type="csv_import_profile",
        entity_id=profile.id,
        before={"name": profile.name, "amount_mode": profile.amount_mode},
        commit=True,
    )
    return _to_out(profile)


@router.post("/{profile_id}/validate", response_model=ValidateHeadersOut)
def validate_profile_headers(
    profile_id: str,
    payload: ValidateHeadersPayload,
    db: Session = Depends(get_db),
) -> ValidateHeadersOut:
    profile = get_profile(db, profile_id)
    if profile is None:
        raise NotFound("csv_import_profile", profile_id)
    result = validate_headers(profile, payload.headers)
    return ValidateHeadersOut(
        profile_id=profile.id,
        profile_name=profile.name,
        matched_headers=result.matched_headers,
        missing_headers=result.missing_headers,
        extra_headers=result.extra_headers,
        profile_applicable=result.profile_applicable,
        warnings=result.warnings,
    )


@router.post("/reset", response_model=CsvImportProfileOut)
def reset_seed_profile(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CsvImportProfileOut:
    profile = reset_to_seed(db)
    record_audit_event(
        db,
        actor=actor,
        action="import_profile.reset",
        entity_type="csv_import_profile",
        entity_id=profile.id,
        commit=True,
    )
    return _to_out(profile)


__all__ = ["SEED_SAMPLE_PROFILE_NAME", "router"]
