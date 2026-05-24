"""Guided-demo support endpoints.

These exist so the public Railway deploy can ship a 3-minute guided demo
without forcing every reviewer to know how to use the CSV importer. They
are deliberately scoped:

- All write endpoints return 503 unless `CATEGORIZER_MODE=demo_stub`. That
  keeps them out of the way of any environment that's wired up to a real
  Anthropic key — production isn't going to find a /demo button waiting to
  wipe its data.
- `/demo/reset` deletes only rows tagged `source="demo"`. It will never
  drop the seed chart of accounts, model results from real categorize
  calls, or anything imported via /transactions/import.
- `/demo/seed` reuses the existing TransactionRepo write path. No special
  fast paths, no schema bypass.
- `/demo/scenario` is a read-only window onto the shared sample-business
  profile in `ledgerlens.data.sample_scenario`. Safe in any mode.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import TransactionOut
from ledgerlens.config import get_settings
from ledgerlens.data.sample_scenario import SAMPLE_SCENARIO, SampleScenario
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


# Granite State Auto Repair — March 2026 sample bank activity.
#
# Fictional independent auto repair shop in New Hampshire. 42 rows
# spanning a realistic monthly mix: parts, utilities, payroll, software,
# fuel, insurance, ambiguous transfers/cash, and revenue deposits.
#
# The list is deterministic — the same seed call always inserts the same
# rows in the same order. Negative amounts are debits; positive amounts
# are deposits.
#
# Identity (business name, location, month) lives in
# `ledgerlens.data.sample_scenario` so it isn't duplicated in copy.
DEMO_TRANSACTIONS: list[dict[str, object]] = [
    # ── Utilities & operations (early-month bills) ──
    {
        "transaction_date": "2026-03-01",
        "description": "NH PROPERTY MGMT MAR RENT - SHOP",
        "merchant": "NH Property Management",
        "amount_cents": -385000,
    },
    {
        "transaction_date": "2026-03-01",
        "description": "EVERSOURCE ELECTRIC NH",
        "merchant": "Eversource",
        "amount_cents": -68420,
    },
    {
        "transaction_date": "2026-03-01",
        "description": "COMCAST BUSINESS INTERNET MAR",
        "merchant": "Comcast Business",
        "amount_cents": -29900,
    },
    # ── Software / subscriptions ──
    {
        "transaction_date": "2026-03-02",
        "description": "QUICKBOOKS ONLINE PLUS",
        "merchant": "Intuit",
        "amount_cents": -8000,
    },
    # ── Parts & inventory (NAPA / AutoZone / O'Reilly / Advance / LKQ / tire dist) ──
    {
        "transaction_date": "2026-03-02",
        "description": "NAPA AUTO PARTS INV 88421",
        "merchant": "NAPA Auto Parts",
        "amount_cents": -34250,
    },
    {
        "transaction_date": "2026-03-03",
        "description": "SHELL FUEL 03801 NASHUA",
        "merchant": "Shell",
        "amount_cents": -8721,
    },
    {
        "transaction_date": "2026-03-04",
        "description": "MITCHELL1 PRODEMAND SUB",
        "merchant": "Mitchell1",
        "amount_cents": -16900,
    },
    {
        "transaction_date": "2026-03-04",
        "description": "AUTOZONE COMMERCIAL #4471",
        "merchant": "AutoZone Commercial",
        "amount_cents": -18760,
    },
    {
        "transaction_date": "2026-03-04",
        "description": "STRIPE DEPOSIT PAYOUT",
        "merchant": "Stripe",
        "amount_cents": 428400,
    },
    {
        "transaction_date": "2026-03-05",
        "description": "WASTE MANAGEMENT COMMERCIAL",
        "merchant": "Waste Management",
        "amount_cents": -38500,
    },
    # ── Payroll (bi-weekly #1) ──
    {
        "transaction_date": "2026-03-06",
        "description": "ADP PAYROLL BI-WEEKLY",
        "merchant": "ADP",
        "amount_cents": -784230,
    },
    {
        "transaction_date": "2026-03-06",
        "description": "ADP PAYROLL TAX WITHDRAW",
        "merchant": "ADP",
        "amount_cents": -167420,
    },
    {
        "transaction_date": "2026-03-06",
        "description": "O'REILLY AUTO PARTS 4712",
        "merchant": "O'Reilly Auto Parts",
        "amount_cents": -89230,
    },
    # ── Ambiguous (unknown ACH) ──
    {
        "transaction_date": "2026-03-07",
        "description": "ACH TRANSFER VENDOR REF 41281",
        "merchant": None,
        "amount_cents": -67500,
    },
    {
        "transaction_date": "2026-03-08",
        "description": "SQUARE DEPOSIT TRANSFER",
        "merchant": "Square",
        "amount_cents": 212600,
    },
    {
        "transaction_date": "2026-03-09",
        "description": "IRVING OIL 4218 MERRIMACK",
        "merchant": "Irving Oil",
        "amount_cents": -7842,
    },
    {
        "transaction_date": "2026-03-09",
        "description": "ADVANCE AUTO PARTS PO 33812",
        "merchant": "Advance Auto Parts",
        "amount_cents": -14920,
    },
    # ── Utilities (mid-month) ──
    {
        "transaction_date": "2026-03-10",
        "description": "MANCHESTER WATER WORKS",
        "merchant": "Manchester Water Works",
        "amount_cents": -12340,
    },
    # ── Ambiguous (paper check) ──
    {
        "transaction_date": "2026-03-11",
        "description": "CHECK #1042",
        "merchant": None,
        "amount_cents": -45000,
    },
    {
        "transaction_date": "2026-03-11",
        "description": "GOOGLE WORKSPACE BUSINESS",
        "merchant": "Google",
        "amount_cents": -1800,
    },
    {
        "transaction_date": "2026-03-11",
        "description": "CUSTOMER CHECK DEPOSIT 1098",
        "merchant": None,
        "amount_cents": 185000,
    },
    # ── Insurance & finance ──
    {
        "transaction_date": "2026-03-12",
        "description": "HANOVER GARAGE LIABILITY POL 49KF",
        "merchant": "Hanover Insurance",
        "amount_cents": -98500,
    },
    {
        "transaction_date": "2026-03-13",
        "description": "NAPA AUTO PARTS INV 88503",
        "merchant": "NAPA Auto Parts",
        "amount_cents": -67340,
    },
    # ── Ambiguous (Amazon — rule routes to review) ──
    {
        "transaction_date": "2026-03-14",
        "description": "AMAZON MARKETPLACE ORDER 113-44",
        "merchant": "Amazon",
        "amount_cents": -21447,
    },
    {
        "transaction_date": "2026-03-15",
        "description": "CONCORD GROUP HEALTH INS",
        "merchant": "Concord Group",
        "amount_cents": -132400,
    },
    {
        "transaction_date": "2026-03-15",
        "description": "TD BANK BUSINESS LOAN PMT",
        "merchant": "TD Bank",
        "amount_cents": -148200,
    },
    {
        "transaction_date": "2026-03-15",
        "description": "STRIPE PROCESSING FEE",
        "merchant": "Stripe",
        "amount_cents": -8420,
    },
    {
        "transaction_date": "2026-03-15",
        "description": "STRIPE DEPOSIT PAYOUT",
        "merchant": "Stripe",
        "amount_cents": 369200,
    },
    # ── Parts (wholesale tire order) ──
    {
        "transaction_date": "2026-03-17",
        "description": "GRANITE STATE TIRE DIST",
        "merchant": "Granite State Tire Distributor",
        "amount_cents": -184500,
    },
    # ── Ambiguous (Costco — could be shop or personal) ──
    {
        "transaction_date": "2026-03-18",
        "description": "COSTCO WHOLESALE #341",
        "merchant": "Costco",
        "amount_cents": -38712,
    },
    # ── Ambiguous (ATM cash withdrawal — no merchant context) ──
    {
        "transaction_date": "2026-03-19",
        "description": "ATM WITHDRAWAL TD BANK",
        "merchant": None,
        "amount_cents": -20000,
    },
    # ── Payroll (bi-weekly #2) ──
    {
        "transaction_date": "2026-03-20",
        "description": "ADP PAYROLL BI-WEEKLY",
        "merchant": "ADP",
        "amount_cents": -812150,
    },
    {
        "transaction_date": "2026-03-21",
        "description": "LKQ CORPORATION REC PARTS",
        "merchant": "LKQ Corporation",
        "amount_cents": -56720,
    },
    {
        "transaction_date": "2026-03-22",
        "description": "MOBIL MART STATION 117",
        "merchant": "Mobil",
        "amount_cents": -9120,
    },
    {
        "transaction_date": "2026-03-22",
        "description": "CUSTOMER CHECK DEPOSIT 1112",
        "merchant": None,
        "amount_cents": 247500,
    },
    # ── Ambiguous (Venmo to a first name — could be subcontractor or personal) ──
    {
        "transaction_date": "2026-03-23",
        "description": "VENMO PAYMENT - JON",
        "merchant": None,
        "amount_cents": -25000,
    },
    # ── Ambiguous (Home Depot — shop supplies vs personal building repair) ──
    {
        "transaction_date": "2026-03-24",
        "description": "HOME DEPOT #2841 CONCORD",
        "merchant": "Home Depot",
        "amount_cents": -47230,
    },
    # ── Ambiguous (owner transfer to personal account) ──
    {
        "transaction_date": "2026-03-25",
        "description": "OWNER TRANSFER TO PERSONAL",
        "merchant": None,
        "amount_cents": -150000,
    },
    {
        "transaction_date": "2026-03-26",
        "description": "AUTOZONE COMMERCIAL #4471",
        "merchant": "AutoZone Commercial",
        "amount_cents": -29840,
    },
    # ── Ambiguous (Lowe's — shop supplies vs personal) ──
    {
        "transaction_date": "2026-03-28",
        "description": "LOWE'S COMMERCIAL #1142",
        "merchant": "Lowe's",
        "amount_cents": -32100,
    },
    {
        "transaction_date": "2026-03-29",
        "description": "CASH DEPOSIT BRANCH 047",
        "merchant": None,
        "amount_cents": 84500,
    },
    {
        "transaction_date": "2026-03-31",
        "description": "FIRST CITIZENS MERCHANT SVC",
        "merchant": "First Citizens",
        "amount_cents": -4280,
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


@router.get("/scenario")
def demo_scenario() -> SampleScenario:
    """Return the shared sample-business-scenario profile.

    Safe in any mode — read-only, no DB access. Frontends use this to
    render the scenario name and disclaimer without hardcoding strings.
    """
    return SAMPLE_SCENARIO


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
        details={
            "count": len(created),
            "scenario": SAMPLE_SCENARIO["business_name"],
            "cleanup_month": SAMPLE_SCENARIO["cleanup_month"],
        },
    )
    db.commit()
    for tx in created:
        db.refresh(tx)
    return {
        "created": [TransactionOut.model_validate(tx).model_dump() for tx in created],
        "count": len(created),
        "scenario": SAMPLE_SCENARIO["business_name"],
        "cleanup_month": SAMPLE_SCENARIO["cleanup_month"],
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
