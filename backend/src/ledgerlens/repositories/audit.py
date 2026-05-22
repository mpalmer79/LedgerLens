from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ledgerlens.models import AuditEvent


class AuditRepo:
    def __init__(self, db: Session) -> None:
        self.db = db

    def record(
        self,
        entity_type: str,
        action: str,
        *,
        entity_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            details=details or {},
        )
        self.db.add(event)
        self.db.flush()
        return event

    def list(
        self,
        *,
        entity_type: str | None = None,
        entity_id: str | None = None,
        limit: int = 100,
    ) -> list[AuditEvent]:
        stmt = select(AuditEvent).order_by(desc(AuditEvent.created_at)).limit(limit)
        if entity_type:
            stmt = stmt.where(AuditEvent.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(AuditEvent.entity_id == entity_id)
        return list(self.db.scalars(stmt))
