"""Accountant handoff endpoints.

`GET /handoff` — JSON report derived from persisted workflow state.
`GET /handoff/export.md` — markdown rendering of the same report.

No new writes. The handoff is a view over Transaction, CategorizationResult,
ReviewDecision, CorrectionMemory, and the existing LedgerTrust calculation.
"""

import csv
import io
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.api.schemas import HandoffOut, LedgerRow
from ledgerlens.db import get_db
from ledgerlens.models import TransactionSplitLine
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


# ── Owner questions CSV ──────────────────────────────────────────────


@router.get("/export.owner-questions.csv")
def export_owner_questions_csv(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> StreamingResponse:
    """CSV of rows with owner-question context for accountant review."""
    handoff = build_handoff(db, actor.business_id)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "transaction_id",
            "transaction_date",
            "description",
            "amount",
            "currency",
            "owner_question_label",
            "owner_question_key",
            "suggested_resolution",
            "owner_note",
            "current_status",
            "source",
        ]
    )
    for a in handoff.owner_answers:
        tx_date = (
            a.transaction_date.isoformat()
            if hasattr(a.transaction_date, "isoformat")
            else str(a.transaction_date)
        )
        writer.writerow(
            [
                a.transaction_id,
                tx_date,
                a.transaction_description,
                f"{a.amount_cents / 100:.2f}",
                a.currency,
                a.owner_answer_label or "",
                a.owner_question_key or "",
                a.suggested_resolution or "",
                a.owner_note or "",
                a.reviewer_action,
                "owner_review",
            ]
        )
    AuditRepo(db).record(
        entity_type="handoff",
        action="exported_owner_questions_csv",
        details={"rows": len(handoff.owner_answers), "format": "owner_questions_csv"},
    )
    db.commit()
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="ledgerlens-owner-questions.csv"',
            "X-Content-Type-Options": "nosniff",
        },
    )


# ── Split lines CSV ──────────────────────────────────────────────────


@router.get("/export.splits.csv")
def export_splits_csv(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> StreamingResponse:
    """CSV of all split transaction lines for this business."""
    from ledgerlens.models import Transaction

    stmt = db.query(TransactionSplitLine)
    if actor.business_id:
        stmt = stmt.filter(TransactionSplitLine.business_id == actor.business_id)
    else:
        stmt = stmt.filter(TransactionSplitLine.business_id.is_(None))
    splits = stmt.order_by(
        TransactionSplitLine.transaction_id,
        TransactionSplitLine.line_index,
    ).all()

    tx_cache: dict[str, Transaction] = {}
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "transaction_id",
            "split_line_id",
            "line_index",
            "transaction_date",
            "description",
            "original_amount",
            "split_amount",
            "currency",
            "category_code",
            "category_name",
            "split_note",
            "source",
        ]
    )
    for s in splits:
        if s.transaction_id not in tx_cache:
            tx_cache[s.transaction_id] = db.get(Transaction, s.transaction_id)  # type: ignore[assignment]
        tx = tx_cache.get(s.transaction_id)
        writer.writerow(
            [
                s.transaction_id,
                s.id,
                s.line_index,
                tx.transaction_date.isoformat() if tx else "",
                tx.description if tx else "",
                f"{tx.amount_cents / 100:.2f}" if tx else "",
                f"{s.amount_cents / 100:.2f}",
                tx.currency if tx else "USD",
                s.category_code or "",
                s.category_name or "",
                s.note or "",
                s.source,
            ]
        )
    AuditRepo(db).record(
        entity_type="handoff",
        action="exported_splits_csv",
        details={"rows": len(splits), "format": "splits_csv"},
    )
    db.commit()
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="ledgerlens-splits.csv"',
            "X-Content-Type-Options": "nosniff",
        },
    )


# ── Package manifest JSON ────────────────────────────────────────────


@router.get("/export.package.json")
def export_package_json(
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> JSONResponse:
    """JSON manifest summarizing available exports and counts."""
    handoff = build_handoff(db, actor.business_id)

    split_count = 0
    split_tx_count = 0
    if actor.business_id:
        split_count = (
            db.query(TransactionSplitLine)
            .filter(TransactionSplitLine.business_id == actor.business_id)
            .count()
        )
        split_tx_count = (
            db.query(TransactionSplitLine.transaction_id)
            .filter(TransactionSplitLine.business_id == actor.business_id)
            .distinct()
            .count()
        )

    package = {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "synthetic_demo_data": True,
        "business_label": handoff.scenario.business_name if handoff.scenario else "Unknown",
        "total_rows": handoff.trust.finalized_count + handoff.trust.review_required_count,
        "finalized_rows": handoff.trust.finalized_count,
        "verified_finalized_rows": handoff.trust.verified_count,
        "unresolved_rows": handoff.trust.review_required_count,
        "owner_question_rows": len(handoff.owner_answers),
        "accountant_follow_up_rows": len(handoff.accountant_review_required),
        "split_transaction_count": split_tx_count,
        "split_line_count": split_count,
        "exports": [
            {"name": "Full ledger CSV", "path": "/ledger/export.csv"},
            {"name": "Reviewed rows CSV", "path": "/handoff/export.reviewed.csv"},
            {"name": "Follow-up CSV", "path": "/handoff/export.followup.csv"},
            {"name": "Owner questions CSV", "path": "/handoff/export.owner-questions.csv"},
            {"name": "Split lines CSV", "path": "/handoff/export.splits.csv"},
            {"name": "Handoff summary Markdown", "path": "/handoff/export.md"},
            {"name": "Package manifest JSON", "path": "/handoff/export.package.json"},
        ],
    }
    AuditRepo(db).record(
        entity_type="handoff",
        action="exported_package_json",
        details={"format": "package_json"},
    )
    db.commit()
    return JSONResponse(
        content=package,
        headers={"X-Content-Type-Options": "nosniff"},
    )
