"""Read-only preview of a mapping change's impact on existing rows.

The preview never writes. It walks existing transactions, identifies
the ones the rule layer matched against the supplied intent, and
labels each one as **eligible** or **ineligible** for re-applying
the proposed mapping. Ineligible rows include human corrections,
accountant-follow-up rows, ACCOUNTANT_REVIEW_REQUIRED, and
UNCATEGORIZABLE — categories the v1 preview explicitly protects.

See `docs/MAPPING_RECATEGORIZATION_PREVIEW_AUDIT.md`.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from ledgerlens.data.business_rule_maps import active_business_id
from ledgerlens.models import (
    AccountCategory,
    CategorizationResult,
    ResultStatus,
    ReviewDecision,
    ReviewerAction,
    Transaction,
)
from ledgerlens.services.rule_categorizer import find_rule_match


@dataclass(frozen=True)
class PreviewRow:
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


@dataclass(frozen=True)
class PreviewSummary:
    affected_count: int
    eligible_count: int
    ineligible_count: int
    would_route_to_review_count: int
    rows: list[PreviewRow]
    warnings: list[str]


def _category_name(db: Session, code: str | None) -> str | None:
    if not code:
        return None
    cat = db.query(AccountCategory).filter(AccountCategory.code == code).one_or_none()
    return cat.name if cat else None


def _latest_review(db: Session, transaction_id: str) -> ReviewDecision | None:
    return (
        db.query(ReviewDecision)
        .filter(ReviewDecision.transaction_id == transaction_id)
        .order_by(ReviewDecision.created_at.desc())
        .first()
    )


def _ineligibility_reason(
    latest: CategorizationResult, review: ReviewDecision | None
) -> str | None:
    """Return None when the row is eligible, else a plain-English reason."""
    if latest.status == ResultStatus.ACCOUNTANT_REVIEW_REQUIRED:
        return "accountant-review-required rows are protected"
    if latest.status == ResultStatus.UNCATEGORIZABLE:
        return "row was excluded from books"
    if latest.model_provider == "correction_memory":
        return "category came from correction memory (encodes a previous human decision)"
    if review is None:
        # Eligible only if the row was categorized by the rule layer.
        if latest.model_provider != "rule_categorizer":
            return "row was not categorized by a deterministic rule"
        return None
    # A review decision exists — apply the safety rules.
    if review.accountant_follow_up_required:
        return "row is flagged for accountant follow-up"
    if review.reviewer_action == ReviewerAction.CORRECT:
        return "row was human-corrected; explicit decision protected"
    if review.reviewer_action == ReviewerAction.MARK_FOR_ACCOUNTANT_REVIEW:
        return "row was marked for accountant review"
    if review.reviewer_action == ReviewerAction.MARK_UNCATEGORIZABLE:
        return "row was marked uncategorizable"
    # APPROVE without follow-up flag is allowed: it accepted a
    # rule-mapped category that the new mapping should be able to
    # re-apply.
    return None


def preview_mapping_change(
    db: Session,
    *,
    intent: str,
    proposed_category_code: str | None,
    block_fallback: bool,
    business_id: str | None = None,
    limit: int = 200,
) -> PreviewSummary:
    """Walk transactions; return eligibility + proposed code per row.

    The preview never mutates. It runs the existing `find_rule_match`
    on each transaction (cheap — pure-Python regex match) to identify
    which rows the rule layer would attach to the supplied intent.
    """
    # Resolve the business id (no per-row use today, but the
    # callers pass it for the future-tenanted code path).
    _ = business_id or active_business_id()
    warnings = [
        "Nothing has been changed yet — this is a preview only.",
        "Human-corrected and accountant-follow-up rows are protected.",
        "Mapping edits affect future categorization immediately; "
        "updating current rows requires explicit review.",
    ]

    proposed_name = _category_name(db, proposed_category_code)

    transactions = db.query(Transaction).order_by(Transaction.transaction_date.desc()).all()
    rows: list[PreviewRow] = []
    would_route_to_review = 0

    for tx in transactions:
        # Cheap intent match — pure Python; no DB writes.
        match = find_rule_match(tx, db)
        if match.verdict != "apply" or match.rule is None or match.rule.intent != intent:
            continue
        latest = (
            db.query(CategorizationResult)
            .filter(CategorizationResult.transaction_id == tx.id)
            .order_by(CategorizationResult.created_at.desc())
            .first()
        )
        if latest is None:
            continue
        review = _latest_review(db, tx.id)
        reason = _ineligibility_reason(latest, review)
        # Current code: prefer the review's selected code (CORRECT path)
        # else the result's predicted code.
        current_code = (
            review.selected_category_code
            if review and review.selected_category_code
            else latest.predicted_category_code
        )
        # Proposed code: block_fallback → None; else proposed_category_code
        # if supplied, else fall back to rule's own code.
        if block_fallback:
            proposed_code: str | None = None
        elif proposed_category_code:
            proposed_code = proposed_category_code
        else:
            proposed_code = match.rule.category_code
        proposed_code_name = (
            proposed_name
            if proposed_code == proposed_category_code
            else _category_name(db, proposed_code)
        )
        eligible = reason is None
        if eligible and block_fallback:
            would_route_to_review += 1
        rows.append(
            PreviewRow(
                transaction_id=tx.id,
                transaction_date=tx.transaction_date.isoformat(),
                description=tx.description,
                merchant=tx.merchant,
                amount_cents=tx.amount_cents,
                current_category_code=current_code,
                current_category_name=_category_name(db, current_code),
                proposed_category_code=proposed_code,
                proposed_category_name=proposed_code_name,
                matched_intent=intent,
                status=latest.status.value,
                eligible=eligible,
                reason=reason,
            )
        )
        if len(rows) >= limit:
            break

    eligible_count = sum(1 for r in rows if r.eligible)
    return PreviewSummary(
        affected_count=len(rows),
        eligible_count=eligible_count,
        ineligible_count=len(rows) - eligible_count,
        would_route_to_review_count=would_route_to_review,
        rows=rows,
        warnings=warnings,
    )
