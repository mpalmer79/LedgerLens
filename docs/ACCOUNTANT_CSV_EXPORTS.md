# Accountant CSV exports

## 1. Export types added

This sprint adds two new endpoints in addition to the existing
ledger export:

| Endpoint | Contents | Filename |
|---|---|---|
| `GET /handoff/export.reviewed.csv` | Finalized + verified rows formatted for accountant review. | `reviewed_categorization.csv` |
| `GET /handoff/export.followup.csv` | Owner-flagged accountant-review rows + pending rows the model could not finalize. | `followup_required.csv` |
| `GET /ledger/export.csv` (existing) | Every row in the workspace, with `verified` column. | `ledger.csv` |
| `GET /handoff/export.md` (existing) | Markdown handoff package. | `<scenario>_handoff.md` |

## 2. Columns included

Both new CSVs use the same column set so an accountant can import
either without remapping:

- `Date`
- `Description`
- `Merchant`
- `Amount`
- `Currency`
- `Suggested Category`
- `Category Code`
- `Review Status`
- `Verification Source` — plain-English: `human-reviewed`,
  `correction-memory replay`, `deterministic rule`, or the raw
  provider name.
- `Owner Answer` — the labelled answer from `/questions` (e.g. "Shop
  inventory", "Needs accountant review").
- `Owner Note` — free-text note the owner added.
- `Accountant Follow-Up Required` — boolean.
- `Source` — `csv_import`, `demo`, `api`, etc.
- `Transaction ID` — the internal id, in case the accountant wants
  to reference it later.

## 3. What the exports are for

- **`reviewed_categorization.csv`** — the accountant's primary
  working file. Every row is finalized and verified per the trust
  metric. The accountant can pattern-match the categories against
  their books, flag anything that looks wrong, and reply via the
  handoff thread.
- **`followup_required.csv`** — the open-questions file. Every row
  here either:
  - Was explicitly flagged by the owner ("Needs accountant
    review"), or
  - Could not be finalized by the model and has no human decision
    yet.
- **`ledger.csv`** (existing) — the complete categorization data set.
  Includes excluded rows, pending rows, follow-up rows, and ready
  rows.

## 4. What they are not

- **Not a true accounting ledger.** No double-entry, no GL accounts,
  no journal entries.
- **Not a QuickBooks / QBO / IIF import file.** The column names are
  human-readable. They do not match QuickBooks' import schemas.
- **Not tax advice.** The standard handoff disclaimer applies.
- **Not a substitute for accounting review.** Every row needs an
  accountant to verify against the actual COA before posting to real
  books.

The frontend handoff copy on `/handoff` explicitly states:

> CSV formatted for accountant review. Includes only finalized +
> verified rows, with owner answers and verification source inline.
> Not a QuickBooks import file.

## 5. Why this is not a QBO/IIF import

QBO XML and IIF have rigid schemas:

- QBO requires a wrapped `<QBXML>` envelope with `<TransactionAddRq>`
  payloads. Each line item references a QuickBooks-internal account
  list, not a name-string.
- IIF (legacy) is tab-separated with `!TRNS` / `!SPL` / `!ENDTRNS`
  control rows. Account names must match exactly what's in the
  target file.

Both formats would require:

1. A persisted mapping from LedgerLens COA codes to the accountant's
   QuickBooks list ids.
2. Decisions about what to do with rows that have no clean target
   (excluded, follow-up).
3. Tests against a real QuickBooks file.

None of those are in scope this sprint. The CSV's column set is the
accountant-friendly bridge in the meantime.

## 6. Follow-up / unresolved row handling

`followup_required.csv` is intentionally separate so the accountant
does not have to filter `reviewed_categorization.csv`.

A row appears in the follow-up CSV when its status is one of:

- `accountant_review_required` (owner-flagged)
- `needs_review` (model could not finalize)

A row never appears in both files. Rows in
`accountant_review_required` take precedence and are listed first in
the follow-up CSV.

Once an accountant resolves a flagged row by submitting a correct or
approve decision through LedgerLens, that row will move into
`reviewed_categorization.csv` on the next export.
