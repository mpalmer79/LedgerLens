from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from ledgerlens.config import get_settings
from ledgerlens.db import get_db

router = APIRouter()


@router.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Liveness — does the process accept HTTP requests?"""
    return {"status": "ok", "service": "ledgerlens-api"}


@router.get("/ready", tags=["health"])
def ready(db: Session = Depends(get_db)) -> dict[str, object]:
    """Readiness — are dependencies actually usable?

    Reports each dependency independently. A 200 with `ready=false` is
    expected (and distinct from a 500) when a dependency is genuinely
    misconfigured — the app process is fine, the deployment isn't.
    """
    settings = get_settings()
    checks: dict[str, dict[str, object]] = {}

    # Database.
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001 — surface the SQL error class
        checks["database"] = {"ok": False, "error": type(exc).__name__}

    # Provider credential (presence, not validity).
    checks["anthropic"] = {
        "configured": settings.anthropic_configured,
        "model_primary": settings.anthropic_model_primary,
    }

    ready_flag = bool(checks["database"]["ok"])

    return {
        "ready": ready_flag,
        "checks": checks,
        "version": settings.app_version,
    }
