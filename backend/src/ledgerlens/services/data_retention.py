"""Tenant-scoped data deletion foundation.

This module is the data-retention/deletion building block the production
tenant lifecycle will eventually need (close-account, GDPR/CCPA erasure
request, demo-cleanup). It is **not** yet a regulated-data erasure
flow — the public demo runs in a single ephemeral environment that
makes no production-data claims (see
``docs/SECURITY_AND_PRODUCTION_READINESS.md``). The function below is
the deterministic primitive higher-level flows can compose.

Scope of v1:

- Deletes every Transaction row scoped to ``business_id``.
- Deletes the CategorizationResult, ReviewDecision, and CorrectionMemory
  rows linked to those transactions (FK-safe order).
- Leaves the AuditEvent trail in place. Audit events are an append-only
  record of who-did-what; preserving them across a data deletion is by
  design. Operators who need to also purge audit data should remove the
  matching AuditEvent rows in a separate, explicit step.
- Leaves the Business/Tenant/User/Membership rows in place. The function
  scrubs **workflow data**, not the tenant scaffolding.

A ``None`` ``business_id`` is rejected. We never want a cross-tenant
"delete everything not yet assigned" operation to run by accident; the
caller must be explicit.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ledgerlens.models import (
    CategorizationResult,
    CorrectionMemory,
    ReviewDecision,
    Transaction,
)


@dataclass(frozen=True)
class DeletionSummary:
    """Counts emitted by ``delete_business_workflow_data``.

    Each field is the number of rows deleted from the named table.
    Surface this back to the operator so they can verify the scope.
    """

    business_id: str
    deleted_transactions: int
    deleted_categorization_results: int
    deleted_review_decisions: int
    deleted_correction_memory: int

    @property
    def total_rows(self) -> int:
        return (
            self.deleted_transactions
            + self.deleted_categorization_results
            + self.deleted_review_decisions
            + self.deleted_correction_memory
        )


def delete_business_workflow_data(
    db: Session, *, business_id: str, commit: bool = False
) -> DeletionSummary:
    """Delete all workflow rows scoped to ``business_id``.

    FK-safe order:

    1. CategorizationResult (refs Transaction)
    2. ReviewDecision       (refs Transaction + CategorizationResult)
    3. CorrectionMemory     (refs Transaction + ReviewDecision)
    4. Transaction          (parent)

    Audit events are intentionally **not** deleted — they record the
    fact that a delete happened. The Business/Tenant/Membership rows
    are also left untouched.
    """
    if not business_id:
        raise ValueError(
            "delete_business_workflow_data requires an explicit business_id "
            "to avoid accidental cross-tenant erasure."
        )

    # 1. Categorization results (must come before Transaction; their tx
    #    rows may still be referenced by CorrectionMemory.source_transaction_id).
    cat_result = db.execute(
        delete(CategorizationResult).where(CategorizationResult.business_id == business_id)
    )

    # 2. Review decisions.
    rev_result = db.execute(delete(ReviewDecision).where(ReviewDecision.business_id == business_id))

    # 3. Correction memory rows. We delete by business_id (the row's own
    #    tenant scope) rather than by source_transaction_id, so legacy
    #    rows authored without a source link still get removed.
    mem_result = db.execute(
        delete(CorrectionMemory).where(CorrectionMemory.business_id == business_id)
    )

    # 4. Transactions themselves.
    tx_result = db.execute(delete(Transaction).where(Transaction.business_id == business_id))

    summary = DeletionSummary(
        business_id=business_id,
        deleted_transactions=int(tx_result.rowcount or 0),
        deleted_categorization_results=int(cat_result.rowcount or 0),
        deleted_review_decisions=int(rev_result.rowcount or 0),
        deleted_correction_memory=int(mem_result.rowcount or 0),
    )
    db.flush()
    if commit:
        db.commit()
    return summary


__all__ = ["DeletionSummary", "delete_business_workflow_data"]
