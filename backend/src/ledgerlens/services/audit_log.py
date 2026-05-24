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

# Keys we never want to see end up in the audit JSON, even by
# accident. Each key is dropped before persistence; nested
# structures are walked once.
_FORBIDDEN_KEYS: frozenset[str] = frozenset(
    {
        "raw_csv",
        "raw_row",
        "raw_rows",
        "row_data",
        "csv_text",
        "transaction_description",
        "account_number",
        "routing_number",
        "card_number",
        "credentials",
        "password",
        "secret",
        "api_key",
        "anthropic_api_key",
        "database_url",
    }
)


def _redact(value: Any) -> Any:
    """Strip forbidden keys from a JSON-shaped value. One level deep
    is enough today; nested structures are walked recursively."""
    if isinstance(value, dict):
        return {k: _redact(v) for k, v in value.items() if k not in _FORBIDDEN_KEYS}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


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
