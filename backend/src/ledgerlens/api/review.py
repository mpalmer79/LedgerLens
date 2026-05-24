from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.api.schemas import (
    AccountantReviewRequest,
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
    actor: DemoActor = Depends(get_demo_actor),
) -> ReviewQueueOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    cat_repo = CategorizationRepo(db)
    needs = cat_repo.list_by_status(
        ResultStatus.NEEDS_REVIEW,
        business_id=actor.business_id,
        limit=limit,
        offset=offset,
    )

    items: list[ReviewQueueItem] = []
    tx_repo = TransactionRepo(db)
    for result in needs:
        tx = tx_repo.get_for_business(result.transaction_id, actor.business_id)
        if not tx:
            continue
        items.append(
            ReviewQueueItem(
                transaction=TransactionOut.model_validate(tx),
                latest_result=CategorizationOut.model_validate(result),
            )
        )

    return ReviewQueueOut(total=len(items), items=items)


def _latest_or_404(
    db: Session, tx_id: str, business_id: str | None
) -> tuple[Transaction, CategorizationResult]:
    tx = TransactionRepo(db).get_for_business(tx_id, business_id)
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
    actor: DemoActor = Depends(get_demo_actor),
) -> ReviewDecisionOut:
    tx, latest = _latest_or_404(db, transaction_id, actor.business_id)
    # Safety backstop: an answer flagged for accountant follow-up must not
    # silently finalize the predicted category. The /questions UI should
    # route such answers to the accountant-review endpoint instead. This
    # 422 keeps the trust boundary intact even if the frontend regresses.
    if payload.accountant_follow_up_required:
        raise ValidationFailed(
            "Accountant-follow-up answers cannot approve a predicted category. "
            "Use POST /review-queue/{transaction_id}/accountant-review instead."
        )
    decision = ReviewDecision(
        business_id=tx.business_id,
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.APPROVE,
        selected_category_code=latest.predicted_category_code,
        reviewer_note=payload.reviewer_note,
        owner_question_key=payload.owner_question_key,
        owner_question_text=payload.owner_question_text,
        owner_answer_label=payload.owner_answer_label,
        owner_note=payload.owner_note,
        suggested_resolution=payload.suggested_resolution,
        accountant_follow_up_required=payload.accountant_follow_up_required,
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
    actor: DemoActor = Depends(get_demo_actor),
) -> ReviewDecisionOut:
    tx, latest = _latest_or_404(db, transaction_id, actor.business_id)
    if not CategoryRepo(db).exists(payload.selected_category_code):
        raise ValidationFailed("Unknown category code", code=payload.selected_category_code)
    decision = ReviewDecision(
        business_id=tx.business_id,
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.CORRECT,
        selected_category_code=payload.selected_category_code,
        reviewer_note=payload.reviewer_note,
        owner_question_key=payload.owner_question_key,
        owner_question_text=payload.owner_question_text,
        owner_answer_label=payload.owner_answer_label,
        owner_note=payload.owner_note,
        suggested_resolution=payload.suggested_resolution,
        accountant_follow_up_required=payload.accountant_follow_up_required,
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
    actor: DemoActor = Depends(get_demo_actor),
) -> ReviewDecisionOut:
    tx, latest = _latest_or_404(db, transaction_id, actor.business_id)
    decision = ReviewDecision(
        business_id=tx.business_id,
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.MARK_UNCATEGORIZABLE,
        selected_category_code=None,
        reviewer_note=payload.reviewer_note,
        owner_question_key=payload.owner_question_key,
        owner_question_text=payload.owner_question_text,
        owner_answer_label=payload.owner_answer_label,
        owner_note=payload.owner_note,
        suggested_resolution=payload.suggested_resolution,
        accountant_follow_up_required=payload.accountant_follow_up_required,
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


@router.post(
    "/{transaction_id}/accountant-review",
    response_model=ReviewDecisionOut,
    status_code=201,
)
def mark_for_accountant_review(
    transaction_id: str,
    payload: AccountantReviewRequest,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> ReviewDecisionOut:
    """Defer a row to an accountant.

    The categorization result transitions to ACCOUNTANT_REVIEW_REQUIRED.
    No predicted category is adopted. The row will not appear in the
    handoff's `ready_for_accountant` section; it will appear in the
    accountant-review follow-up section with the owner's question +
    answer label inline.
    """
    tx, latest = _latest_or_404(db, transaction_id, actor.business_id)
    decision = ReviewDecision(
        business_id=tx.business_id,
        transaction_id=tx.id,
        categorization_result_id=latest.id,
        reviewer_action=ReviewerAction.MARK_FOR_ACCOUNTANT_REVIEW,
        selected_category_code=None,
        reviewer_note=payload.reviewer_note,
        owner_question_key=payload.owner_question_key,
        owner_question_text=payload.owner_question_text,
        owner_answer_label=payload.owner_answer_label,
        owner_note=payload.owner_note,
        suggested_resolution=payload.suggested_resolution,
        # Force True — this path means "needs accountant follow-up" by
        # definition, regardless of the inbound payload value.
        accountant_follow_up_required=True,
    )
    ReviewRepo(db).add(decision)
    latest.status = ResultStatus.ACCOUNTANT_REVIEW_REQUIRED
    AuditRepo(db).record(
        entity_type="review_decision",
        action="mark_for_accountant_review",
        entity_id=decision.id,
        details={
            "transaction_id": tx.id,
            "categorization_result_id": latest.id,
        },
    )
    db.commit()
    db.refresh(decision)
    return ReviewDecisionOut.model_validate(decision)
