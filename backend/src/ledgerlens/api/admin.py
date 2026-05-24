"""Admin / foundation-status endpoint.

A small, honest endpoint that reports the state of the auth/tenant
foundation. The frontend `/admin` route renders this verbatim so the
boundary between "schema exists" and "production auth lives" is
visible to anyone who looks.

The response intentionally exposes only model presence and warnings;
it never echoes environment variables, secrets, database URLs, or
inbound headers.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ledgerlens.db import get_db
from ledgerlens.models import Business, Membership, Tenant, User
from ledgerlens.tenant_context import get_demo_business, get_demo_tenant

router = APIRouter(prefix="/admin", tags=["admin"])


class FoundationStatus(BaseModel):
    auth_implemented: bool
    tenant_models_present: bool
    tenant_enforcement_complete: bool
    demo_tenant_available: bool
    demo_business_available: bool
    production_ready: bool
    user_count: int
    tenant_count: int
    membership_count: int
    business_count: int
    warnings: list[str]


@router.get("/foundation/status", response_model=FoundationStatus)
def get_foundation_status(db: Session = Depends(get_db)) -> FoundationStatus:
    demo_tenant = get_demo_tenant(db)
    demo_business = get_demo_business(db)
    warnings = [
        "Production authentication is not implemented.",
        "No login UI exists in this deploy.",
        "Tenant models exist; full tenant enforcement is not complete.",
        "Existing transactions, categorization results, review decisions, "
        "and audit events are not yet scoped to a business or tenant.",
        "Public demo remains synthetic/sample-data only. Do not upload real bank data.",
    ]
    return FoundationStatus(
        auth_implemented=False,
        tenant_models_present=True,
        tenant_enforcement_complete=False,
        demo_tenant_available=demo_tenant is not None,
        demo_business_available=demo_business is not None,
        production_ready=False,
        user_count=db.query(User).count(),
        tenant_count=db.query(Tenant).count(),
        membership_count=db.query(Membership).count(),
        business_count=db.query(Business).count(),
        warnings=warnings,
    )
