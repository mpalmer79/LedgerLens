# CSV import mapping wizard

A five-step wizard at `/transactions/import` that turns a real-bank-shaped
CSV into the normalized format LedgerLens's existing
`POST /transactions/import` endpoint expects. Designed so a small-business
owner can do the import on a phone without knowing the backend's column
schema.

## 1. Why the wizard was added

The previous `/transactions/import` page accepted a CSV with a fixed
column schema (`transaction_date · description · merchant · amount ·
currency · source`) and let the user either upload a file or paste raw
text. That works for a developer; it doesn't work for an owner who just
downloaded a `Posted Date / Description / Debit / Credit / Account /
Reference` export from their bank's website.

The senior productization review explicitly named this as the gap:

> A real small-business owner does not start with eval metrics. They
> start with a messy bank CSV and need to get it into the system safely
> and clearly.

This sprint addresses that gap as the first item from
`SMALL_BUSINESS_UX_ROADMAP.md`.

## 2. Current supported CSV behavior

| Capability | Status |
|---|---|
| Drag-and-drop CSV upload | ✅ |
| File-picker fallback (`<input type="file">`) | ✅ |
| Sample CSV download | ✅ (`/samples/granite-state-bank-sample.csv`) |
| "Load sample into wizard" shortcut | ✅ |
| Preview first 10 rows + parsing warnings | ✅ |
| Auto-detection of common bank headers | ✅ (Date / Description / Amount / Debit / Credit / Merchant / Memo / Reference / Account) |
| User-overridable column mapping | ✅ |
| Signed-amount mode | ✅ |
| Debit/credit mode (split columns) | ✅ |
| Parentheses → negative (`(150.00)` → `-150.00`) | ✅ |
| Currency-symbol + thousands-comma stripping | ✅ |
| Plain-English per-row error messages | ✅ |
| Invalid-row highlighting + counters | ✅ |
| Submit-only-valid-rows to existing import endpoint | ✅ |
| Mobile-first card / stacked layouts | ✅ |
| Demo data warning above wizard + reminder before final import | ✅ |
| Post-import success panel + CTA to `/cleanup` | ✅ |

## 3. Required mappings

The user must map (or auto-detect) **three** fields before the wizard
will let them proceed to the validate step:

- **Date** — parseable as `YYYY-MM-DD`, `MM/DD/YYYY`, `MM/DD/YY`, or
  `DD/MM/YYYY` (when day > 12).
- **Description** — non-empty.
- **Amount** — depending on the chosen mode:
  - **Signed mode** — one column with positive/negative values.
  - **Debit/credit mode** — two columns (debit = outflow, credit =
    inflow).

## 4. Optional mappings

- **Merchant** — if blank, the backend extracts a candidate from the
  description.
- **Memo** — folded into the description (`"DESC (memo)"`) on
  submission so the categorize pipeline sees the context.
- **Reference** — captured by the wizard but not currently sent (the
  backend doesn't consume it; reserved for future use).
- **Account** — same.

## 5. Amount modes

| Mode | When to use | Wizard behavior |
|---|---|---|
| **Signed** | One column with values like `-150.00` (expense) or `4284.00` (revenue). | Wizard maps that one column; parses parentheses + currency symbols + thousands commas. |
| **Debit / credit** | Two separate columns. Debit = outflow (becomes negative on submit). Credit = inflow (becomes positive). | Wizard maps both columns; flags rows where both or neither is populated. |

Auto-detection picks the mode based on the headers: if both `Debit`
and `Credit` columns exist and no explicit `Amount` column does, the
wizard suggests debit/credit mode. The user can flip it at any time.

## 6. Validation behavior

The validate step shows four counters (total / valid / needs
attention / blank rows skipped) plus a row-by-row table with the first
50 rows. Each invalid row carries plain-English errors:

- `Date is blank.`
- `Date "31/13/2026" doesn't look like YYYY-MM-DD, MM/DD/YYYY,
  MM/DD/YY, or DD/MM/YYYY.`
- `Description is blank.`
- `Amount "abc" doesn't look like a number.`
- `Both debit and credit are populated on this row — pick one or
  split the row before importing.`
- `Both debit and credit are blank on this row.`

The import button is disabled until at least one valid row exists.
Only valid rows are sent to the backend; invalid rows stay client-side
so the user can fix the mapping and try again without re-uploading.

## 7. Demo-data warning

Two visible reminders:

1. **At the top of `/transactions/import`** (always rendered) — amber
   panel: *"Public demo — do not upload real bank data. There is no
   authentication and no tenant isolation on this deploy…"*
2. **On the validate step, just above the import button** — second
   amber reminder: *"Reminder: this public demo has no authentication
   or tenant isolation. Do not import real financial data."*

## 8. Sample CSV

`frontend/public/samples/granite-state-bank-sample.csv` ships **15
fictional rows** from the Granite State Auto Repair March 2026
scenario, using the **debit/credit column shape** so the wizard
exercises that mode. Vendors include NAPA Auto Parts, AutoZone
Commercial, O'Reilly Auto Parts, ADP Payroll, Comcast Business,
Stripe Deposit Payout, Square Deposit, OWNER TRANSFER, Amazon
Marketplace, Home Depot, and a Cash Deposit. All amounts are
plausible but completely fictional.

The wizard offers two paths to use the sample:

- **Download sample CSV** — saves the file locally so the user can
  open it in a spreadsheet, edit it, and re-upload.
- **Load sample into wizard** — fetches the file in-memory and
  advances the wizard straight to the preview step.

## 9. Limitations

- **1 MB file size cap.** The backend's cap is 5 MB; the wizard limits
  client-side to 1 MB so a runaway upload can't freeze the phone
  browser.
- **5,000 row cap.** Inherited from the backend.
- **No mapping profile storage.** The user has to re-map columns every
  time. A "save mapping as 'TD Bank Personal Checking'" feature is
  listed in `SMALL_BUSINESS_UX_ROADMAP.md` as a v2 enhancement; needs
  per-tenant storage from Phase A of
  `SECURITY_AND_PRODUCTION_READINESS.md`.
- **No split-transaction support.** A single bank row becomes a single
  ledger row.
- **No multi-currency normalization.** All rows submitted as USD per
  the existing backend convention.
- **`Reference` and `Account` columns are captured but not sent.** The
  backend doesn't consume them today.
- **Memo is folded into description** rather than stored separately.
  When the backend gains a dedicated memo field, the wizard will
  switch to sending it natively.
- **Not safe for real bank data.** The two visible warnings are the
  enforcement; this is a portfolio demo, not a SaaS product.

## 10. Future improvements

In priority order:

1. **Mapping profile save / load.** "TD Bank Personal Checking →
   columns 0, 4, 5, 6, debit/credit mode." Saves a real owner's
   monthly cleanup minutes. Needs per-tenant storage (Phase A).
2. **Mobile-first review queue** — the next item in
   `SMALL_BUSINESS_UX_ROADMAP.md`. Pairs naturally with the wizard:
   import → review on the same device.
3. **Account-mapping wizard** — UI for editing the per-business
   intent → COA map (currently a Python file).
4. **Better date-format help.** When a date column has values the
   wizard can't parse, suggest the likely format and offer a
   one-click override.
5. **OFX / QFX file support.** Banks export these too; many owners
   download them by accident.
6. **Direct integration with Plaid / Yodlee / MX.** Out of scope for
   the demo (no creds, no tenant model); listed in
   `SECURITY_AND_PRODUCTION_READINESS.md` as Phase D-ish work.
