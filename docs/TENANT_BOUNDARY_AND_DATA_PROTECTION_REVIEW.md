# Tenant boundary + data protection sprint — review

Status: shipped on branch `feat/tenant-boundary-and-data-protection`.
Companion to `docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_AUDIT.md`
(the pre-sprint audit).

## What shipped

### 1. Schema: `business_id` on the four core workflow tables

Migration `5d5603a94bf4_business_id_on_core_workflow_tables` adds a
nullable, indexed `business_id` column to:

- `transactions`
- `categorization_results`
- `review_decisions`
- `correction_memory`

The column is nullable in the DB so the migration can backfill demo
rows safely; the service layer treats it as **required** for every
new write. The migration backfills the demo's seeded business id onto
existing rows when the public demo's Granite State business is
present, and is a no-op on fresh DBs.

### 2. Service-layer scoping

Every read and write of the four core workflow tables now filters or
sets `business_id`:

- `TransactionRepo.get_for_business`, `list_for_business`
- `CategorizationRepo.list_by_status(..., business_id=...)`
- `CorrectionMemoryRepo.find_for_keys`, `find_exact`, `list`, `count`,
  `get_for_business` — all take `business_id`
- `services/correction_memory.py::find_memory_match` now passes
  `tx.business_id` through to the repo lookup
- `services/correction_memory.py::record_correction_memory` writes
  `business_id=tx.business_id`
- `services/categorize.py` — all five `CategorizationResult(...)`
  construction sites set `business_id=tx.business_id`
- `services/mapping_preview.py::preview_mapping_change` requires
  `business_id` and scopes both the Transaction walk and the
  CategorizationResult/ReviewDecision lookups
- `services/handoff.py::build_handoff(db, business_id)`, plus
  internal `_owner_answers` and `_recent_corrections` helpers
- `api/ledger.py::_build_rows(db, business_id)` and both `/ledger`
  endpoints
- `api/review.py` — `_latest_or_404` takes `business_id`; every route
  has an actor dep; `list_queue` is fully tenant-scoped
- `api/handoff.py` — every export endpoint takes the actor and
  forwards `actor.business_id`
- `api/corrections.py` — every read and write uses
  `get_for_business` / `business_id=actor.business_id`
- `api/transactions.py` — `list_transactions` and `get_transaction`
  filter by `actor.business_id`
- `api/mapping.py::apply_preview` — server-side eligibility recompute
  reads transactions and categorization results scoped to the actor

Two namespaces of "business id" exist in the codebase: the rule-map
slug (`active_business_id()`) used by `data/business_rule_maps.py` and
the mapping profile, and the actor's `Business.id` PK used by the
four core workflow tables. They are not unified in this sprint; the
mapping profile + rule map continue to use the slug, and the workflow
tables use the actor's id. This is called out in the `get_profile`
docstring; unification is left for a follow-up.

### 3. Tenant-boundary regression tests

`backend/tests/api/test_tenant_boundary.py` plants a second tenant +
business in the test DB and seeds a full transaction →
categorization → review → correction-memory chain under each business,
then asserts that none of Business B's rows are reachable through:

- `GET /transactions`, `GET /transactions/{id}`
- `GET /review-queue`, `POST /review-queue/{id}/approve`,
  `POST /review-queue/{id}/correct`
- `GET /corrections`, `GET /corrections/{id}`,
  `PATCH /corrections/{id}`, `DELETE /corrections/{id}`
- `GET /transactions/{id}/memory-matches`
- `GET /ledger`, `GET /ledger/export.csv`
- `GET /handoff`, `GET /handoff/export.md`
- `POST /mapping/apply-preview`

…and that `services/correction_memory.find_memory_match` does not
match a Business A transaction against a Business B memory row even
when the merchant_key + description_key are identical.

16 tests; all pass.

### 4. Sensitive-data redaction consolidation

`backend/src/ledgerlens/services/sensitive_data.py` is the new single
source of truth for "do not log or store this verbatim":

- Free-text scrubbing (`redact_pii_text`) — emails, phones, card-like
  groups, long digit runs, US SSN / EIN, control chars, truncation.
