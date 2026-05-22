from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import AuditEventOut
from ledgerlens.db import get_db
from ledgerlens.repositories import AuditRepo

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/events", response_model=list[AuditEventOut])
def list_events(
    entity_type: str | None = None,
    entity_id: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> list[AuditEventOut]:
    limit = max(1, min(limit, 500))
    events = AuditRepo(db).list(entity_type=entity_type, entity_id=entity_id, limit=limit)
    return [AuditEventOut.model_validate(e) for e in events]
