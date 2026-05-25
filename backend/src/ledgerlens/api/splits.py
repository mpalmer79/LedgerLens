"""Transaction split-line endpoints.

Lets an owner or reviewer split a single bank transaction across
multiple categories for the accountant handoff. This is reviewed-
categorization splitting, not double-entry accounting.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.db import get_db
from ledgerlens.repositories import AuditRepo
from ledgerlens.services.transaction_splits import (
    SplitLineInput,
    delete_splits,
    list_splits,
    replace_splits,
    validate_split_total,
)

router = APIRouter(tags=["splits"])


class SplitLineIn(BaseModel):
    amount_cents: int
    category_code: str | None = None
    note: str | None = Field(default=None, max_length=512)


class SplitLineOut(BaseModel):
    id: str
    transaction_id: str
    line_index: int
    amount_cents: int
    category_code: str | None
    category_name: str | None
    note: str | None
    source: str

    model_config = {"from_attributes": True}


class SplitReplace(BaseModel):
    lines: list[SplitLineIn] = Field(min_length=1, max_length=50)


class SplitValidationOut(BaseModel):
    transaction_amount_cents: int
    split_total_cents: int
    is_complete: bool
    remainder_cents: int
    line_count: int


class SplitListOut(BaseModel):
    lines: list[SplitLineOut]
    validation: SplitValidationOut


@router.get(
    "/transactions/{transaction_id}/splits",
    response_model=SplitListOut,
)
def get_splits(
    transaction_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> SplitListOut:
    lines = list_splits(db, transaction_id=transaction_id, business_id=actor.business_id)
    val = validate_split_total(db, transaction_id=transaction_id, business_id=actor.business_id)
    return SplitListOut(
        lines=[SplitLineOut.model_validate(line) for line in lines],
        validation=SplitValidationOut(
            transaction_amount_cents=val.transaction_amount_cents,
            split_total_cents=val.split_total_cents,
            is_complete=val.is_complete,
            remainder_cents=val.remainder_cents,
            line_count=val.line_count,
        ),
    )


@router.put(
    "/transactions/{transaction_id}/splits",
    response_model=SplitListOut,
    status_code=200,
)
def put_splits(
    transaction_id: str,
    payload: SplitReplace,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> SplitListOut:
    inputs = [
        SplitLineInput(
            amount_cents=line.amount_cents,
            category_code=line.category_code,
            note=line.note,
        )
        for line in payload.lines
    ]
    lines = replace_splits(
        db,
        transaction_id=transaction_id,
        business_id=actor.business_id,
        lines=inputs,
    )
    AuditRepo(db).record(
        entity_type="transaction_split",
        action="replaced",
        entity_id=transaction_id,
        details={
            "line_count": len(lines),
            "total_cents": sum(line.amount_cents for line in lines),
        },
    )
    db.commit()
    val = validate_split_total(db, transaction_id=transaction_id, business_id=actor.business_id)
    return SplitListOut(
        lines=[SplitLineOut.model_validate(line) for line in lines],
        validation=SplitValidationOut(
            transaction_amount_cents=val.transaction_amount_cents,
            split_total_cents=val.split_total_cents,
            is_complete=val.is_complete,
            remainder_cents=val.remainder_cents,
            line_count=val.line_count,
        ),
    )


@router.delete(
    "/transactions/{transaction_id}/splits",
    status_code=200,
)
def delete_tx_splits(
    transaction_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> dict[str, int]:
    count = delete_splits(db, transaction_id=transaction_id, business_id=actor.business_id)
    if count > 0:
        AuditRepo(db).record(
            entity_type="transaction_split",
            action="deleted",
            entity_id=transaction_id,
            details={"deleted_lines": count},
        )
    db.commit()
    return {"deleted_lines": count}
