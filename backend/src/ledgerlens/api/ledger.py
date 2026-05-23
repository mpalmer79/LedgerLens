import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import LedgerOut, LedgerRow, LedgerTrust
from ledgerlens.config import get_settings
from ledgerlens.db import get_db
from ledgerlens.models import ResultStatus
from ledgerlens.repositories import (
    AuditRepo,
    CategorizationRepo,
    CategoryRepo,
    ReviewRepo,
    TransactionRepo,
)

router = APIRouter(prefix="/ledger", tags=["ledger"])


def _build_rows(db: Session) -> list[LedgerRow]:
    tx_repo = TransactionRepo(db)
    cat_repo = CategorizationRepo(db)
    rev_repo = ReviewRepo(db)
    coa = CategoryRepo(db)

    rows: list[LedgerRow] = []
    # Iterate all transactions (pagination is a future concern; ledger export
    # is meant to be the full ledger at v0 scale).
    page = 0
    while True:
        items = tx_repo.list(limit=200, offset=page * 200)
        if not items:
            break
        for tx in items:
            latest = cat_repo.latest_for_transaction(tx.id)
            latest_review = rev_repo.latest_for_transaction(tx.id)

            if latest is None:
                rows.append(
                    LedgerRow(
                        transaction_id=tx.id,
                        transaction_date=tx.transaction_date,
                        description=tx.description,
                        amount_cents=tx.amount_cents,
                        currency=tx.currency,
                        category_code=None,
                        category_name=None,
                        categorization_status="pending",
                        confidence=None,
                        reviewed=False,
                        reviewer_note=None,
                        source=tx.source,
                        model_provider=None,
                    )
                )
                continue

            # The final category is: corrected code if review-corrected, else
            # the predicted code if approved or auto-approved, else None.
            final_code: str | None
            final_name: str | None
            if latest.status == ResultStatus.CORRECTED and latest_review:
                final_code = latest_review.selected_category_code
                cat = coa.get(final_code) if final_code else None
                final_name = cat.name if cat else None
            elif latest.status in (ResultStatus.AUTO_APPROVED, ResultStatus.CORRECTED):
                final_code = latest.predicted_category_code
                final_name = latest.predicted_category_name
            else:
                final_code = None
                final_name = None

            rows.append(
                LedgerRow(
                    transaction_id=tx.id,
                    transaction_date=tx.transaction_date,
                    description=tx.description,
                    amount_cents=tx.amount_cents,
                    currency=tx.currency,
                    category_code=final_code,
                    category_name=final_name,
                    categorization_status=latest.status.value,
                    confidence=latest.confidence,
                    reviewed=latest_review is not None,
                    reviewer_note=(latest_review.reviewer_note if latest_review else None),
                    source=tx.source,
                    model_provider=latest.model_provider,
                )
            )
        page += 1

    return rows


def _unresolved_count(rows: list[LedgerRow]) -> int:
    return sum(1 for r in rows if r.categorization_status in ("needs_review", "pending", "failed"))


def _is_finalized(row: LedgerRow) -> bool:
    """A row is finalized when it has a category and is not in a review or
    error state. Uncategorizable rows are intentionally excluded — they were
    explicitly removed from the bookkeeping output by a human or by the
    pipeline's safety check."""
    return row.categorization_status in {"auto_approved", "corrected"}


def _is_verified(row: LedgerRow) -> bool:
    """A finalized row counts as verified iff it came through a defensible
    path: human review, correction memory, or a rule-layer auto-approval.
    Auto-approved demo-stub / anthropic rows that were never touched by a
    human are explicitly NOT verified."""
    if not _is_finalized(row):
        return False
    if row.reviewed:
        return True
    provider = row.model_provider or ""
    if provider == "correction_memory":
        return True
    if provider == "rule_categorizer" and row.categorization_status == "auto_approved":
        return True
    return False


def _compute_trust(rows: list[LedgerRow]) -> LedgerTrust:
    finalized = [r for r in rows if _is_finalized(r)]
    verified = [r for r in finalized if _is_verified(r)]
    review_required = sum(1 for r in rows if r.categorization_status == "needs_review")
    deterministic = sum(
        1 for r in rows if (r.model_provider or "") in {"correction_memory", "rule_categorizer"}
    )
    human_reviewed = sum(1 for r in rows if r.reviewed)
    return LedgerTrust(
        finalized_count=len(finalized),
        verified_count=len(verified),
        unverified_finalized_count=len(finalized) - len(verified),
        review_required_count=review_required,
        deterministic_count=deterministic,
        human_reviewed_count=human_reviewed,
        verification_rate=(len(verified) / len(finalized)) if finalized else 1.0,
    )


@router.get("", response_model=LedgerOut)
def get_ledger(db: Session = Depends(get_db)) -> LedgerOut:
    rows = _build_rows(db)
    return LedgerOut(
        total=len(rows),
        unresolved=_unresolved_count(rows),
        rows=rows,
        trust=_compute_trust(rows),
    )


@router.get("/export.csv")
def export_csv(db: Session = Depends(get_db)) -> StreamingResponse:
    rows = _build_rows(db)
    trust = _compute_trust(rows)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "transaction_date",
            "description",
            "amount",
            "currency",
            "category_code",
            "category_name",
            "categorization_status",
            "confidence",
            "model_provider",
            "verified",
            "source",
            "reviewed",
            "reviewer_note",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r.transaction_date.isoformat(),
                r.description,
                f"{r.amount_cents / 100:.2f}",
                r.currency,
                r.category_code or "",
                r.category_name or "",
                r.categorization_status,
                "" if r.confidence is None else f"{r.confidence:.4f}",
                r.model_provider or "",
                "true" if _is_verified(r) else "false",
                r.source,
                "true" if r.reviewed else "false",
                r.reviewer_note or "",
            ]
        )

    settings = get_settings()
    AuditRepo(db).record(
        entity_type="ledger",
        action="exported",
        details={
            "row_count": len(rows),
            "unresolved": _unresolved_count(rows),
            "finalized": trust.finalized_count,
            "verified": trust.verified_count,
            "verification_rate": round(trust.verification_rate, 4),
            "categorizer_mode": settings.categorizer_mode,
        },
    )
    db.commit()

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ledger.csv"'},
    )
