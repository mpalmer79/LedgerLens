"""Deterministic correction-memory lookup and recording.

When a reviewer corrects a transaction, we capture a `(merchant_key,
description_key) → category` row. Future transactions whose keys match
get categorized from this lookup instead of from the model.

Nothing here is statistical. No fuzzy matching, no embeddings, no
training. The intent is exactly that: a rule lookup whose rules are
written by humans, one correction at a time.
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


@dataclass
class MemoryMatch:
    verdict: MatchVerdict
    record: CorrectionMemory | None
    candidates: list[CorrectionMemory]
    merchant_key: str
    description_key: str
    reason: str


def find_memory_match(tx: Transaction, db: Session) -> MemoryMatch:
    """Look for a correction-memory row that applies to this transaction.

    Returns a `MemoryMatch` with a verdict:

    - `apply` — one or more matching rows agree on the same category;
      use that category.
    - `conflict` — matches exist but disagree on the category; caller
      should route the transaction to review rather than auto-applying.
    - `none` — no safe match exists.

    Inactive memory rows are filtered at the repo. Inactive categories
    are filtered here.
    """
    merchant_key = build_merchant_key(tx)
    description_key = build_description_key(tx)

    if not _is_safe_anchor(merchant_key, description_key):
        return MemoryMatch(
            verdict="none",
            record=None,
            candidates=[],
            merchant_key=merchant_key,
            description_key=description_key,
            reason="merchant or description key is too generic to be a safe anchor",
        )

    repo = CorrectionMemoryRepo(db)
    candidates = repo.find_for_keys(merchant_key=merchant_key, description_key=description_key)
    if not candidates:
        return MemoryMatch(
            verdict="none",
            record=None,
            candidates=[],
            merchant_key=merchant_key,
            description_key=description_key,
            reason="no memory rows match",
        )

    # Filter out memory whose target category is inactive.
    category_repo = CategoryRepo(db)
    safe = [c for c in candidates if _category_active(c.selected_category_code, category_repo)]
    if not safe:
        return MemoryMatch(
            verdict="none",
            record=None,
            candidates=candidates,
            merchant_key=merchant_key,
            description_key=description_key,
            reason="all matching memory rows target inactive categories",
        )

    # Prefer merchant-key matches over description-key matches when both exist.
    if merchant_key:
        merchant_hits = [c for c in safe if c.merchant_key == merchant_key]
        if merchant_hits:
            return _resolve_from_candidates(
                merchant_hits, merchant_key, description_key, anchor="merchant_key"
            )

    description_hits = [c for c in safe if c.description_key == description_key]
    if description_hits:
        return _resolve_from_candidates(
            description_hits, merchant_key, description_key, anchor="description_key"
        )

    return MemoryMatch(
        verdict="none",
        record=None,
        candidates=safe,
        merchant_key=merchant_key,
        description_key=description_key,
        reason="matches exist but none anchored on a safe key",
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
) -> MemoryMatch:
    distinct_categories = {c.selected_category_code for c in hits}
    if len(distinct_categories) == 1:
        # Prefer the most recently used row, then most recently updated.
        chosen = sorted(
            hits,
            key=lambda c: (c.last_used_at or c.updated_at, c.match_count),
            reverse=True,
        )[0]
        return MemoryMatch(
            verdict="apply",
            record=chosen,
            candidates=hits,
            merchant_key=merchant_key,
            description_key=description_key,
            reason=f"matched on {anchor}",
        )
    return MemoryMatch(
        verdict="conflict",
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
    )
    if existing is not None:
        existing.updated_at = datetime.now(UTC)
        existing.active = True
        db.flush()
        return existing

    memory = CorrectionMemory(
        merchant_key=merchant_key,
        description_key=description_key,
        selected_category_code=selected,
        source_transaction_id=tx.id,
        source_review_decision_id=review_decision.id,
        match_count=0,
        active=True,
    )
    return repo.add(memory)
