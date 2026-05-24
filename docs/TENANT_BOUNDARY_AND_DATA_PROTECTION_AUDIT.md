# Tenant boundary + data protection audit

## 1. Currently business-scoped tables

| Table | `business_id` column | Scoped by API |
|---|---|---|
| `csv_import_profiles` | ✅ (string) | yes — `active_business_id()` |
| `category_mapping_profiles` | ✅ (string) | yes |
| `category_mapping_entries` | via `profile.business_id` | yes |
| `audit_events` | ✅ (string, Phase 2) | yes |
| `tenants`, `businesses`, `users`, `memberships` | — | foundation tables |

## 2. Currently unscoped or partially scoped tables

The four "core workflow" tables that carry actual financial-shaped
data have **no `business_id` column today**:

| Table | Effective scope | Risk |
|---|---|---|
| `transactions` | global | any visitor's imported CSVs share storage with everyone else's |
| `categorization_results` | per-transaction | follows `transactions` |
| `review_decisions` | per-transaction | follows `transactions` |
| `correction_memory` | global | learned-memory rules from one business leak into another's categorize calls |

This is the largest tenant-boundary gap in the codebase.
`AccountCategory` is intentionally global today (the chart of
accounts ships as a single seed); per-business COA is documented
as future work and not part of this sprint.

## 3. Routes that read transaction-like data

| Route | Reads |
|---|---|
| `GET /transactions`, `GET /transactions/{id}` | transactions |
| `GET /review-queue` | categorization_results joined with transactions |
| `GET /ledger`, `GET /ledger/export.csv` | transactions + latest categorization_results + latest review_decisions |
| `GET /handoff`, `GET /handoff/export.md`, `GET /handoff/export.reviewed.csv`, `GET /handoff/export.followup.csv` | full ledger + owner answers |
| `GET /corrections`, `GET /corrections/{id}` | correction_memory |
| `GET /corrections/transactions/{id}/memory-matches` | correction_memory by merchant key |
| `GET /audit-events` | audit_events (already business-scoped) |
| `POST /mapping/preview` | walks every transaction in the workspace |

## 4. Routes that mutate transaction-like data

| Route | Writes |
|---|---|
| `POST /transactions`, `POST /transactions/batch`, `POST /transactions/import` | transactions |
| `POST /categorize`, `POST /categorize/batch` | categorization_results (+ optional correction_memory replay) |
| `POST /review-queue/{tx_id}/{approve,correct,uncategorizable,accountant-review}` | review_decisions, sometimes correction_memory |
| `POST /mapping/apply-preview` | categorization_results (status / predicted code) |
| `POST /demo/seed`, `POST /demo/reset` | transactions, child rows by FK |

## 5. Cross-business leakage risks (today)

1. **CorrectionMemory.** A memory rule created by Business A
   ("Adobe → 6080") wins the next categorize for Business B's
   Adobe row. The matcher looks at `merchant_key` /
   `description_key` only.
2. **Mapping preview/apply.** Walks `db.query(Transaction).all()`
   — would include another business's rows.
3. **Handoff exports.** Build from every transaction in the DB.
4. **Review queue.** Returns every `needs_review` result, not
   just the active business's.
5. **`/transactions` listing.** Returns every transaction.

None of these are exploitable in the current single-tenant demo —
there is only one business. The risk is structural: the moment
auth Phase 2 lands and a second business is created, every read
and write on these tables would silently mix data.

## 6. Audit / event limitations

- `audit_events.business_id` exists and `record_audit_event` sets
  it from the actor. Good.
- But review-decision creation and demo seeding do **not** route
  through `record_audit_event` yet — they call the older
  `AuditRepo.record()` which does not attach the actor / business
  / request_id.
- Existing redaction is a flat key-set strip on `details`. The
  text inside string values (like raw transaction descriptions) is
  not scanned for PII patterns.

## 7. Sensitive-data risks

The redaction surface today:

