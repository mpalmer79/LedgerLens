"""Editable category-mapping API.

Reads + writes are demo-safe: the routes are not yet behind auth.
The frontend `/mapping` page surfaces a visible "public demo" warning;
any production deployment must gate these writes via the
auth/tenant Phase 2 PR.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from ledgerlens.data.business_rule_maps import active_business_id, get_business_rule_map
from ledgerlens.data.sample_scenario import SAMPLE_SCENARIO
from ledgerlens.db import get_db
from ledgerlens.errors import ValidationFailed
from ledgerlens.models import AccountCategory
from ledgerlens.services.category_mapping import (
    ACTIVE_PROFILE_NAME,
    UnknownCategoryCodeError,
    UnknownIntentError,
    build_entry_views,
    get_active_profile_with_entries,
    list_known_intents,
    reset_to_seed,
    update_entry,
)
from ledgerlens.services.mapping_preview import preview_mapping_change

router = APIRouter(prefix="/mapping", tags=["mapping"])


# ── Response models ────────────────────────────────────────────────────


class MappingEntryOut(BaseModel):
    intent: str
    category_code: str | None
    category_name: str | None
    block_fallback: bool
    notes: str | None
    status: str  # "mapped" | "unmapped" | "fallback_blocked"


class MappingProfileOut(BaseModel):
    profile_id: str
    profile_name: str
    business_id: str
    business_name: str | None
    source: str  # "seed" | "user"
    entries: list[MappingEntryOut]
    # Intents known to the registry but absent from this profile —
    # surfaced so the UI can offer the owner a way to decide on them.
    missing_intents: list[str]
    # Every active category in the chart of accounts. The UI uses
    # this to render the dropdown.
    available_categories: list[CategoryOption]
    # Visible warnings the UI must echo.
    warnings: list[str]


class CategoryOption(BaseModel):
    code: str
    name: str


class MappingEntryUpdate(BaseModel):
    category_code: str | None = Field(default=None, max_length=16)
    block_fallback: bool = False
    notes: str | None = Field(default=None, max_length=512)

    @field_validator("category_code")
    @classmethod
    def _strip_code(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


# ── Routes ─────────────────────────────────────────────────────────────


def _warnings() -> list[str]:
    return [
        "Public demo — these mapping settings are not protected by production authentication.",
        "Do not upload real bank data. Use synthetic / sample CSVs only.",
        "This is a categorization handoff aid, not a true accounting ledger.",
    ]


def _business_name(business_id: str) -> str | None:
    if business_id == "granite_state_auto_repair":
        return SAMPLE_SCENARIO["business_name"]
    return None


def _to_profile_out(db: Session, business_id: str | None = None) -> MappingProfileOut:
    bid = business_id or active_business_id()
    profile, entries = get_active_profile_with_entries(db, bid)
    views = build_entry_views(entries)
    have = {v.intent for v in views}
    missing = [i for i in list_known_intents(bid) if i not in have]
    # Include intents the registry marks as block-fallback but that the
    # profile hasn't materialized yet.
    rule_map = get_business_rule_map(bid)
    for i in rule_map.block_fallback_intents:
        if i not in have and i not in missing:
            missing.append(i)
    available = [
        CategoryOption(code=c.code, name=c.name)
        for c in db.query(AccountCategory)
        .filter(AccountCategory.active)
        .order_by(AccountCategory.code)
    ]
    return MappingProfileOut(
        profile_id=profile.id,
        profile_name=profile.name,
        business_id=bid,
        business_name=_business_name(bid),
        source=profile.source,
        entries=[
            MappingEntryOut(
                intent=v.intent,
                category_code=v.category_code,
                category_name=v.category_name,
                block_fallback=v.block_fallback,
                notes=v.notes,
                status=v.status,
            )
            for v in views
        ],
        missing_intents=sorted(missing),
        available_categories=available,
        warnings=_warnings(),
    )


@router.get("/profile", response_model=MappingProfileOut)
def get_profile(db: Session = Depends(get_db)) -> MappingProfileOut:
    """Read the active mapping profile for the active demo business."""
    return _to_profile_out(db)


@router.put(
    "/profile/entries/{intent}",
    response_model=MappingProfileOut,
)
def put_entry(
    intent: str,
    payload: MappingEntryUpdate,
    db: Session = Depends(get_db),
) -> MappingProfileOut:
    """Upsert a single entry on the active profile."""
    intent = intent.strip()
    if not intent:
        raise ValidationFailed("Intent must be non-empty.")
    try:
        update_entry(
            db,
            intent=intent,
            category_code=payload.category_code,
            block_fallback=payload.block_fallback,
            notes=payload.notes,
        )
    except UnknownIntentError as e:
        raise ValidationFailed(str(e)) from e
    except UnknownCategoryCodeError as e:
        raise ValidationFailed(str(e), code=payload.category_code or "") from e
    return _to_profile_out(db)


@router.post("/profile/reset", response_model=MappingProfileOut)
def reset_profile(db: Session = Depends(get_db)) -> MappingProfileOut:
    """Reset the active profile back to the seeded registry defaults."""
    reset_to_seed(db)
    return _to_profile_out(db)


# ── Recategorization preview ──────────────────────────────────────────


class MappingPreviewPayload(BaseModel):
    intent: str = Field(min_length=1, max_length=64)
    proposed_category_code: str | None = Field(default=None, max_length=16)
    block_fallback: bool = False
    limit: int = Field(default=200, ge=1, le=1000)


class MappingPreviewRow(BaseModel):
    transaction_id: str
    transaction_date: str
    description: str
    merchant: str | None
    amount_cents: int
    current_category_code: str | None
    current_category_name: str | None
    proposed_category_code: str | None
    proposed_category_name: str | None
    matched_intent: str | None
    status: str
    eligible: bool
    reason: str | None


class MappingPreviewOut(BaseModel):
    intent: str
    proposed_category_code: str | None
    block_fallback: bool
    affected_count: int
    eligible_count: int
    ineligible_count: int
    would_route_to_review_count: int
    rows: list[MappingPreviewRow]
    warnings: list[str]


@router.post("/preview", response_model=MappingPreviewOut)
def preview_mapping(
    payload: MappingPreviewPayload, db: Session = Depends(get_db)
) -> MappingPreviewOut:
    """Read-only preview of how a mapping change would affect existing
    rows. No mutation happens.

    Ineligible rows (human-corrected, accountant-follow-up, accountant-
    review-required, uncategorizable, correction-memory-categorized)
    are returned with a `reason` so the UI can render them as
    protected.
    """
    intent = payload.intent.strip()
    if not intent:
        raise ValidationFailed("intent is required.")
    if payload.proposed_category_code:
        code = payload.proposed_category_code.strip()
        if code:
            from ledgerlens.models import AccountCategory

            exists = db.query(AccountCategory).filter(AccountCategory.code == code).one_or_none()
            if exists is None:
                raise ValidationFailed(
                    f"Unknown category code '{code}'. Pick a code from the active "
                    "chart of accounts.",
                    code=code,
                )
    # Validate the intent is one the active business knows about.
    rule_map = get_business_rule_map(active_business_id())
    if intent not in rule_map.intent_to_code and intent not in rule_map.block_fallback_intents:
        raise ValidationFailed(f"Unknown intent '{intent}' for the active business.")

    summary = preview_mapping_change(
        db,
        intent=intent,
        proposed_category_code=payload.proposed_category_code,
        block_fallback=payload.block_fallback,
        limit=payload.limit,
    )
    return MappingPreviewOut(
        intent=intent,
        proposed_category_code=payload.proposed_category_code,
        block_fallback=payload.block_fallback,
        affected_count=summary.affected_count,
        eligible_count=summary.eligible_count,
        ineligible_count=summary.ineligible_count,
        would_route_to_review_count=summary.would_route_to_review_count,
        rows=[
            MappingPreviewRow(
                transaction_id=r.transaction_id,
                transaction_date=r.transaction_date,
                description=r.description,
                merchant=r.merchant,
                amount_cents=r.amount_cents,
                current_category_code=r.current_category_code,
                current_category_name=r.current_category_name,
                proposed_category_code=r.proposed_category_code,
                proposed_category_name=r.proposed_category_name,
                matched_intent=r.matched_intent,
                status=r.status,
                eligible=r.eligible,
                reason=r.reason,
            )
            for r in summary.rows
        ],
        warnings=summary.warnings,
    )


__all__ = ["ACTIVE_PROFILE_NAME", "router"]
