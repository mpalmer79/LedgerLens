from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import (
    ApproveReview,
    CategorizationOut,
    CorrectReview,
    ReviewDecisionOut,
    ReviewQueueItem,
    ReviewQueueOut,
    TransactionOut,
    UncategorizableReview,
)
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound, ValidationFailed
from ledgerlens.models import (
    CategorizationResult,
    ResultStatus,
    ReviewDecision,
    ReviewerAction,
    Transaction,
)
from ledgerlens.repositories import (
    AuditRepo,
    CategorizationRepo,
    CategoryRepo,
    ReviewRepo,
    TransactionRepo,
)

router = APIRouter(prefix="/review-queue", tags=["review"])


@router.get("", response_model=ReviewQueueOut)
def list_queue(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
) -> ReviewQueueOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    cat_repo = CategorizationRepo(db)
    needs = cat_repo.list_by_status(ResultStatus.NEEDS_REVIEW, limit=limit, offset=offset)

    items: list[ReviewQueueItem] = []
    tx_repo = TransactionRepo(db)
    for result in needs:
        tx = tx_repo.get(result.transaction_id)
        if not tx:
            continue
        items.append(
            ReviewQueueItem(
                transaction=TransactionOut.model_validate(tx),
                latest_result=CategorizationOut.model_validate(result),
            )
        )

    return ReviewQueueOut(total=len(items), items=items)


def _latest_or_404(db: Session, tx_id: str) -> tuple[Transaction, CategorizationResult]:
    tx = TransactionRepo(db).get(tx_id)
    if not tx:
        raise NotFound("transaction", tx_id)
    latest = CategorizationRepo(db).latest_for_transaction(tx_id)
    if not latest:
        raise ValidationFailed("Transaction has no categorization result to review yet")
    return tx, latest


@router.post(
    "/{transaction_id}/approve",
    response_model=ReviewDecisionOut,
    status_code=201,
)
def approve(
    transaction_id: str,
    payload: ApproveReview,
    db: Session = Depends(get_db),
) -> ReviewDecisionOut:
    tx, latest = _latest_or_404(db, transaction_id)
    decision = ReviewDecision(
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.APPROVE,
        selected_category_code=latest.predicted_category_code,
        reviewer_note=payload.reviewer_note,
    )
    ReviewRepo(db).add(decision)
    latest.status = ResultStatus.AUTO_APPROVED
    AuditRepo(db).record(
        entity_type="review_decision",
        action="approve",
        entity_id=decision.id,
        details={
            "transaction_id": tx.id,
            "categorization_result_id": latest.id,
            "category": latest.predicted_category_code,
        },
    )
    db.commit()
    db.refresh(decision)
    return ReviewDecisionOut.model_validate(decision)


@router.post(
    "/{transaction_id}/correct",
    response_model=ReviewDecisionOut,
    status_code=201,
)
def correct(
    transaction_id: str,
    payload: CorrectReview,
    db: Session = Depends(get_db),
) -> ReviewDecisionOut:
    tx, latest = _latest_or_404(db, transaction_id)
    if not CategoryRepo(db).exists(payload.selected_category_code):
        raise ValidationFailed("Unknown category code", code=payload.selected_category_code)
    decision = ReviewDecision(
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.CORRECT,
        selected_category_code=payload.selected_category_code,
        reviewer_note=payload.reviewer_note,
    )
    ReviewRepo(db).add(decision)
    latest.status = ResultStatus.CORRECTED
    AuditRepo(db).record(
        entity_type="review_decision",
        action="correct",
        entity_id=decision.id,
        details={
            "transaction_id": tx.id,
            "categorization_result_id": latest.id,
            "from": latest.predicted_category_code,
            "to": payload.selected_category_code,
        },
    )

    # Capture the correction as a reusable signal for future similar
    # transactions. No-op when the keys are too generic; see services/
    # correction_memory.py for the safety rules.
    from ledgerlens.services.correction_memory import record_correction_memory

    memory = record_correction_memory(tx, decision, db)
    if memory is not None:
        AuditRepo(db).record(
            entity_type="correction_memory",
            action="recorded",
            entity_id=memory.id,
            details={
                "transaction_id": tx.id,
                "review_decision_id": decision.id,
                "merchant_key": memory.merchant_key,
                "description_key": memory.description_key,
                "selected_category_code": memory.selected_category_code,
            },
        )

    db.commit()
    db.refresh(decision)
    return ReviewDecisionOut.model_validate(decision)


@router.post(
    "/{transaction_id}/uncategorizable",
    response_model=ReviewDecisionOut,
    status_code=201,
)
def mark_uncategorizable(
    transaction_id: str,
    payload: UncategorizableReview,
    db: Session = Depends(get_db),
) -> ReviewDecisionOut:
    tx, latest = _latest_or_404(db, transaction_id)
    decision = ReviewDecision(
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.MARK_UNCATEGORIZABLE,
        selected_category_code=None,
        reviewer_note=payload.reviewer_note,
    )
    ReviewRepo(db).add(decision)
    latest.status = ResultStatus.UNCATEGORIZABLE
    AuditRepo(db).record(
        entity_type="review_decision",
        action="mark_uncategorizable",
        entity_id=decision.id,
        details={
            "transaction_id": tx.id,
            "categorization_result_id": latest.id,
        },
    )
    db.commit()
    db.refresh(decision)
    return ReviewDecisionOut.model_validate(decision)
