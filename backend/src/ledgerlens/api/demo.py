"""Guided-demo support endpoints.

These exist so the public Railway deploy can ship a 3-minute guided demo
without forcing every reviewer to know how to use the CSV importer. They
are deliberately scoped:

- All three endpoints return 503 unless `CATEGORIZER_MODE=demo_stub`. That
  keeps them out of the way of any environment that's wired up to a real
  Anthropic key — production isn't going to find a /demo button waiting to
  wipe its data.
- `/demo/reset` deletes only rows tagged `source="demo"`. It will never
  drop the seed chart of accounts, model results from real categorize
  calls, or anything imported via /transactions/import.
- `/demo/seed` reuses the existing TransactionRepo write path. No special
  fast paths, no schema bypass.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import TransactionOut
from ledgerlens.config import get_settings
from ledgerlens.db import get_db
from ledgerlens.models import (
    AuditEvent,
    CategorizationResult,
    CorrectionMemory,
    ReviewDecision,
    Transaction,
)
from ledgerlens.repositories import AuditRepo, TransactionRepo
from ledgerlens.services.normalize import normalize_description

router = APIRouter(prefix="/demo", tags=["demo"])

DEMO_SOURCE = "demo"


# A small, recognisable cross-section of the bookkeeping mess: obvious
# vendors that a rule will match (Zoom, QuickBooks, Staples, Shell, Stripe
# fee), an ambiguous one Amazon (rule routes to review), and several
# unknown vendors that hit the demo stub.
DEMO_TRANSACTIONS: list[dict[str, object]] = [
    {
        "transaction_date": "2026-03-01",
        "description": "COMCAST BUSINESS INTERNET MAR",
        "merchant": "Comcast",
        "amount_cents": -18900,
    },
    {
        "transaction_date": "2026-03-02",
        "description": "QUICKBOOKS ONLINE PLUS",
        "merchant": "Intuit",
        "amount_cents": -8000,
    },
    {
        "transaction_date": "2026-03-03",
        "description": "ZOOM.US MONTHLY",
        "merchant": "Zoom",
        "amount_cents": -1499,
    },
    {
        "transaction_date": "2026-03-04",
        "description": "STAPLES STORE 4471",
        "merchant": "Staples",
        "amount_cents": -6342,
    },
    {
        "transaction_date": "2026-03-05",
        "description": "SHELL FUEL 03801",
        "merchant": "Shell",
        "amount_cents": -7821,
    },
    {
        "transaction_date": "2026-03-07",
        "description": "STRIPE PROCESSING FEE",
        "merchant": "Stripe",
        "amount_cents": -3219,
    },
    {
        "transaction_date": "2026-03-08",
        "description": "AMAZON BUSINESS ORDER 113-44",
        "merchant": "Amazon",
        "amount_cents": -12490,
    },
    {
        "transaction_date": "2026-03-10",
        "description": "NAPA AUTO PARTS INV 99812",
        "merchant": "NAPA",
        "amount_cents": -23410,
    },
    {
        "transaction_date": "2026-03-12",
        "description": "ADP PAYROLL BI-WEEKLY",
        "merchant": "ADP",
        "amount_cents": -742380,
    },
    {
        "transaction_date": "2026-03-14",
        "description": "STATE FARM POLICY 49KF-NH",
        "merchant": "State Farm",
        "amount_cents": -28400,
    },
    {
        "transaction_date": "2026-03-18",
        "description": "SYSCO FOODS WK10 DELIVERY",
        "merchant": "Sysco",
        "amount_cents": -188430,
    },
    {
        "transaction_date": "2026-03-20",
        "description": "ACH TRANSFER VENDOR REF 99812",
        "merchant": None,
        "amount_cents": -42100,
    },
]


def _rowcount(result: object) -> int:
    """SQLAlchemy 2.0's `Result` type doesn't expose `rowcount` in its public
    stubs even though `CursorResult` does. The DELETE statements above return
    a `CursorResult` at runtime; this helper centralises the cast."""
    return int(getattr(result, "rowcount", 0) or 0)


def _require_demo_mode() -> None:
    settings = get_settings()
    if settings.categorizer_mode != "demo_stub":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "demo_mode_only",
                "message": (
                    "Demo support endpoints are only available when CATEGORIZER_MODE=demo_stub."
                ),
            },
        )


@router.get("/status")
def demo_status(db: Session = Depends(get_db)) -> dict[str, object]:
    """Counts the demo page renders. Safe to call in any mode (no writes)."""
    settings = get_settings()
    repo = TransactionRepo(db)
    demo_tx_count = db.query(Transaction).filter(Transaction.source == DEMO_SOURCE).count()
    return {
        "demo_mode": settings.categorizer_mode == "demo_stub",
        "categorizer_mode": settings.categorizer_mode,
        "transaction_count": repo.count(),
        "demo_transaction_count": demo_tx_count,
        "categorization_result_count": db.query(CategorizationResult).count(),
        "review_decision_count": db.query(ReviewDecision).count(),
        "correction_memory_count": (
            db.query(CorrectionMemory).filter(CorrectionMemory.active.is_(True)).count()
        ),
    }


@router.post("/seed", status_code=201)
def demo_seed(db: Session = Depends(get_db)) -> dict[str, object]:
    """Insert the bundled demo transactions. Tagged source='demo'.

    Re-running this endpoint inserts another copy; the frontend should
    call /demo/reset first if it wants a clean slate.
    """
    _require_demo_mode()
    repo = TransactionRepo(db)
    created: list[Transaction] = []
    for row in DEMO_TRANSACTIONS:
        description = str(row["description"])
        merchant_raw = row.get("merchant")
        merchant = str(merchant_raw) if isinstance(merchant_raw, str) else None
        amount_raw = row["amount_cents"]
        assert isinstance(amount_raw, int)
        tx = Transaction(
            transaction_date=date.fromisoformat(str(row["transaction_date"])),
            description=description,
            raw_description=description,
            normalized_description=normalize_description(description),
            merchant=merchant,
            amount_cents=amount_raw,
            currency="USD",
            source=DEMO_SOURCE,
        )
        repo.add(tx)
        created.append(tx)
    AuditRepo(db).record(
        entity_type="demo",
        action="demo_seeded",
        entity_id=None,
        details={"count": len(created)},
    )
    db.commit()
    for tx in created:
        db.refresh(tx)
    return {
        "created": [TransactionOut.model_validate(tx).model_dump() for tx in created],
        "count": len(created),
    }


@router.post("/reset", status_code=200)
def demo_reset(db: Session = Depends(get_db)) -> dict[str, object]:
    """Delete every row whose source='demo' and everything that depends on it.

    Order matters: child rows (categorization_results, review_decisions,
    correction_memory) are removed first so the foreign keys don't trip.
    Audit events from the demo tear-down are intentionally kept — they're
    the record that this happened.
    """
    _require_demo_mode()
    demo_tx_ids = [
        tx.id for tx in db.query(Transaction.id).filter(Transaction.source == DEMO_SOURCE).all()
    ]
    if not demo_tx_ids:
        return {"deleted_transactions": 0, "deleted_results": 0, "deleted_decisions": 0}

    deleted_results = _rowcount(
        db.execute(
            delete(CategorizationResult).where(CategorizationResult.transaction_id.in_(demo_tx_ids))
        )
    )
    deleted_decisions = _rowcount(
        db.execute(delete(ReviewDecision).where(ReviewDecision.transaction_id.in_(demo_tx_ids)))
    )
    deleted_memories = _rowcount(
        db.execute(
            delete(CorrectionMemory).where(CorrectionMemory.source_transaction_id.in_(demo_tx_ids))
        )
    )
    # Audit events for the deleted transactions stay — they tell the story
    # of what happened. Only the demo-tagged AuditEvent rows for demo-only
    # actions like `demo_seeded`/`demo_reset` get cleaned up here.
    deleted_demo_audit = _rowcount(
        db.execute(delete(AuditEvent).where(AuditEvent.entity_type == "demo"))
    )
    deleted_transactions = _rowcount(
        db.execute(delete(Transaction).where(Transaction.id.in_(demo_tx_ids)))
    )

    AuditRepo(db).record(
        entity_type="demo",
        action="demo_reset",
        entity_id=None,
        details={
            "deleted_transactions": deleted_transactions,
            "deleted_results": deleted_results,
            "deleted_decisions": deleted_decisions,
            "deleted_memories": deleted_memories,
            "deleted_demo_audit": deleted_demo_audit,
        },
    )
    db.commit()
    return {
        "deleted_transactions": deleted_transactions,
        "deleted_results": deleted_results,
        "deleted_decisions": deleted_decisions,
        "deleted_memories": deleted_memories,
    }


@router.get("/sample-transactions")
def demo_sample_preview() -> list[dict[str, object]]:
    """Return the bundled demo payload without writing anything.

    Used by the /demo page's first step ("Here is the bookkeeping mess").
    Returning it from the API keeps the frontend free of duplicated
    transaction strings.
    """
    return [dict(row) for row in DEMO_TRANSACTIONS]
