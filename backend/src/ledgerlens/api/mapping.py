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


__all__ = ["ACTIVE_PROFILE_NAME", "router"]
