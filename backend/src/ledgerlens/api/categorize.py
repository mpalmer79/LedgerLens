from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import (
    CategorizationOut,
    CategorizeBatchOut,
    CategorizeBatchRequest,
    CategorizeRequest,
)
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound
from ledgerlens.models import ResultStatus
from ledgerlens.repositories import CategorizationRepo, TransactionRepo
from ledgerlens.services.categorize import categorize_transaction

router = APIRouter(tags=["categorize"])


@router.post("/categorize", response_model=CategorizationOut, status_code=201)
def categorize(payload: CategorizeRequest, db: Session = Depends(get_db)) -> CategorizationOut:
    tx = TransactionRepo(db).get(payload.transaction_id)
    if not tx:
        raise NotFound("transaction", payload.transaction_id)
    result = categorize_transaction(tx, db)
    db.commit()
    db.refresh(result)
    return CategorizationOut.model_validate(result)


@router.post("/categorize/batch", response_model=CategorizeBatchOut, status_code=201)
def categorize_batch(
    payload: CategorizeBatchRequest, db: Session = Depends(get_db)
) -> CategorizeBatchOut:
    # Each call into `categorize_transaction` builds the model categorizer
    # lazily only when memory + rules fail to decide. Construction is cheap
    # (just an SDK client init); the network cost is the per-call API request.
    tx_repo = TransactionRepo(db)
    results = []
    counts = {
        ResultStatus.AUTO_APPROVED: 0,
        ResultStatus.NEEDS_REVIEW: 0,
        ResultStatus.UNCATEGORIZABLE: 0,
        ResultStatus.FAILED: 0,
    }
    total_cost = 0.0
    zero_cost = 0

    for tx_id in payload.transaction_ids:
        tx = tx_repo.get(tx_id)
        if not tx:
            continue
        result = categorize_transaction(tx, db)
        results.append(result)
        if result.status in counts:
            counts[result.status] += 1
        total_cost += float(result.estimated_cost_usd)
        if result.estimated_cost_usd == 0:
            zero_cost += 1

    db.commit()
    for r in results:
        db.refresh(r)

    return CategorizeBatchOut(
        total=len(results),
        auto_approved=counts[ResultStatus.AUTO_APPROVED],
        needs_review=counts[ResultStatus.NEEDS_REVIEW],
        uncategorizable=counts[ResultStatus.UNCATEGORIZABLE],
        failed=counts[ResultStatus.FAILED],
        zero_cost=zero_cost,
        total_cost_usd=round(total_cost, 6),
        results=[CategorizationOut.model_validate(r) for r in results],
    )


@router.get("/categorization-results/{result_id}", response_model=CategorizationOut)
def get_result(result_id: str, db: Session = Depends(get_db)) -> CategorizationOut:
    result = CategorizationRepo(db).get(result_id)
    if not result:
        raise NotFound("categorization_result", result_id)
    return CategorizationOut.model_validate(result)


@router.get(
    "/transactions/{transaction_id}/categorization-results",
    response_model=list[CategorizationOut],
    tags=["categorize"],
)
def list_for_transaction(
    transaction_id: str, db: Session = Depends(get_db)
) -> list[CategorizationOut]:
    if not TransactionRepo(db).get(transaction_id):
        raise NotFound("transaction", transaction_id)
    return [
        CategorizationOut.model_validate(r)
        for r in CategorizationRepo(db).list_for_transaction(transaction_id)
    ]
