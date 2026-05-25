# Split transaction foundation

## What this is

A `TransactionSplitLine` model and service that lets an owner or
reviewer split a single bank transaction across multiple categories
for the accountant handoff.

Example: An Amazon order of $100 might be split into:
- $60 → Shop Supplies (6060)
- $40 → Fuel/Vehicle (6130)

## What this is NOT

- Not double-entry accounting.
- Not automatic. Splits are human-entered (owner review or
  accountant follow-up).
- Not a ledger. The accountant takes the split lines and books
  the offsetting entries in their system.
- Not tax advice.

## Data model

`TransactionSplitLine` in `transaction_split_lines` table:

| Field | Type | Notes |
|---|---|---|
| id | string PK | `spl_` prefix |
| transaction_id | FK → transactions | Parent transaction |
| business_id | string, indexed | Tenant scope |
| line_index | integer | Order within the split |
| amount_cents | integer | Split line amount |
| category_code | string, nullable | From active COA |
| category_name | string, nullable | Resolved at creation |
| note | string, nullable | Free text (max 512) |
| source | string | `owner_review`, `accountant_follow_up`, etc. |
| created_at | datetime | |
| updated_at | datetime | |

## Validation rules

1. Sum of split amounts must equal the parent transaction amount for
   the split to be considered **complete**.
2. Incomplete splits are allowed but flagged — they route to
   follow-up in the handoff.
3. Category codes must exist in the active chart of accounts.
4. Lines must share the parent transaction's `business_id`.
5. Cross-business split access is blocked.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/transactions/{id}/splits` | List split lines + validation |
| PUT | `/transactions/{id}/splits` | Replace all lines (atomic) |
| DELETE | `/transactions/{id}/splits` | Remove all lines |

All endpoints are business-scoped via the actor dependency. Audit
events are recorded for create/update/delete.

## Tests

9 tests covering: create, list, validate complete/incomplete, replace,
delete, cross-business isolation, invalid category rejection, raw
description preservation.