- `FORBIDDEN_KEYS` denylist for the audit-event JSON.
- `redact_forbidden_keys(value)` recursive cleaner.

`observability.sanitize_for_log` and `services/audit_log._redact` now
re-export from this module for back-compat.

### 5. Tenant-scoped data deletion primitive

`backend/src/ledgerlens/services/data_retention.py` exposes
`delete_business_workflow_data(db, business_id, commit=False)`,
returning a `DeletionSummary` with row counts per table. Empty
`business_id` is rejected on purpose — no "delete everything" mode.

### 6. Documentation

- `docs/BACKUP_RESTORE_AND_RETENTION_RUNBOOK.md` — operator-facing
  runbook with an honest "we do not yet promise this" section.
- `docs/ACCOUNTING_SYSTEM_EXPORT_READINESS.md` — QBO + Xero
  integration research (planning, no code).
- `docs/MARKET_POSITIONING_AND_COMPETITIVE_WEDGE.md` — narrow
  positioning doc that links back to the honesty contracts in
  `SECURITY_AND_PRODUCTION_READINESS.md`.
- `docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_AUDIT.md` — pre-sprint
  audit (already shipped).
- This review doc.

## Honesty contracts preserved

- Public demo warnings on `/transactions/import`, `/start`, `/audit`,
  `/handoff`, README — untouched.
- Fictional-sample disclaimer in the handoff scenario — untouched.
- "Not tax advice" language in the handoff markdown footer — untouched.
- Demo-stub mode still routes around Anthropic; no new paid calls.
- No "true accounting ledger," "production SaaS," "encryption at
  rest," or "safe for real bank data" claim introduced anywhere.
- No email / phone / mailto / tel link added.

## What this sprint deliberately did NOT do

- **Did not unify the two business-id namespaces.** The mapping
  profile / rule map still use the slug; workflow tables use the
  actor's PK. Unification is a separate refactor — calling that out
  loudly in `get_profile` docstring is the honest mid-state.
- **Did not add a /security-and-limitations UI page.** Optional Phase
  13; deferred. The same content lives in
  `SECURITY_AND_PRODUCTION_READINESS.md` and is linked from the
  audit + this review.
- **Did not wire `delete_business_workflow_data` into a new public
  endpoint.** The primitive is shipped and unit-tested; surfacing it
  in `/demo/reset` (which already targets `source='demo'` rows) is a
  small follow-up that does not change behavior today.
- **Did not implement QBO/Xero push.** That is explicitly research-only
  in this sprint; see the export readiness doc.

## Test counts after this sprint

- Backend: 348 tests (was 315 entering this sprint — +33: tenant
  boundary, sensitive data, data retention).
- Frontend: unchanged.

## Files touched

Production code:

- `backend/alembic/versions/5d5603a94bf4_business_id_on_core_workflow_tables.py` (new)
- `backend/src/ledgerlens/models/{transaction,categorization_result,review_decision,correction_memory}.py`
- `backend/src/ledgerlens/repositories/{transactions,categorization,correction_memory}.py`
- `backend/src/ledgerlens/services/{categorize,correction_memory,handoff,mapping_preview,audit_log}.py`
- `backend/src/ledgerlens/services/{sensitive_data,data_retention}.py` (new)
- `backend/src/ledgerlens/api/{transactions,review,corrections,ledger,handoff,mapping,demo}.py`
- `backend/src/ledgerlens/observability.py`

Tests:

- `backend/tests/api/test_tenant_boundary.py` (new)
- `backend/tests/test_sensitive_data.py` (new)
- `backend/tests/test_data_retention.py` (new)

Docs:

- `docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_AUDIT.md`
- `docs/TENANT_BOUNDARY_AND_DATA_PROTECTION_REVIEW.md`
- `docs/BACKUP_RESTORE_AND_RETENTION_RUNBOOK.md`
- `docs/ACCOUNTING_SYSTEM_EXPORT_READINESS.md`
- `docs/MARKET_POSITIONING_AND_COMPETITIVE_WEDGE.md`
