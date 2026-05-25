"""Deterministic correction-memory lookup and recording.

When a reviewer corrects a transaction, we capture a `(merchant_key,
description_key) → category` row. Future transactions whose keys match
get categorized from this lookup instead of from the model.

Two match tiers:

1. **Exact** — merchant_key + description_key match verbatim. Highest
   confidence, used since v1.
2. **Fingerprint** — the incoming transaction's normalized merchant
   fingerprint matches the stored memory row's merchant_key after both
   are normalized. Covers noisy bank-description variants (different
   store numbers, trailing dates, ACH prefixes) from the same vendor.
   Blocked for ambiguous vendors (Amazon, Costco, etc.) unless the
   exact path already matched.

Nothing here is statistical. No fuzzy matching, no embeddings, no
training. The fingerprint tier is still deterministic regex-based
normalization, not a learned model.
"""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.orm import Session

from ledgerlens.models import (
    CorrectionMemory,
    ReviewDecision,
    Transaction,
)
from ledgerlens.repositories import (
    CategoryRepo,
    CorrectionMemoryRepo,
)
from ledgerlens.services.vendor_normalization import (
    is_ambiguous_vendor,
    merchant_fingerprint,
)

# Generic merchant tokens that must never anchor a memory match.
# These appear in roughly every other bank-statement description; matching
# on them would let a single Adobe correction reclassify a Stripe payout.
GENERIC_MERCHANT_TOKENS: frozenset[str] = frozenset(
    {
        "PAYMENT",
        "ACH",
        "DEBIT",
        "CREDIT",
        "TRANSFER",
        "CHECK",
        "POS",
        "ONLINE",
        "WEB",
        "PURCHASE",
        "WIRE",
        "BANK",
        "DEPOSIT",
        "WITHDRAWAL",
        "FEE",
        "INTEREST",
        "REFUND",
        "ATM",
    }
)

# A merchant_key shorter than this is treated as too generic to anchor a match.
MIN_MERCHANT_KEY_LEN = 3
# A description_key shorter than this is treated as too generic to anchor a match.
MIN_DESCRIPTION_KEY_LEN = 6


def build_merchant_key(tx: Transaction) -> str:
    """Best-effort merchant identifier for the transaction.

    Priority: `tx.merchant` (already normalized at intake), else the first
    token of `tx.normalized_description`. Uppercased, stripped.
    """
    if tx.merchant:
        return tx.merchant.strip().upper()
    if tx.normalized_description:
        first = tx.normalized_description.strip().split(" ", 1)[0]
        return first.upper()
    return ""


def build_description_key(tx: Transaction) -> str:
    """Normalized description, uppercase. Already produced at intake."""
    return (tx.normalized_description or "").strip().upper()


def _is_safe_anchor(merchant_key: str, description_key: str) -> bool:
    """Reject keys that are too generic or too short to anchor a memory match."""
    if merchant_key:
        if len(merchant_key) < MIN_MERCHANT_KEY_LEN:
            return False
        if merchant_key in GENERIC_MERCHANT_TOKENS:
            return False
        # If the merchant key is purely composed of generic tokens, reject.
        tokens = set(merchant_key.split())
        if tokens and tokens.issubset(GENERIC_MERCHANT_TOKENS):
            return False
        return True
    # No merchant; fall back to the description key.
    return len(description_key) >= MIN_DESCRIPTION_KEY_LEN


# ── Match result ──────────────────────────────────────────────────────────


MatchVerdict = Literal["apply", "conflict", "none"]
MatchType = Literal["exact", "merchant_fingerprint", "none"]


@dataclass
class MemoryMatch:
    verdict: MatchVerdict
    match_type: MatchType
    record: CorrectionMemory | None
    candidates: list[CorrectionMemory]
    merchant_key: str
    description_key: str
    reason: str


