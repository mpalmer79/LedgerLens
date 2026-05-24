"""Accountant handoff endpoints.

`GET /handoff` — JSON report derived from persisted workflow state.
`GET /handoff/export.md` — markdown rendering of the same report.

No new writes. The handoff is a view over Transaction, CategorizationResult,
ReviewDecision, CorrectionMemory, and the existing LedgerTrust calculation.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import HandoffOut
from ledgerlens.db import get_db
from ledgerlens.repositories import AuditRepo
from ledgerlens.services.handoff import build_handoff, render_markdown

router = APIRouter(prefix="/handoff", tags=["handoff"])


@router.get("", response_model=HandoffOut)
def get_handoff(db: Session = Depends(get_db)) -> HandoffOut:
    return build_handoff(db)


@router.get("/export.md", response_class=PlainTextResponse)
def export_handoff_markdown(db: Session = Depends(get_db)) -> PlainTextResponse:
    handoff = build_handoff(db)
    body = render_markdown(handoff)
    filename = handoff.scenario.handoff_filename if handoff.scenario else "handoff.md"
    AuditRepo(db).record(
        entity_type="handoff",
        action="exported",
        details={
            "verification_rate": round(handoff.trust.verification_rate, 4),
            "finalized": handoff.trust.finalized_count,
            "verified": handoff.trust.verified_count,
            "needs_review": len(handoff.needs_review),
            "owner_answers": len(handoff.owner_answers),
            "format": "markdown",
            "filename": filename,
        },
    )
    db.commit()
    return PlainTextResponse(
        body,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
