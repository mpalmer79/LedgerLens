# Backup, restore, and retention runbook

This runbook is the honest, current state of how LedgerLens treats
operator data. It is **not** a managed backup product or a regulated
retention policy — the public demo runs on a single ephemeral
environment and the README + `SECURITY_AND_PRODUCTION_READINESS.md`
warn against putting real bank data into it.

The runbook exists so a future operator (or a real-tenant migration)
has a written procedure to follow instead of inventing one under
pressure.

## 1. What gets stored

| Class of data | Storage | Retention default | Notes |
|---|---|---|---|
| Tenant scaffolding (`tenants`, `businesses`, `users`, `memberships`) | Postgres | indefinite | Seeded once; rarely changes. |
| Workflow data (`transactions`, `categorization_results`, `review_decisions`, `correction_memory`) | Postgres | indefinite | All four now carry `business_id`; see `docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_AUDIT.md`. |
| Mapping/profile data (`category_mapping_profiles`, `category_mapping_entries`, `csv_import_profiles`) | Postgres | indefinite | Scoped per business. |
| Audit trail (`audit_events`) | Postgres | indefinite | Append-only; preserved across data deletions on purpose. |
| Categorization request/response logs | structured app logs | provider-controlled | Free-text fields are pre-redacted via `services/sensitive_data.py`. |
| Anthropic API calls (when not in demo-stub mode) | provider | provider-controlled | Subject to Anthropic's retention policy. |

## 2. Backup model

The Railway-hosted public demo Postgres is backed up by the provider on
their default schedule. **We do not currently take or store our own
backups.** That is acceptable for a fictional-data demo. A real-tenant
deployment must add:

- Encrypted off-platform snapshots (pgBackRest / WAL-G / managed
  service backup).
- A documented recovery-point objective (RPO) and recovery-time
  objective (RTO) agreed with the operator.
- A periodic restore drill that verifies the snapshots are usable.

Until those are in place, the right honest claim is "this is a public
demo; do not rely on it for backup of bookkeeping records."

## 3. Restore procedure (operator-side)

For the current single-environment demo, restoration means re-running
the deterministic seed, not recovering operator data:

```bash
# 1. Provision a fresh Postgres (Railway or local).
# 2. Apply schema:
alembic upgrade head
# 3. Re-seed the demo tenant + chart of accounts:
python -m ledgerlens.scripts.bootstrap_demo   # idempotent
# 4. Optionally re-seed the demo transactions:
curl -X POST $BASE_URL/demo/seed
```

A future tenant deployment replaces step 3+4 with the operator's
provider-managed snapshot restore.

## 4. Deleting one business's workflow data

`services/data_retention.py::delete_business_workflow_data` is the
deterministic primitive for this. It deletes every row across the four
core workflow tables that carries the supplied `business_id`, in
FK-safe order. Audit events are intentionally **kept** — the audit
trail is the record that the deletion happened.

Usage from a script or a future close-account flow:

```python
from sqlalchemy.orm import Session
from ledgerlens.services.data_retention import delete_business_workflow_data

def close_account(db: Session, business_id: str) -> None:
    summary = delete_business_workflow_data(
        db, business_id=business_id, commit=True
    )
    # surface summary.total_rows back to the operator
```

A `None`/empty `business_id` is rejected: there is no "delete
everything" mode here on purpose. Cross-tenant erasure requires an
explicit caller loop over every business id.

## 5. What this runbook does NOT promise

- **Encryption at rest** beyond what the hosting provider offers. We
  do not configure or audit disk encryption today.
- **Right-to-erasure SLAs.** There is no production GDPR/CCPA
  workflow; the deletion primitive above is a building block, not a
  user-facing flow.
- **Tamper-evident audit logs.** `audit_events` is an append-only
  table by convention, not enforced cryptographically.
- **Cross-region replication.** Single-region only.
- **PII inventory.** We do not catalogue which fields hold PII. The
  redaction floor in `services/sensitive_data.py` is what we trust.

Any of those guarantees must be added (and the docs updated) before
LedgerLens accepts real bank or customer data.