- `observability.sanitize_for_log()` strips emails / phones /
  long numeric runs / card-like patterns from log lines.
- `services.audit_log._redact()` drops keys named `raw_csv`,
  `account_number`, `secret`, etc. from JSON before persistence.

The gap:

- No single utility that returns *findings* for a piece of text
  (so callers can decide whether to redact or refuse).
- The audit redactor doesn't recursively scan string values for
  the same patterns the log redactor catches.
- Handoff exports include transaction descriptions verbatim
  (intentional — that's the accountant's input), but there is no
  in-process scanner to flag a row whose description looks
  account-number-shaped before it reaches the export.

## 8. What tenant boundary means in this portfolio prototype

After this sprint:

- Every core workflow table carries `business_id`.
- The seed sets `business_id` on every demo row.
- Every read and write through the active service layer
  receives a `business_id` (from `get_demo_actor`) and filters
  on it.
- A regression test creates a second business and proves that
  Business A cannot see, mutate, export, or learn from
  Business B's data.

What this still does **not** give:

- Real authentication. Every visitor still shares the same demo
  actor.
- Per-tenant rate limiting or quota.
- Per-tenant encryption-at-rest keys.
- A signed-cookie session that proves a request came from a
  specific human.
- Backups / restore / retention policy beyond the demo-reset
  story.
- A production-safe deployment surface (the Railway demo
  Postgres has no separate operational tenant).

## 9. What remains short of production multi-tenancy

- Row-level security at the DB layer (Postgres RLS / per-tenant
  views) is **not** implemented. The boundary is enforced in
  Python.
- No per-tenant key separation.
- No "delete all data for tenant X" hard-deletion utility outside
  the demo reset path.
- No cross-region replication / disaster-recovery plan.

## 10. Implementation plan

A. Schema migration: add nullable `business_id` to
   `transactions`, `categorization_results`, `review_decisions`,
   `correction_memory`. Backfill existing rows to the seeded
   Granite State business via Alembic `op.execute`. Indexes on
   each + a compound `(business_id, transaction_id)` on
   `categorization_results` / `review_decisions`.

B. Seed and demo flows always populate `business_id`. Existing
   `demo_seed` populates it on every inserted transaction.

C. Service layer: every helper that touches the four tables
   accepts an `active_business_id` and filters on it. The actor
   dependency provides this for API routes.

D. API layer: every mutation depends on `get_demo_actor` (already
   wired for mapping / import-profiles / session); extend to
   review, categorize, corrections, handoff exports.

E. New `tests/api/test_tenant_boundary.py` creates Business A +
   Business B, seeds workspace data for each, and proves no
   leakage on reads / writes / handoff exports / correction
   memory / mapping apply.

F. Consolidate the redaction utilities into
   `services/sensitive_data.py`. `record_audit_event` switches
   to it for both key drops and string-scan redaction.

G. Retention/deletion: backend service `delete_demo_business_data`
   that wipes the four core tables for a single business id
   inside the existing `/demo/reset` route, plus a runbook for
   manual repair.

H. Docs: backup/restore runbook, accounting-system export
   readiness, market-positioning wedge, sprint review.

## 11. Acceptance criteria

1. Migration adds `business_id` columns; backfill is safe on
   the existing Railway demo DB (data is fictional, so an
   "assign all unscoped rows to Granite State" backfill is
   acceptable and documented as demo-only).
2. Fresh-DB seed creates only scoped rows.
3. Mapping preview, mapping apply, handoff exports, review
   queue, and correction-memory lookups all filter by
   `business_id`.
4. A regression test creates two businesses and proves no
   leakage on every read / write / export path.
5. The audit service uses the consolidated sensitive-data
   utility.
6. The demo-reset endpoint reuses the new
   `delete_demo_business_data` service.
7. Five new doc files exist with no overclaim.
8. Tests + lint + mypy + build all pass.
9. No public-demo warning is removed; no production-readiness
   claim is added.
