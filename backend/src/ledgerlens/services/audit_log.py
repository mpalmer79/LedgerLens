"""Actor-aware audit event service.

Wraps `AuditEvent` so call sites don't have to remember to attach
business_id, actor_user_id, actor_display_name, or request_id. Also
applies a small "never store this" guard on the `details` JSON
before persistence.

The Phase 2 spec lists a handful of audit actions
(`import_profile.created`, `mapping_profile.updated`,
`mapping_apply.selected_rows_applied`, etc.). Those are plain
strings here — the service does not enforce an enum so adding a
new action is one line.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor
from ledgerlens.models import AuditEvent
from ledgerlens.services.sensitive_data import (
    FORBIDDEN_KEYS as _FORBIDDEN_KEYS,
    redact_forbidden_keys as _redact,
)

# Re-exported for tests that imported the previous internal names.
__all__ = ["_FORBIDDEN_KEYS", "_redact", "record_audit_event"]


def record_audit_event(
    db: Session,
    *,
    actor: DemoActor | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    before: Any | None = None,
    after: Any | None = None,
    metadata: dict[str, Any] | None = None,
    business_id: str | None = None,
    commit: bool = False,
) -> AuditEvent:
    """Persist a single audit event with the resolved actor + scope.

    The event is added to the session but not committed by default
    — callers usually batch the commit with their own write.

    `before` / `after` / `metadata` are stored under the
    `details` JSON blob with `_FORBIDDEN_KEYS` stripped.
    """
    bid = business_id or (actor.business_id if actor else None)
    details: dict[str, Any] = {}
    if before is not None:
        details["before"] = _redact(before)
    if after is not None:
        details["after"] = _redact(after)
    if metadata:
        details["metadata"] = _redact(metadata)

    event = AuditEvent(
        business_id=bid,
        actor_user_id=actor.user_id if actor else None,
        actor_display_name=actor.display_name if actor else None,
        request_id=actor.request_id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(event)
    if commit:
        db.commit()
        db.refresh(event)
    return event


def list_audit_events(
    db: Session,
    *,
    business_id: str,
    limit: int = 50,
    entity_type: str | None = None,
    action: str | None = None,
) -> list[AuditEvent]:
    """Read recent audit events scoped to a business."""
    q = db.query(AuditEvent).filter(AuditEvent.business_id == business_id)
    if entity_type:
        q = q.filter(AuditEvent.entity_type == entity_type)
    if action:
        q = q.filter(AuditEvent.action == action)
    return q.order_by(AuditEvent.created_at.desc()).limit(limit).all()
