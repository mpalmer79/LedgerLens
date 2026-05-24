# Saved CSV import profiles — audit

## 1. Current CSV wizard behavior

`/transactions/import` ships a Papa-Parse-backed wizard that:

1. Accepts a CSV upload or paste.
2. Auto-detects common bank-export header names (Date /
   Description / Amount / Debit / Credit / Memo / Merchant /
   Reference / Account).
3. Lets the owner override the per-column mapping and the
   amount mode (signed vs debit/credit).
4. Validates the first 10 rows.
5. Sends a normalized CSV body to `/transactions/import`.

State lives in component memory only — leaving the page loses
the mappings.

## 2. Current column-mapping state shape

```ts
type ColumnMapping = {
  date_column: string | null;
  description_column: string | null;
  amount_column: string | null;
  debit_column: string | null;
  credit_column: string | null;
  merchant_column: string | null;
  account_column: string | null;
  memo_column: string | null;
  reference_column: string | null;
};
type AmountMode = "signed" | "debit_credit";
```

This is exactly the metadata a saved profile needs to remember —
nothing else.

## 3. What should be saved

| Field | Why |
|---|---|
| `name` | User-recognizable label (e.g. "TD Bank checking"). |
| `amount_mode` | `signed` vs `debit_credit`. |
| `date_column` / `description_column` | Required mappings. |
| `amount_column` (signed mode) | Required when mode is signed. |
| `debit_column` / `credit_column` (debit/credit mode) | Required when mode is debit/credit. |
| `merchant_column` / `account_column` / `memo_column` / `reference_column` | Optional mappings the wizard tracks today. |
| `expected_headers` | The exact header list the bank exported when the profile was saved. Used to validate next month's CSV before applying. |
| `source` | `"seed"` for shipped profiles, `"user"` for owner-created. Mirrors the category-mapping pattern. |

## 4. What must never be saved

- Raw CSV rows.
- Parsed transaction descriptions.
- Merchant names from rows.
- Customer or employee identifiers.
- Account numbers.
- File paths or upload metadata that could re-identify the file.
- Bank credentials (we never had them; calling it out for the
  record).

This boundary is the whole reason "saved profiles" don't change
the public-demo safety story: profiles are *configuration*, not
data.

## 5. Metadata-only profile design

The persisted model carries column-name strings and the amount
mode. A profile applies to a *new* CSV upload by:

1. Parsing the upload's header row.
2. Comparing it against `expected_headers`.
3. Reporting matched / missing / extra headers.
4. If every required column maps to a present header, pre-filling
   the wizard's column dropdowns.

Validation needs only the header strings — no row data has to be
shipped to the validator.

## 6. Header mismatch risks

Banks change their export shape:

- A column gets renamed (`Posted Date` → `Date`).
- A column is dropped (`Reference` disappears).
- Extra columns appear (a new `Memo` field).

The wizard must:

- Fail loudly when a *required* column is missing (date,
  description, signed-amount-when-signed, debit/credit-when-debit-
  credit).
- Tolerate extra columns silently — they're simply not mapped.
- Explain the mismatch in plain English so the owner knows whether
  the bank's export changed.

## 7. Future tenant-owned profile path

`business_id` is the same string the existing per-business
mapping uses (`granite_state_auto_repair` in the demo). Once
auth Phase 2 lands, the `business_id` column becomes a real FK
into the `Business` table and writes get gated behind an owner-
role membership check. Migration shape stays compatible.

## 8. Demo-safe limitations

- The public demo is unauthenticated; anyone can create / delete
  profiles for the demo business. The wizard surfaces the same
  amber "public demo" warning the rest of the editable surfaces
  carry.
- Profiles do **not** make the demo safe for real bank data.
- A "Reset to seed" endpoint restores the seeded sample profile
  the same way `/mapping/profile/reset` restores the seeded
  category mapping.

## 9. Acceptance criteria

1. Backend model + Alembic migration land before any UI.
2. CRUD + validate routes exist with header-only payloads.
3. Wizard surfaces a profile selector, can save the current
   mappings as a profile, and validates a new CSV's headers
   against the selected profile.
4. Missing required columns block import and explain what to fix.
5. Extra columns do not block import.
6. Profiles store no row data; tests pin this.
7. Public-demo warning copy is present in every response and on
   the wizard UI.
