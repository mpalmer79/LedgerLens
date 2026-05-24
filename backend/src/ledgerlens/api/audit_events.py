"""Actor-aware audit events read endpoint.

Returns recent events scoped to the current demo business. The
response carries a small list of warnings so the UI can echo the
"workflow traceability, not regulatory compliance" framing.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.db import get_db
from ledgerlens.services.audit_log import list_audit_events

router = APIRouter(prefix="/audit-events", tags=["audit"])


class AuditEventOut(BaseModel):
    id: str
    business_id: str | None
    actor_user_id: str | None
    actor_display_name: str | None
    request_id: str | None
    action: str
    entity_type: str
    entity_id: str | None
    details: dict[str, object]
    created_at: datetime


class AuditEventListOut(BaseModel):
    total: int
    business_id: str
    events: list[AuditEventOut]
    warnings: list[str]


_WARNINGS: list[str] = [
    "Public demo — audit events are for workflow traceability, not regulatory compliance.",
    "Actor identity is the seeded demo user; every visitor acts as the same actor.",
    "Sensitive fields (raw CSV rows, account numbers, secrets) are stripped before storage.",
]


@router.get("", response_model=AuditEventListOut)
def list_events(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
    limit: int = Query(default=50, ge=1, le=200),
    entity_type: str | None = Query(default=None, max_length=64),
    action: str | None = Query(default=None, max_length=64),
) -> AuditEventListOut:
    events = list_audit_events(
        db,
        business_id=actor.business_id,
        limit=limit,
        entity_type=entity_type,
        action=action,
    )
    return AuditEventListOut(
        total=len(events),
        business_id=actor.business_id,
        events=[
            AuditEventOut(
                id=e.id,
                business_id=e.business_id,
                actor_user_id=e.actor_user_id,
                actor_display_name=e.actor_display_name,
                request_id=e.request_id,
                action=e.action,
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                details=e.details or {},
                created_at=e.created_at,
            )
            for e in events
        ],
        warnings=list(_WARNINGS),
    )
