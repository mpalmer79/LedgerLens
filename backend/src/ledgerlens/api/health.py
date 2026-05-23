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

    # Categorizer mode + provider credential state. In demo_stub mode the
    # missing Anthropic key is not an error — it's the expected portfolio
    # configuration.
    checks["categorizer"] = {
        "mode": settings.categorizer_mode,
        "demo_mode": settings.is_demo_mode,
    }
    checks["anthropic"] = {
        "configured": settings.anthropic_configured,
        "model_primary": settings.anthropic_model_primary,
        # In demo mode the app never calls Anthropic, so a missing key is
        # explicitly NOT a readiness blocker.
        "required_for_current_mode": settings.categorizer_mode == "anthropic",
    }

    ready_flag = bool(checks["database"]["ok"])
    if settings.categorizer_mode == "anthropic" and not settings.anthropic_configured:
        # In anthropic mode the key is required for the categorize endpoint.
        # Surface that as not-ready without crashing the process.
        ready_flag = False

    return {
        "ready": ready_flag,
        "checks": checks,
        "version": settings.app_version,
    }