def find_memory_match(tx: Transaction, db: Session) -> MemoryMatch:
    """Look for a correction-memory row that applies to this transaction.

    Two-tier lookup:

    **Tier 1 — exact key match** (unchanged from v1):
    Query by raw merchant_key / description_key. If a single-category
    set of hits exists → ``apply``. If disagreeing categories → ``conflict``.

    **Tier 2 — merchant fingerprint match** (new):
    If tier 1 returns ``none``, compute the normalized merchant
    fingerprint for the incoming transaction, then scan existing memory
    rows for the same business whose merchant_key normalizes to the same
    fingerprint. Blocked for ambiguous vendors (Amazon, Costco, etc.)
    to prevent incorrect auto-finalization.

    Returns a `MemoryMatch` with:
    - ``verdict``: apply | conflict | none
    - ``match_type``: exact | merchant_fingerprint | none
    """
    merchant_key = build_merchant_key(tx)
    description_key = build_description_key(tx)

    if not _is_safe_anchor(merchant_key, description_key):
        return MemoryMatch(
            verdict="none",
            match_type="none",
            record=None,
            candidates=[],
            merchant_key=merchant_key,
            description_key=description_key,
            reason="merchant or description key is too generic to be a safe anchor",
        )

    # ── Tier 1: exact key match ──────────────────────────────────────
    repo = CorrectionMemoryRepo(db)
    candidates = repo.find_for_keys(
        merchant_key=merchant_key,
        description_key=description_key,
        business_id=tx.business_id,
    )

    category_repo = CategoryRepo(db)

    if candidates:
        safe = [c for c in candidates if _category_active(c.selected_category_code, category_repo)]
        if safe:
            if merchant_key:
                merchant_hits = [c for c in safe if c.merchant_key == merchant_key]
                if merchant_hits:
                    return _resolve_from_candidates(
                        merchant_hits,
                        merchant_key,
                        description_key,
                        anchor="merchant_key",
                        match_type="exact",
                    )

            description_hits = [c for c in safe if c.description_key == description_key]
            if description_hits:
                return _resolve_from_candidates(
                    description_hits,
                    merchant_key,
                    description_key,
                    anchor="description_key",
                    match_type="exact",
                )

    # ── Tier 2: merchant fingerprint match ───────────────────────────
    # Compute fingerprints from both merchant and description — bank
    # feeds sometimes abbreviate the merchant field, so the description
    # may carry more information.
    tx_desc = tx.normalized_description or tx.description or ""
    tx_fp_merchant = merchant_fingerprint(tx_desc, tx.merchant) if tx.merchant else ""
    tx_fp_desc = merchant_fingerprint(tx_desc, None)
    tx_fingerprints = {fp for fp in (tx_fp_merchant, tx_fp_desc) if len(fp) >= MIN_MERCHANT_KEY_LEN}

    if not tx_fingerprints:
        return MemoryMatch(
            verdict="none",
            match_type="none",
            record=None,
            candidates=candidates or [],
            merchant_key=merchant_key,
            description_key=description_key,
            reason="no exact match and fingerprints are too short",
        )

    # Block ambiguous vendors from fingerprint matching — they need
    # owner context, not a prior correction from a different purchase.
    from ledgerlens.services.vendor_normalization import detect_vendor_family

    for fp in tx_fingerprints:
        vendor = detect_vendor_family(fp)
        if vendor and is_ambiguous_vendor(vendor.family):
            return MemoryMatch(
                verdict="none",
                match_type="none",
                record=None,
                candidates=candidates or [],
                merchant_key=merchant_key,
                description_key=description_key,
                reason=(
                    f"vendor family '{vendor.family}' is ambiguous — "
                    "fingerprint memory blocked; route to review or owner questions"
                ),
            )

    # Scan active memory rows for this business; match any row whose
    # merchant_key or description_key fingerprints overlap with the
    # incoming transaction's fingerprints.
    all_active = repo.list(
        business_id=tx.business_id,
        active=True,
        limit=500,
    )

    fingerprint_hits: list[CorrectionMemory] = []
    for mem in all_active:
        mem_fps = set()
        if mem.merchant_key:
            mem_fps.add(merchant_fingerprint(mem.description_key, mem.merchant_key))
        mem_fps.add(merchant_fingerprint(mem.description_key, None))
        if mem_fps & tx_fingerprints and _category_active(
            mem.selected_category_code, category_repo
        ):
            fingerprint_hits.append(mem)

    if not fingerprint_hits:
        return MemoryMatch(
            verdict="none",
            match_type="none",
            record=None,
            candidates=candidates or [],
            merchant_key=merchant_key,
            description_key=description_key,
            reason="no exact or fingerprint match",
        )

    return _resolve_from_candidates(
        fingerprint_hits,
        merchant_key,
        description_key,
        anchor="merchant_fingerprint",
        match_type="merchant_fingerprint",
    )


def _category_active(code: str, repo: CategoryRepo) -> bool:
    cat = repo.get(code)
    return cat is not None and bool(cat.active)


def _resolve_from_candidates(
    hits: list[CorrectionMemory],
    merchant_key: str,
    description_key: str,
    *,
    anchor: str,
    match_type: MatchType,
) -> MemoryMatch:
    distinct_categories = {c.selected_category_code for c in hits}
    if len(distinct_categories) == 1:
        chosen = sorted(
            hits,
            key=lambda c: (c.last_used_at or c.updated_at, c.match_count),
            reverse=True,
        )[0]
        return MemoryMatch(
            verdict="apply",
            match_type=match_type,
            record=chosen,
            candidates=hits,
            merchant_key=merchant_key,
            description_key=description_key,
            reason=f"matched on {anchor} ({match_type})",
        )
    return MemoryMatch(
        verdict="conflict",
        match_type=match_type,
        record=None,
        candidates=hits,
        merchant_key=merchant_key,
        description_key=description_key,
        reason=(
            f"conflicting memories on {anchor}: {sorted(distinct_categories)} — routing to review"
        ),
    )


# ── Recording ─────────────────────────────────────────────────────────────


def record_correction_memory(
    tx: Transaction,
    review_decision: ReviewDecision,
    db: Session,
) -> CorrectionMemory | None:
    """Persist a correction memory row for a corrective `ReviewDecision`.

    No-op (returns None) when:
    - the review isn't a `correct` action with a selected category,
    - the target category isn't active,
    - the merchant/description keys are too generic to anchor a match.

    If an exact (merchant_key, description_key, category) row already
    exists, its `updated_at` is touched and it is returned. Otherwise
    a new row is inserted.
    """
    selected = review_decision.selected_category_code
    if not selected:
        return None

    category_repo = CategoryRepo(db)
    if not _category_active(selected, category_repo):
        return None

    merchant_key = build_merchant_key(tx)
    description_key = build_description_key(tx)
    if not _is_safe_anchor(merchant_key, description_key):
        return None

    repo = CorrectionMemoryRepo(db)
    existing = repo.find_exact(
        merchant_key=merchant_key,
        description_key=description_key,
        selected_category_code=selected,
        business_id=tx.business_id,
    )
    if existing is not None:
        existing.updated_at = datetime.now(UTC)
        existing.active = True
        db.flush()
        return existing

    memory = CorrectionMemory(
        business_id=tx.business_id,
        merchant_key=merchant_key,
        description_key=description_key,
        selected_category_code=selected,
        source_transaction_id=tx.id,
        source_review_decision_id=review_decision.id,
        match_count=0,
        active=True,
    )
    return repo.add(memory)
