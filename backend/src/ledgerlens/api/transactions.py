import csv
import io
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from ledgerlens.actor import DemoActor, get_demo_actor
from ledgerlens.api.schemas import (
    CsvImportSummary,
    TransactionBatchIn,
    TransactionBatchOut,
    TransactionIn,
    TransactionListOut,
    TransactionOut,
)
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound, ValidationFailed
from ledgerlens.models import Transaction
from ledgerlens.repositories import AuditRepo, TransactionRepo
from ledgerlens.services.normalize import extract_merchant, normalize_description

router = APIRouter(prefix="/transactions", tags=["transactions"])

# CSV import guardrails.
MAX_CSV_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_CSV_ROWS = 5000


def _to_model(payload: TransactionIn, business_id: str | None = None) -> Transaction:
    raw = payload.description
    normalized = normalize_description(raw)
    return Transaction(
        business_id=business_id,
        transaction_date=payload.transaction_date,
        description=payload.description,
        raw_description=raw,
        normalized_description=normalized,
        merchant=payload.merchant or extract_merchant(normalized),
        amount_cents=payload.amount_cents,
        currency=payload.currency,
        source=payload.source,
    )


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    payload: TransactionIn,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> TransactionOut:
    tx = TransactionRepo(db).add(_to_model(payload, business_id=actor.business_id))
    AuditRepo(db).record(
        entity_type="transaction",
        action="created",
        entity_id=tx.id,
        details={"source": tx.source, "amount_cents": tx.amount_cents},
    )
    db.commit()
    db.refresh(tx)
    return TransactionOut.model_validate(tx)


@router.post("/batch", response_model=TransactionBatchOut, status_code=201)
def create_batch(
    payload: TransactionBatchIn,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> TransactionBatchOut:
    created: list[Transaction] = []
    errors: list[dict[str, object]] = []
    for i, item in enumerate(payload.transactions):
        try:
            created.append(
                TransactionRepo(db).add(_to_model(item, business_id=actor.business_id))
            )
        except Exception as exc:  # noqa: BLE001
            errors.append({"index": i, "error": type(exc).__name__, "message": str(exc)})
    if created:
        AuditRepo(db).record(
            entity_type="transaction",
            action="batch_created",
            details={"count": len(created), "errors": len(errors)},
        )
    db.commit()
    return TransactionBatchOut(
        created=[TransactionOut.model_validate(t) for t in created],
        errors=errors,
    )


@router.get("", response_model=TransactionListOut)
def list_transactions(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> TransactionListOut:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    items = (
        db.query(Transaction)
        .filter(Transaction.business_id == actor.business_id)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = (
        db.query(Transaction)
        .filter(Transaction.business_id == actor.business_id)
        .count()
    )
    return TransactionListOut(
        total=total,
        items=[TransactionOut.model_validate(t) for t in items],
    )


@router.get("/{tx_id}", response_model=TransactionOut)
def get_transaction(
    tx_id: str,
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> TransactionOut:
    tx = (
        db.query(Transaction)
        .filter(Transaction.id == tx_id, Transaction.business_id == actor.business_id)
        .one_or_none()
    )
    if not tx:
        raise NotFound("transaction", tx_id)
    return TransactionOut.model_validate(tx)


# ── CSV import ──────────────────────────────────────────────────────────────


def _parse_csv_date(value: str) -> date:
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"unrecognized date format: {value!r}")


def _parse_amount_cents(value: str) -> int:
    cleaned = value.strip().replace("$", "").replace(",", "").replace(" ", "")
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = "-" + cleaned[1:-1]
    return int(round(float(cleaned) * 100))


_FIELD_ALIASES = {
    "date": "transaction_date",
    "transaction_date": "transaction_date",
    "posted_date": "transaction_date",
    "description": "description",
    "memo": "description",
    "merchant": "merchant",
    "payee": "merchant",
    "amount": "amount",
    "amount_usd": "amount",
}


@router.post("/import", response_model=CsvImportSummary, status_code=201)
async def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: DemoActor = Depends(get_demo_actor),
) -> CsvImportSummary:
    raw = await file.read()
    if len(raw) > MAX_CSV_BYTES:
        raise ValidationFailed(f"CSV exceeds size limit of {MAX_CSV_BYTES} bytes", size=len(raw))
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValidationFailed("CSV has no header row")

    # Normalize headers to known field names.
    header_map = {
        (h or "").strip().lower(): _FIELD_ALIASES.get((h or "").strip().lower())
        for h in reader.fieldnames
    }
    unknown = [h for h, alias in header_map.items() if alias is None and h]
    if unknown:
        # Tolerate extra columns; just don't read them. Don't fail.
        pass

    errors: list[dict[str, object]] = []
    rows: list[TransactionIn] = []
    for row_idx, row in enumerate(reader, start=1):
        if row_idx > MAX_CSV_ROWS:
            errors.append({"row": row_idx, "error": "row_limit_exceeded"})
            break
        try:
            mapped = {
                alias: (row.get(orig) or "").strip()
                for orig, alias in header_map.items()
                if alias is not None
            }
            tx = TransactionIn(
                transaction_date=_parse_csv_date(mapped.get("transaction_date") or ""),
                description=mapped.get("description") or "",
                merchant=mapped.get("merchant") or None,
                amount_cents=_parse_amount_cents(mapped.get("amount") or "0"),
                source="csv_import",
            )
            rows.append(tx)
        except Exception as exc:  # noqa: BLE001
            errors.append({"row": row_idx, "error": type(exc).__name__, "message": str(exc)})

    received_rows = row_idx if "row_idx" in dir() else 0

    repo = TransactionRepo(db)
    created_models = [repo.add(_to_model(r, business_id=actor.business_id)) for r in rows]
    AuditRepo(db).record(
        entity_type="transaction",
        action="csv_imported",
        details={
            "received_rows": received_rows,
            "created": len(created_models),
            "errors": len(errors),
            "filename": file.filename,
        },
    )
    db.commit()

    return CsvImportSummary(
        received_rows=received_rows,
        created=len(created_models),
        errors=errors,
        transactions=[TransactionOut.model_validate(t) for t in created_models],
    )
