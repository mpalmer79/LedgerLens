"""Demo-safe session endpoints.

`GET /session` returns the resolved demo actor + business + the
honesty warnings the frontend echoes. `POST /session/demo` is a
no-op that returns the same payload (kept for API symmetry so a
real session-creation endpoint can replace it later). `POST
/session/logout` is also a no-op today — the demo session is
stateless.

None of these endpoints accept credentials. The public demo is
**not** behind a login.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ledgerlens.actor import DemoActor, get_demo_actor

router = APIRouter(prefix="/session", tags=["session"])


_DEMO_WARNINGS: list[str] = [
    "Public demo session uses fictional data.",
    "This is not production authentication — every visitor acts as the same demo user.",
    "Business context is a portfolio foundation, not complete tenant isolation.",
    "Do not upload real bank data.",
]


class SessionUserOut(BaseModel):
    id: str
    display_name: str
    role_hint: str


class SessionBusinessOut(BaseModel):
    id: str
    name: str
    slug: str
    is_demo: bool


class SessionOut(BaseModel):
    authenticated: bool
    mode: str
    user: SessionUserOut
    business: SessionBusinessOut
    warnings: list[str]


def _to_session_out(actor: DemoActor) -> SessionOut:
    return SessionOut(
        authenticated=True,
        mode="demo",
        user=SessionUserOut(
            id=actor.user_id,
            display_name=actor.display_name,
            role_hint=actor.role,
        ),
        business=SessionBusinessOut(
            id=actor.business_id,
            name=actor.business_name,
            # business slug isn't on the actor; we use the same
            # constant the seed function uses.
            slug="granite-state-auto-repair",
            is_demo=actor.is_demo,
        ),
        warnings=list(_DEMO_WARNINGS),
    )


@router.get("", response_model=SessionOut)
def get_session(actor: DemoActor = Depends(get_demo_actor)) -> SessionOut:
    """Read the current demo session context."""
    return _to_session_out(actor)


@router.post("/demo", response_model=SessionOut)
def create_demo_session(actor: DemoActor = Depends(get_demo_actor)) -> SessionOut:
    """Idempotent — returns the same demo session context as `GET /session`.

    Kept for API symmetry so a future real session-creation
    endpoint can replace it without changing the frontend's call
    sites.
    """
    return _to_session_out(actor)


@router.post("/logout", status_code=204)
def logout_session() -> None:
    """No-op for the stateless demo session.

    A future cookie-based session would clear the cookie here.
    Returns 204 so the frontend can call it without parsing a
    body.
    """
    return None
