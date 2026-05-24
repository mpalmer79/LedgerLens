from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.api.schemas import (
    CorrectionMemoryListOut,
    CorrectionMemoryOut,
    CorrectionMemoryPatch,
    MemoryMatchOut,
)
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound, ValidationFailed
from ledgerlens.repositories import (
    AuditRepo,
    CategoryRepo,
    CorrectionMemoryRepo,
    TransactionRepo,
)
from ledgerlens.services.correction_memory import find_memory_match

router = APIRouter(prefix="/corrections", tags=["corrections"])


@router.get("", response_model=CorrectionMemoryListOut)
def list_corrections(
    active: bool | None = None,
    category_code: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CorrectionMemoryListOut:
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    repo = CorrectionMemoryRepo(db)
    items = repo.list(
        business_id=actor.business_id,
        active=active,
        category_code=category_code,
        q=q,
        limit=limit,
        offset=offset,
    )
    return CorrectionMemoryListOut(
        total=repo.count(business_id=actor.business_id, active=active),
        items=[CorrectionMemoryOut.model_validate(i) for i in items],
    )


@router.get("/{memory_id}", response_model=CorrectionMemoryOut)
def get_correction(
    memory_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CorrectionMemoryOut:
    memory = CorrectionMemoryRepo(db).get_for_business(memory_id, actor.business_id)
    if not memory:
        raise NotFound("correction_memory", memory_id)
    return CorrectionMemoryOut.model_validate(memory)


@router.patch("/{memory_id}", response_model=CorrectionMemoryOut)
def patch_correction(
    memory_id: str,
    payload: CorrectionMemoryPatch,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CorrectionMemoryOut:
    memory = CorrectionMemoryRepo(db).get_for_business(memory_id, actor.business_id)
    if not memory:
        raise NotFound("correction_memory", memory_id)

    changes: dict[str, object] = {}
    if payload.active is not None and payload.active != memory.active:
        memory.active = payload.active
        changes["active"] = payload.active
    if payload.selected_category_code is not None:
        if not CategoryRepo(db).exists(payload.selected_category_code):
            raise ValidationFailed("Unknown category code", code=payload.selected_category_code)
        if payload.selected_category_code != memory.selected_category_code:
            changes["selected_category_code"] = {
                "from": memory.selected_category_code,
                "to": payload.selected_category_code,
            }
            memory.selected_category_code = payload.selected_category_code
    if payload.notes is not None:
        memory.notes = payload.notes
        changes["notes_updated"] = True

    if changes:
        AuditRepo(db).record(
            entity_type="correction_memory",
            action="updated",
            entity_id=memory.id,
            details=changes,
        )
    db.commit()
    db.refresh(memory)
    return CorrectionMemoryOut.model_validate(memory)


@router.delete("/{memory_id}", response_model=CorrectionMemoryOut)
def deactivate_correction(
    memory_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CorrectionMemoryOut:
    """Soft-deactivate. Audit trail and source references are preserved."""
    memory = CorrectionMemoryRepo(db).get_for_business(memory_id, actor.business_id)
    if not memory:
        raise NotFound("correction_memory", memory_id)
    if memory.active:
        memory.active = False
        AuditRepo(db).record(
            entity_type="correction_memory",
            action="deactivated",
            entity_id=memory.id,
            details={"merchant_key": memory.merchant_key},
        )
    db.commit()
    db.refresh(memory)
    return CorrectionMemoryOut.model_validate(memory)


# Mounted via the transactions router prefix for symmetry; defined here to keep
# correction-memory concerns local.
memory_match_router = APIRouter(tags=["corrections"])


@memory_match_router.get(
    "/transactions/{transaction_id}/memory-matches", response_model=MemoryMatchOut
)
def get_memory_matches(
    transaction_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> MemoryMatchOut:
    tx = TransactionRepo(db).get_for_business(transaction_id, actor.business_id)
    if not tx:
        raise NotFound("transaction", transaction_id)
    match = find_memory_match(tx, db)
    return MemoryMatchOut(
        verdict=match.verdict,
        reason=match.reason,
        merchant_key=match.merchant_key,
        description_key=match.description_key,
        record=(CorrectionMemoryOut.model_validate(match.record) if match.record else None),
        candidates=[CorrectionMemoryOut.model_validate(c) for c in match.candidates],
    )
