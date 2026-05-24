"""Tenant context helpers.

These helpers exist so future tenant-scoped code has a single
import surface. **This sprint does not retrofit any existing
query.** The demo continues to behave as a single shared workspace.

The public-demo tenant + business are seeded by
`ledgerlens.seed.seed_demo_tenant`. The helpers below resolve
them by slug so the rest of the code does not hard-code IDs.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from ledgerlens.models import Business, Tenant

# Slugs are the stable demo identifiers; IDs are generated at seed time.
DEMO_TENANT_SLUG = "ledgerlens-demo"
DEMO_BUSINESS_SLUG = "granite-state-auto-repair"


@dataclass(frozen=True)
class TenantContext:
    """A resolved tenant + (optional) business pair.

    `business_id` is None when the request scope is the entire
    tenant rather than a specific business. Future protected routes
    will accept a `TenantContext` dependency instead of taking
    `tenant_id` / `business_id` as separate parameters.
    """

    tenant_id: str
    business_id: str | None = None


def get_demo_tenant(db: Session) -> Tenant | None:
    """Return the seeded demo tenant, or None if not seeded yet."""
    return db.query(Tenant).filter(Tenant.slug == DEMO_TENANT_SLUG).one_or_none()


def get_demo_business(db: Session) -> Business | None:
    """Return the seeded demo business, or None if not seeded yet."""
    return db.query(Business).filter(Business.slug == DEMO_BUSINESS_SLUG).one_or_none()


def get_demo_tenant_context(db: Session) -> TenantContext | None:
    """Resolve the demo tenant + business as a single context.

    Returns None when the demo seed hasn't run. Use sparingly;
    code that depends on tenant scoping should accept a
    `TenantContext` rather than calling this directly.
    """
    tenant = get_demo_tenant(db)
    business = get_demo_business(db)
    if tenant is None:
        return None
    return TenantContext(tenant_id=tenant.id, business_id=business.id if business else None)


def require_tenant_context(db: Session) -> TenantContext:
    """Future protected-route dependency placeholder.

    Today: resolves the demo tenant. Phase 2 will replace the body
    with the real `current_user`-driven resolver. The signature
    stays compatible so callers don't need to change again.
    """
    ctx = get_demo_tenant_context(db)
    if ctx is None:
        raise RuntimeError(
            "No tenant context available — demo seed has not run. "
            "Call seed_demo_tenant() at startup."
        )
    return ctx
