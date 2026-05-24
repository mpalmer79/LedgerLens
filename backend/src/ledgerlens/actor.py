"""Demo-safe actor / business context resolution.

Phase 2 foundation. Real authentication, sessions, and per-request
authorization are NOT implemented. This module provides:

- A `DemoActor` dataclass describing the resolved demo user +
  business + role + request id for the current request.
- `get_demo_actor()` FastAPI dependency that mutation routes use
  to attach an actor to audit events.
- `get_demo_business_id()` for routes that only need the business
  scope.

The public demo runs without login. Every request resolves to the
same seeded "Demo Owner" identity. The visible "Demo session"
badge on the frontend says so explicitly; the docs are blunt about
the limitation; the `/session` endpoint surfaces honest warnings.

When real auth lands in a future sprint, the bodies of these
functions can read `request.state.current_user` (or equivalent)
and the rest of the codebase stays put.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.orm import Session

from ledgerlens.db import get_db
from ledgerlens.models import Membership, MembershipRole, User
from ledgerlens.observability import get_request_id
from ledgerlens.seed import DEMO_USER_DISPLAY_NAME, DEMO_USER_EMAIL, seed_demo_tenant


@dataclass(frozen=True)
class DemoActor:
    """Resolved actor + business context for a single request.

    Today every request resolves to the demo user (seeded by
    `seed_demo_tenant`). Future auth replaces this with the real
    `current_user` resolver.
    """

    user_id: str
    display_name: str
    business_id: str
    business_name: str
    tenant_id: str
    role: str
    request_id: str | None
    is_demo: bool = True


def get_demo_actor(db: Session = Depends(get_db)) -> DemoActor:
    """Resolve the current demo actor.

    Idempotently re-seeds the demo tenant/business/user if missing,
    so the lifespan startup is not the only seed path (the test
    fixture overrides `get_db` and seeds a fresh in-memory DB per
    test).
    """
    tenant, business = seed_demo_tenant(db)
    user = db.query(User).filter(User.email == DEMO_USER_EMAIL).one_or_none()
    if user is None:
        # Should not happen — seed_demo_tenant creates the user.
        user = User(email=DEMO_USER_EMAIL, display_name=DEMO_USER_DISPLAY_NAME)
        db.add(user)
        db.commit()
        db.refresh(user)
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user.id, Membership.tenant_id == tenant.id)
        .one_or_none()
    )
    role = membership.role.value if membership else MembershipRole.OWNER.value
    return DemoActor(
        user_id=user.id,
        display_name=user.display_name or DEMO_USER_DISPLAY_NAME,
        business_id=business.id,
        business_name=business.name,
        tenant_id=tenant.id,
        role=role,
        request_id=get_request_id(),
    )


def get_demo_business_id(
    actor: DemoActor = Depends(get_demo_actor),
) -> str:
    """Convenience dependency for routes that only need the business id."""
    return actor.business_id
