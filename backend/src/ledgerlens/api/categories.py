from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import CategoryOut
from ledgerlens.db import get_db
from ledgerlens.repositories import CategoryRepo

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[CategoryOut]:
    return [CategoryOut.model_validate(c) for c in CategoryRepo(db).list_active()]
