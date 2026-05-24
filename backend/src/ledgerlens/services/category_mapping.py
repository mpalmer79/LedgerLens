"""Persistent category-mapping service.

Wires the `CategoryMappingProfile` / `CategoryMappingEntry` tables
(introduced in Auth/Tenant Phase 1) into the live categorization
path. The Python registry in `data.business_rule_maps` stays in
place as the read-only baseline; this service:

1. Seeds an active profile per business from the Python map on
   first read.
2. Lets the owner edit individual intents (`category_code`,
   `block_fallback`, `notes`).
3. Resolves an intent at categorize time with the new precedence:
   persistent profile > Python registry > rule's own fallback.
4. Honors `block_fallback`: a matching transaction is routed to
   review instead of auto-approving when the resolved code is None.

Resolution stays a *pure function* of inputs + a single Session, so
the rule categorizer can stay unaware of the database aside from the
session it already accepts.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ledgerlens.data.business_rule_maps import (
    active_business_id,
    get_business_rule_map,
)
from ledgerlens.models import (
    AccountCategory,
    CategoryMappingEntry,
    CategoryMappingProfile,
)

ACTIVE_PROFILE_NAME = "active"


# ── Public read view ────────────────────────────────────────────────────


@dataclass(frozen=True)
class MappingResolution:
    """Outcome of resolving an intent at categorize time."""

    # The category code to apply. None means "do not auto-categorize."
    code: str | None
    # True iff the resolver decided this row should go to review
    # because the owner explicitly blocked fallback for the intent.
    block_fallback: bool
    # Where the code came from. For audit/debugging.
    source: str  # "profile" | "registry" | "rule_fallback"


# ── Seeding + read path ─────────────────────────────────────────────────


def _ensure_active_profile(db: Session, business_id: str) -> CategoryMappingProfile:
    """Return the active profile for a business, creating it from the
    Python registry on first read. Idempotent."""
    profile = (
        db.query(CategoryMappingProfile)
        .filter(
            CategoryMappingProfile.business_id == business_id,
            CategoryMappingProfile.is_active.is_(True),
        )
        .one_or_none()
    )
    if profile is not None:
        return profile
    profile = CategoryMappingProfile(
        business_id=business_id,
        name=ACTIVE_PROFILE_NAME,
        is_active=True,
        source="seed",
    )
    db.add(profile)
    db.flush()

    rule_map = get_business_rule_map(business_id)
    cat_lookup: dict[str, str] = {
        c.code: c.name for c in db.query(AccountCategory).filter(AccountCategory.active).all()
    }
    for intent, code in rule_map.intent_to_code.items():
        db.add(
            CategoryMappingEntry(
                profile_id=profile.id,
                intent=intent,
                category_code=code,
                category_name=cat_lookup.get(code),
                block_fallback=False,
                notes=None,
            )
        )
    # Seed block-fallback markers that have no explicit mapped code.
    for intent in rule_map.block_fallback_intents - set(rule_map.intent_to_code.keys()):
        db.add(
            CategoryMappingEntry(
                profile_id=profile.id,
                intent=intent,
                category_code=None,
                category_name=None,
                block_fallback=True,
                notes="seeded as block-fallback by the business rule map",
            )
        )
    db.commit()
    db.refresh(profile)
    return profile


def get_active_profile_with_entries(
    db: Session,
    business_id: str | None = None,
) -> tuple[CategoryMappingProfile, list[CategoryMappingEntry]]:
    """Return the active profile + its entries for a business."""
    bid = business_id or active_business_id()
    profile = _ensure_active_profile(db, bid)
    entries = (
        db.query(CategoryMappingEntry)
        .filter(CategoryMappingEntry.profile_id == profile.id)
        .order_by(CategoryMappingEntry.intent)
        .all()
    )
    return profile, entries


def list_known_intents(business_id: str | None = None) -> list[str]:
    """Every intent that ever appears in any registry map for the business.

    The UI uses this to render "missing" intents the owner hasn't
    decided on yet.
    """
    bid = business_id or active_business_id()
    return sorted(get_business_rule_map(bid).intent_to_code.keys())


# ── Write path ─────────────────────────────────────────────────────────


class UnknownIntentError(ValueError):
    pass


class UnknownCategoryCodeError(ValueError):
    pass


def _coa_codes(db: Session) -> set[str]:
    return {c.code for c in db.query(AccountCategory).all()}


def _validate_intent(intent: str, business_id: str) -> None:
    """Intents must be either a registry intent or already saved on the
    profile. Rejects random strings to avoid littering the table with
    typos."""
    rule_map = get_business_rule_map(business_id)
    if intent in rule_map.intent_to_code or intent in rule_map.block_fallback_intents:
        return
    raise UnknownIntentError(f"Unknown intent '{intent}' for business '{business_id}'.")


def update_entry(
    db: Session,
    *,
    intent: str,
    category_code: str | None,
    block_fallback: bool,
    notes: str | None = None,
    business_id: str | None = None,
) -> CategoryMappingEntry:
    """Idempotent upsert of a single entry on the active profile.

    Raises:
        UnknownIntentError: the intent is not registered for this
            business.
        UnknownCategoryCodeError: a non-null code is not in the COA.
    """
    bid = business_id or active_business_id()
    _validate_intent(intent, bid)

    if category_code is not None:
        if category_code not in _coa_codes(db):
            raise UnknownCategoryCodeError(
                f"Unknown category code '{category_code}'. Pick a code from the active "
                "chart of accounts."
            )

    profile = _ensure_active_profile(db, bid)
    entry = (
        db.query(CategoryMappingEntry)
        .filter(
            CategoryMappingEntry.profile_id == profile.id,
            CategoryMappingEntry.intent == intent,
        )
        .one_or_none()
    )
    cat_name: str | None = None
    if category_code is not None:
        cat = db.query(AccountCategory).filter(AccountCategory.code == category_code).one_or_none()
        cat_name = cat.name if cat else None
    if entry is None:
        entry = CategoryMappingEntry(
            profile_id=profile.id,
            intent=intent,
            category_code=category_code,
            category_name=cat_name,
            block_fallback=block_fallback,
            notes=notes,
        )
        db.add(entry)
    else:
        entry.category_code = category_code
        entry.category_name = cat_name
        entry.block_fallback = block_fallback
        entry.notes = notes
    # Any user edit transitions the profile to source="user" so a
    # later reset is unambiguous.
    profile.source = "user"
    db.commit()
    db.refresh(entry)
    return entry


def reset_to_seed(
    db: Session,
    business_id: str | None = None,
) -> CategoryMappingProfile:
    """Wipe the active profile and re-seed it from the Python registry."""
    bid = business_id or active_business_id()
    profile = _ensure_active_profile(db, bid)
    # Delete entries; rebuild from the registry.
    db.query(CategoryMappingEntry).filter(CategoryMappingEntry.profile_id == profile.id).delete()
    db.flush()

    rule_map = get_business_rule_map(bid)
    cat_lookup: dict[str, str] = {
        c.code: c.name for c in db.query(AccountCategory).filter(AccountCategory.active).all()
    }
    for intent, code in rule_map.intent_to_code.items():
        db.add(
            CategoryMappingEntry(
                profile_id=profile.id,
                intent=intent,
                category_code=code,
                category_name=cat_lookup.get(code),
                block_fallback=False,
            )
        )
    for intent in rule_map.block_fallback_intents - set(rule_map.intent_to_code.keys()):
        db.add(
            CategoryMappingEntry(
                profile_id=profile.id,
                intent=intent,
                category_code=None,
                category_name=None,
                block_fallback=True,
            )
        )
    profile.source = "seed"
    db.commit()
    db.refresh(profile)
    return profile


# ── Resolution path used by the rule categorizer ──────────────────────


def resolve(
    db: Session,
    intent: str | None,
    *,
    fallback_code: str,
    business_id: str | None = None,
) -> MappingResolution:
    """Resolve an intent into a final category code.

    Precedence:
      1. Active persistent profile entry (if present).
         - `block_fallback=True` → return (None, block_fallback=True).
         - `category_code != None` → return that code.
         - `category_code == None` → fall through to (2).
      2. Python registry → return that code.
      3. Rule's own fallback_code.
    """
    if not intent:
        return MappingResolution(code=fallback_code, block_fallback=False, source="rule_fallback")
    bid = business_id or active_business_id()

    # (1) persistent profile entry, if present
    profile = (
        db.query(CategoryMappingProfile)
        .filter(
            CategoryMappingProfile.business_id == bid,
            CategoryMappingProfile.is_active.is_(True),
        )
        .one_or_none()
    )
    if profile is not None:
        entry = (
            db.query(CategoryMappingEntry)
            .filter(
                CategoryMappingEntry.profile_id == profile.id,
                CategoryMappingEntry.intent == intent,
            )
            .one_or_none()
        )
        if entry is not None:
            if entry.block_fallback:
                return MappingResolution(code=None, block_fallback=True, source="profile")
            if entry.category_code:
                return MappingResolution(
                    code=entry.category_code, block_fallback=False, source="profile"
                )
            # category_code is None and block_fallback is False —
            # treat as "unset", fall through to the registry.

    # (2) Python registry
    registry_code = get_business_rule_map(bid).resolve(intent)
    if registry_code:
        return MappingResolution(code=registry_code, block_fallback=False, source="registry")

    # The registry says fallback is blocked for this intent.
    if get_business_rule_map(bid).is_fallback_blocked(intent):
        return MappingResolution(code=None, block_fallback=True, source="registry")

    # (3) rule's own fallback
    return MappingResolution(code=fallback_code, block_fallback=False, source="rule_fallback")


# ── Snapshot helpers for /mapping read API ────────────────────────────


@dataclass(frozen=True)
class MappingEntryView:
    intent: str
    category_code: str | None
    category_name: str | None
    block_fallback: bool
    notes: str | None
    status: str  # "mapped" | "unmapped" | "fallback_blocked"


def _entry_status(entry: CategoryMappingEntry) -> str:
    if entry.block_fallback:
        return "fallback_blocked"
    if entry.category_code:
        return "mapped"
    return "unmapped"


def build_entry_views(entries: Iterable[CategoryMappingEntry]) -> list[MappingEntryView]:
    return [
        MappingEntryView(
            intent=e.intent,
            category_code=e.category_code,
            category_name=e.category_name,
            block_fallback=bool(e.block_fallback),
            notes=e.notes,
            status=_entry_status(e),
        )
        for e in entries
    ]
