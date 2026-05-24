# CSV import wizard audit

## 1. Current import behavior

`POST /transactions/import` (`backend/src/ledgerlens/api/transactions.py`)
accepts a `multipart/form-data` upload with one `file` field. The
backend:

- Reads CSV with stdlib `csv.DictReader`, UTF-8-sig + Latin-1
  fallback.
- Normalizes headers (case-insensitive, trims whitespace).
- Maps aliases: `date / transaction_date / posted_date` →
  `transaction_date`; `description / memo` → `description`;
  `merchant / payee` → `merchant`; `amount / amount_usd` →
  `amount`; `currency`; `source`.
- Per-row validation: required `transaction_date` + `description` +
  `amount`; supported date formats `%Y-%m-%d`, `%m/%d/%Y`,
  `%m/%d/%y`, `%d/%m/%Y`; amounts may use parentheses for negatives
  (`(150.00)` → `-150.00`); currency symbols and commas stripped.
- **Amount sign convention: negative = outflow / expense, positive
  = inflow / revenue.** Amount is in dollars at the wire; backend
  converts to `amount_cents`.
- File size limit: **5 MB.** Row limit: **5,000 rows.**
- Returns `CsvImportSummary` (received_rows / created / errors /
  transactions).

## 2. Current UX weaknesses

- Owner has to know the exact column names LedgerLens accepts.
- The "paste CSV" textarea + "upload file" radio combo reads as a
  developer tool, not a small-business workflow.
- Single shot: no preview of what was parsed before the import
  fires.
- No way to map a real-bank-export's "Posted Date / Debit / Credit"
  shape into LedgerLens's expected single-signed-amount shape.
- No mobile-first treatment.
- Sample CSV is embedded as a string in the page component
  (`SAMPLE_CSV`); the download works but lives inline.

## 3. Existing backend constraints

- Single endpoint, single column shape (`transaction_date`,
  `description`, `amount`, etc.).
- No "debit / credit" split awareness on the backend — it expects
  a **single signed amount column.**
- 5 MB / 5,000 row caps.
- Returns row-level errors as `{row, error, message}` triples.

## 4. Required normalized transaction fields

| Field | Source | Notes |
|---|---|---|
| `transaction_date` | Required | Parseable date; multiple formats supported. |
| `description` | Required | Non-empty. |
| `amount` (signed, dollars) | Required | Negative = expense, positive = revenue. |

## 5. Optional normalized transaction fields

| Field | Notes |
|---|---|
| `merchant` | If omitted, backend extracts from description. |
| `currency` | Defaults to `USD`. |
| `source` | Defaults to `csv_import`. Wizard may set it to `wizard`. |

`memo`, `reference`, `account` are not currently consumed by the
backend. The wizard can capture them and either drop them or fold
them into the description; for v1 we'll drop them with a friendly
note ("memo column ignored — not currently used by the categorizer").

## 6. What can be done client-side

**Almost everything.** The wizard:

1. Parses the user's CSV client-side with a small library
   (Papa Parse — adds ~30 KB gzipped, widely used, no DOM
   dependencies).
2. Detects column candidates from common bank-export headers.
3. Lets the owner confirm or override the mapping.
4. Detects amount mode (single signed column vs. separate
   debit/credit columns).
5. Builds normalized in-memory rows.
6. Validates each row with friendly messages.
7. Generates a **normalized CSV blob** (with the exact columns
   the existing backend endpoint expects: `transaction_date,
   description, amount, merchant, currency, source`) and submits
   via the existing `importCsv()` function.
8. Shows the existing `CsvImportSummary` response in a polished
   panel + next-step CTAs.

## 7. What requires backend changes

**None.** The plan is to use the existing `/transactions/import`
endpoint untouched. The wizard performs all mapping and
normalization in the browser; the backend sees a perfectly-shaped
CSV. This:

- Avoids any new request schema.
- Avoids a new auth surface.
- Avoids any migration / new endpoint risk.
- Keeps the option open to add a JSON-array import endpoint later
  if performance or mobile-data-cost becomes a concern.

## 8. What is intentionally out of scope

- **Real bank-feed integration** (Plaid, Yodlee, MX). Public demo
  doesn't ship credentials.
- **Authenticated multi-tenant import.** Phase A of
  `SECURITY_AND_PRODUCTION_READINESS.md`.
- **Storing import mapping profiles** ("TD Bank Personal
  Checking → date in column 0, description in column 4…"). Listed
  in `SMALL_BUSINESS_UX_ROADMAP.md` as a v2 enhancement; needs
  per-tenant storage.
- **Bulk-edit / pre-import categorization.** The wizard hands rows
  off to the categorize pipeline; the cleanup flow takes over.
- **Multi-currency normalization.** Out of scope per
  `ACCOUNTING_DOMAIN_BOUNDARY.md`.
- **Split transactions during import.** Out of scope per the
  domain boundary.
- **Server-side mapping wizard.** Pure client-side keeps the
  endpoint simple and lets the wizard work even when the user is
  on a slow phone connection.

## 9. Risks and guardrails

| Risk | Mitigation |
|---|---|
| Owner uploads real bank data | Prominent demo-warning panel above the wizard + a second reminder on the confirm-import step. |
| Owner uploads a 50 MB CSV that crashes the parser | Client-side file size cap of **1 MB**; reject with friendly error. Backend's 5 MB cap is a backstop. |
| Owner uploads a non-CSV (PDF / XLSX) | Reject by MIME type + extension; show a plain-English error. |
| Owner uploads a CSV with both `Debit` and `Credit` populated on the same row | Flag the row as invalid; explain it's ambiguous; offer to skip those rows. |
| Owner's date format is unusual | Use the backend's existing date-format support (`%Y-%m-%d`, `%m/%d/%Y`, `%m/%d/%y`, `%d/%m/%Y`); show a clear error for unsupported formats. |
| Owner's amount column has parentheses like `(150.00)` | Wizard interprets parentheses as negative before submission; backend also supports this. |
| Wizard auto-detection picks the wrong column | Auto-detect is always a suggestion; the dropdown is always editable; the column-mapping step doesn't progress until the user explicitly confirms. |

## 10. Acceptance criteria

- ✅ Wizard parses real-bank-shaped CSVs (with Posted Date /
  Debit / Credit columns) without forcing the user to rename
  headers.
- ✅ The existing `/transactions/import` endpoint is used unchanged.
- ✅ Demo warning is visible at the start of the upload step and
  again on the confirm-import step.
- ✅ Sample CSV download lands a `granite-state-bank-sample.csv`
  with debit/credit columns owners can practice the mapping
  wizard on.
- ✅ Mobile-first layout: dropzone fills the screen, table scrolls
  inside a contained wrapper, buttons stack cleanly.
- ✅ Adds Papa Parse as a dependency (small, widely used,
  zero-runtime-cost-when-tree-shaken).
- ✅ Backend test count unchanged (no backend changes).
- ✅ Frontend test count rises with parsing / mapping /
  normalization unit tests + component-shape tests.
- ✅ Existing import flow (paste textarea / file upload through the
  raw form) still works as a fallback.
