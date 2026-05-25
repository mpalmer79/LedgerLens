"""Accountant handoff endpoints.

`GET /handoff` — JSON report derived from persisted workflow state.
`GET /handoff/export.md` — markdown rendering of the same report.

No new writes. The handoff is a view over Transaction, CategorizationResult,
ReviewDecision, CorrectionMemory, and the existing LedgerTrust calculation.
"""

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.api.schemas import HandoffOut, LedgerRow
from ledgerlens.db import get_db
from ledgerlens.repositories import AuditRepo
from ledgerlens.services.handoff import build_handoff, render_markdown

router = APIRouter(prefix="/handoff", tags=["handoff"])


@router.get("", response_model=HandoffOut)
def get_handoff(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> HandoffOut:
    return build_handoff(db, actor.business_id)


@router.get("/export.md", response_class=PlainTextResponse)
def export_handoff_markdown(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> PlainTextResponse:
    handoff = build_handoff(db, actor.business_id)
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


_REVIEWED_COLUMNS = (
    "Date",
    "Description",
    "Merchant",
    "Amount",
    "Currency",
    "Suggested Category",
    "Category Code",
    "Review Status",
    "Verification Source",
    "Owner Answer",
    "Owner Note",
    "Accountant Follow-Up Required",
    "Source",
    "Transaction ID",
)


def _verification_source(row: LedgerRow) -> str:
    """Plain-English provenance for the accountant."""
    provider = row.model_provider or ""
    if row.reviewed:
        return "human-reviewed"
    if provider == "correction_memory":
        return "correction-memory replay"
    if provider == "rule_categorizer":
        return "deterministic rule"
    return provider or "—"


def _write_reviewed_row(writer: Any, row: LedgerRow) -> None:
    amount = f"{row.amount_cents / 100:.2f}"
    suggested = row.category_name or ""
    code = row.category_code or ""
    writer.writerow(
        [
            row.transaction_date.isoformat(),
            row.description,
            "",  # merchant — LedgerRow does not carry it today
            amount,
            row.currency,
            suggested,
            code,
            row.categorization_status,
            _verification_source(row),
            row.owner_answer_label or "",
            row.owner_note or "",
            "true" if row.accountant_follow_up_required else "false",
            row.source,
            row.transaction_id,
        ]
    )


@router.get("/export.reviewed.csv")
def export_reviewed_csv(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> StreamingResponse:
    """CSV formatted for accountant review.

    Contains only finalized, verified rows — the same set the handoff's
    "Ready for accountant" section shows. Not a QuickBooks / QBO / IIF
    import file; the column set is human-readable.
    """
    handoff = build_handoff(db, actor.business_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_REVIEWED_COLUMNS)
    for row in handoff.ready_for_accountant:
        _write_reviewed_row(writer, row)
    AuditRepo(db).record(
        entity_type="handoff",
        action="exported_reviewed_csv",
        details={
            "rows": len(handoff.ready_for_accountant),
            "verification_rate": round(handoff.trust.verification_rate, 4),
            "format": "reviewed_csv",
        },
    )
    db.commit()
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="ledgerlens-reviewed.csv"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/export.followup.csv")
def export_followup_csv(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> StreamingResponse:
    """CSV of rows that need follow-up before they can ship.

    Includes accountant-review-required rows (owner explicitly flagged)
    and pending rows the model could not finalize. Kept separate from
    the reviewed CSV so the accountant doesn't have to filter.
    """
    handoff = build_handoff(db, actor.business_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(_REVIEWED_COLUMNS)
    # Owner-flagged accountant-review rows first; then pending rows.
    seen: set[str] = set()
    for row in handoff.accountant_review_required:
        seen.add(row.transaction_id)
        _write_reviewed_row(writer, row)
    for row in handoff.needs_review:
        if row.transaction_id in seen:
            continue
        _write_reviewed_row(writer, row)
    AuditRepo(db).record(
        entity_type="handoff",
        action="exported_followup_csv",
        details={
            "accountant_review_rows": len(handoff.accountant_review_required),
            "needs_review_rows": len(handoff.needs_review),
            "format": "followup_csv",
        },
    )
    db.commit()
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="ledgerlens-followup.csv"',
            "X-Content-Type-Options": "nosniff",
        },
    )
