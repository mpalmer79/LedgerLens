"""Auth/Tenant Phase 1 — foundation models + status endpoint + demo seed.

These tests pin the new schema and the honest status the /admin
shell reads. No login is implemented; this sprint is foundation
only.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ledgerlens.models import Business, Membership, MembershipRole, Tenant, User
from ledgerlens.seed import seed_demo_tenant
from ledgerlens.tenant_context import (
    DEMO_BUSINESS_SLUG,
    DEMO_TENANT_SLUG,
    get_demo_business,
    get_demo_tenant,
    get_demo_tenant_context,
)

# ── Model creation ────────────────────────────────────────────────────


def test_user_model_persists_and_enforces_unique_email(db_session: Session) -> None:
    u1 = User(email="alice@example.invalid", display_name="Alice")
    u2 = User(email="bob@example.invalid")
    db_session.add_all([u1, u2])
    db_session.commit()
    assert u1.id.startswith("usr_")
    assert u1.created_at is not None
    db_session.add(User(email="alice@example.invalid"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_tenant_model_persists_and_enforces_unique_slug(db_session: Session) -> None:
    t1 = Tenant(name="Acme Demo", slug="acme-demo")
    db_session.add(t1)
    db_session.commit()
    assert t1.id.startswith("ten_")
    db_session.add(Tenant(name="Acme Demo 2", slug="acme-demo"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_business_model_requires_tenant_and_enforces_per_tenant_slug(db_session: Session) -> None:
    tenant = Tenant(name="Bizcorp Demo", slug="bizcorp-demo")
    db_session.add(tenant)
    db_session.flush()
    b1 = Business(tenant_id=tenant.id, name="Shop A", slug="shop-a")
    db_session.add(b1)
    db_session.commit()
    assert b1.id.startswith("biz_")
    # Same slug under same tenant is rejected.
    db_session.add(Business(tenant_id=tenant.id, name="Shop A v2", slug="shop-a"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
    # Same slug under a DIFFERENT tenant is allowed.
    tenant2 = Tenant(name="Other Demo", slug="other-demo")
    db_session.add(tenant2)
    db_session.flush()
    db_session.add(Business(tenant_id=tenant2.id, name="Shop A", slug="shop-a"))
    db_session.commit()


def test_membership_requires_user_and_tenant_unique_pair(db_session: Session) -> None:
    user = User(email="member@example.invalid")
    tenant = Tenant(name="Mem Demo", slug="mem-demo")
    db_session.add_all([user, tenant])
    db_session.flush()
    m = Membership(user_id=user.id, tenant_id=tenant.id, role=MembershipRole.OWNER)
    db_session.add(m)
    db_session.commit()
    assert m.id.startswith("mem_")
    assert m.role == MembershipRole.OWNER
    # Duplicate (user, tenant) is rejected.
    db_session.add(Membership(user_id=user.id, tenant_id=tenant.id, role=MembershipRole.VIEWER))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ── Demo seed ─────────────────────────────────────────────────────────


def test_seed_demo_tenant_is_idempotent(db_session: Session) -> None:
    t1, b1 = seed_demo_tenant(db_session)
    t2, b2 = seed_demo_tenant(db_session)
    assert t1.id == t2.id
    assert b1.id == b2.id
    assert t1.slug == DEMO_TENANT_SLUG
    assert b1.slug == DEMO_BUSINESS_SLUG
    assert b1.tenant_id == t1.id


def test_tenant_context_helper_resolves_demo_pair(db_session: Session) -> None:
    seed_demo_tenant(db_session)
    ctx = get_demo_tenant_context(db_session)
    assert ctx is not None
    demo_tenant = get_demo_tenant(db_session)
    demo_business = get_demo_business(db_session)
    assert demo_tenant is not None
    assert demo_business is not None
    assert ctx.tenant_id == demo_tenant.id
    assert ctx.business_id == demo_business.id


# ── Foundation status endpoint ────────────────────────────────────────


def test_foundation_status_endpoint_returns_honest_snapshot(
    client: TestClient, db_session: Session
) -> None:
    # Seed inside the per-test session so the endpoint can read it back.
    seed_demo_tenant(db_session)

    res = client.get("/admin/foundation/status")
    assert res.status_code == 200, res.text
    body = res.json()
    # Honesty contract: these MUST be false in this sprint.
    assert body["auth_implemented"] is False
    assert body["tenant_enforcement_complete"] is False
    assert body["production_ready"] is False
    # Models are present; the demo tenant + business are seeded.
    assert body["tenant_models_present"] is True
    assert body["demo_tenant_available"] is True
    assert body["demo_business_available"] is True
    # Counts are non-negative ints.
    for key in ("user_count", "tenant_count", "membership_count", "business_count"):
        assert isinstance(body[key], int)
        assert body[key] >= 0
    # Warnings are explicit.
    warnings = " ".join(body["warnings"]).lower()
    assert "production authentication is not implemented" in warnings
    assert "tenant enforcement" in warnings
    assert "do not upload real bank data" in warnings


def test_foundation_status_does_not_leak_environment(client: TestClient) -> None:
    """The status endpoint must never echo DATABASE_URL or env vars."""
    res = client.get("/admin/foundation/status")
    body_lower = res.text.lower()
    for forbidden in ["database_url", "anthropic_api_key", "secret", "password"]:
        assert forbidden not in body_lower, f"status endpoint leaked '{forbidden}'"


# ── Public demo is NOT broken by the foundation work ─────────────────


def test_public_demo_routes_still_work_without_auth(client: TestClient) -> None:
    """Every public route used by the demo must respond without auth."""
    for path in [
        "/health",
        "/categories",
        "/transactions",
        "/ledger",
        "/handoff",
        "/rules",
        "/admin/foundation/status",
    ]:
        res = client.get(path)
        assert res.status_code in (200, 201), f"{path} returned {res.status_code}"


def test_response_carries_request_id_header_on_admin_route(client: TestClient) -> None:
    """The new /admin route inherits the request-id middleware."""
    res = client.get("/admin/foundation/status")
    rid = res.headers.get("X-Request-ID")
    assert rid is not None and len(rid) >= 8
