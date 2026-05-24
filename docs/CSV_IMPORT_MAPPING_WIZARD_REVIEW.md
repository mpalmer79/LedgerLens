# CSV import mapping wizard — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| `/transactions/import` page | Single-shot upload-or-paste form. User had to know the backend's exact column schema (`transaction_date · description · merchant · amount · currency · source`). | **Five-step mapping wizard** (Upload → Preview → Map columns → Validate → Imported). Drag-and-drop dropzone + file-picker fallback + "Download sample CSV" + "Load sample into wizard" entry points. Mobile-first card layouts. |
| Sample CSV | Inline `SAMPLE_CSV` string with the LedgerLens schema. | New `frontend/public/samples/granite-state-bank-sample.csv` — **15 fictional rows** in real-bank shape (`Posted Date / Description / Debit / Credit / Account / Reference`). Exercises the debit/credit mapping mode. |
| CSV parsing | Server-side only. Frontend sent the raw blob. | **Client-side parsing** with Papa Parse (added as dep) + column auto-detection + plain-English error messages. 1 MB client-side cap; 5 MB backend cap preserved as the backstop. |
| Column mapping | Backend's alias dict only. | **Auto-detected per-field**: Date, Description, Amount, Debit, Credit, Merchant, Memo, Reference, Account. Every dropdown user-overridable. |
| Amount handling | Single signed-amount column only. | **Two modes**: signed (one column) or debit/credit (two columns). Auto-suggested from headers; user can flip. Debit values become negative on submit; credit values stay positive. Honors backend's sign convention. |
| Validation | Server-side, per-row, returned in the response. | **Client-side pre-validation** with per-row error messages, valid/invalid/blank-skipped counters, invalid-row highlighting. Only valid rows submitted; invalid rows stay client-side so the user can fix the mapping and retry. |
| Submission path | `POST /transactions/import` with raw user file. | **Same endpoint, unchanged.** Wizard builds a normalized CSV blob (`transaction_date,description,amount,merchant,currency,source` — the exact schema the existing endpoint expects) and submits via the existing `importCsv()` client function. Zero backend changes. |
| Post-import UX | Status table + error list. | **Success panel + CTAs**: "Start monthly cleanup → `/cleanup`" (primary), "Review transactions → `/transactions`" (secondary), "Import another file" (tertiary). Backend row-error list still surfaced when present. |
| Demo warnings | One amber panel at the top. | Same panel preserved + **second amber reminder on the validate step** just above the import button. |
| Dependencies | No CSV parser. | Added `papaparse@5.4.1` + `@types/papaparse@5.3.15` (small, widely used, no runtime cost). |

## 2. Why this was the right next PR

`SMALL_BUSINESS_UX_ROADMAP.md` (shipped in PR #45) named **CSV
mapping wizard** as priority #1 explicitly: "owners get a CSV from
their bank with arbitrary column names. The current import expects
a fixed schema." The wizard directly closes that gap and is fully
client-side, so it didn't need any of the bigger production
foundations (auth, tenant model, etc.) to land.

It also makes the rest of the cleanup story usable. Before this
PR, the homepage CTA was "Start monthly cleanup → `/cleanup`" —
but if a real owner clicked through and tried to import their bank
CSV, they'd hit a developer-style form that demanded a specific
schema. After this PR the path is intact: upload → wizard maps the
columns → validate → import → start cleanup.

## 3. User workflow before vs after

**Before** (3 steps, schema-locked):

1. Owner downloads CSV from bank — has columns like
   `Posted Date / Description / Debit / Credit / Account / Reference`.
2. Owner opens it in Excel, renames columns to match LedgerLens's
   `transaction_date / description / merchant / amount / currency /
   source`, manually computes signed amounts from the debit/credit
   columns, deletes the columns LedgerLens doesn't accept, re-saves.
3. Owner uploads the now-LedgerLens-shaped CSV.

If they got any column wrong, they got a server-side row error and
had to start over.

**After** (5 steps, owner stays in browser):

1. **Upload** — drag-drop the CSV (or click "Choose CSV file" or
   "Load sample"). Client-side parses in-memory.
2. **Preview** — first 10 rows shown with detected headers; warnings
   surfaced; user can go back to a different file.
3. **Map columns** — wizard suggests Date / Description /
   Debit / Credit (or Amount); user confirms or changes. Picks
   debit/credit vs signed-amount mode.
4. **Validate** — counters (total / valid / needs-attention /
   blank-skipped); per-row table with plain-English errors;
   reminder not to import real data.
5. **Imported** — success panel + "Start monthly cleanup" CTA.

## 4. Supported CSV patterns

- **Header detection** is case-insensitive and matches by whole-token
  equality after stripping non-alphanumerics. So `Posted Date`,
  `posted_date`, `POSTED-DATE`, and `PostedDate` all match the same
  candidate.
- **Date formats supported** (mirrors the backend): `YYYY-MM-DD`,
  `MM/DD/YYYY`, `MM/DD/YY` (expands to `20YY`), `DD/MM/YYYY` (when
  day > 12 — unambiguous).
- **Amount formats supported**: `-150.00`, `(150.00)` (parentheses =
  negative), `$1,234.56` (currency symbol + thousands comma
  stripped), `USD 999.99`.
- **Debit-mode convention**: debit value becomes negative regardless
  of sign in the input (handles banks that already export debits as
  negative). Credit value becomes positive.

## 5. Validation behavior

| Error message | Trigger |
|---|---|
| `Date column not mapped.` | User skipped past mapping with no Date column. |
| `Date is blank.` | Row's Date cell is empty. |
| `Date "X" doesn't look like YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY, or DD/MM/YYYY.` | Date present but unparseable. |
| `Description column not mapped.` / `Description is blank.` | Self-explanatory. |
| `Amount column not mapped.` / `Amount is blank.` / `Amount "X" doesn't look like a number.` | Self-explanatory. |
| `Debit column not mapped.` / `Credit column not mapped.` | Debit/credit mode + missing mapping. |
| `Both debit and credit are populated on this row — pick one or split the row before importing.` | Ambiguous row in debit/credit mode. |
| `Both debit and credit are blank on this row.` | Missing amount in debit/credit mode. |

## 6. Demo safety guardrails

- Top-of-page amber warning is preserved verbatim from PR #45.
- New second amber reminder on the validate step, just above the
  import button: *"Reminder: this public demo has no authentication
  or tenant isolation. Do not import real financial data."*
- 1 MB client-side file cap (backend cap is 5 MB).
- Non-CSV files rejected with plain-English error.
- The sample CSV is explicitly named "synthetic fictional scenario"
  in the wizard copy.

## 7. Backend changes

**None.** The wizard's output is a CSV blob in the exact column
shape (`transaction_date,description,amount,merchant,currency,source`)
that the existing `POST /transactions/import` endpoint already
accepts. Zero new endpoints, zero schema changes, zero migration
risk. Backend tests unchanged.

## 8. Tests added / updated

**Backend — 202 passed (unchanged).** No backend changes.

**Frontend — 219 passed (was 179, +40).**

New `src/lib/csv-import/csv-import.test.ts` (35 tests):

- `parseCsvText` — quoted descriptions with commas, blank-line
  handling, duplicate-header tolerance, header-less rejection,
  1 MB cap constant.
- Header detection — date / description / amount / debit / credit
  / merchant; suggests `debit_credit` mode when both columns
  exist; doesn't confuse merchant with description when both are
  present.
- `normalizeDate` — `YYYY-MM-DD`, `MM/DD/YYYY`, `MM/DD/YY` →
  `20YY`, `DD/MM/YYYY` (day > 12); returns null for unparseable.
- `normalizeAmount` — signed positive/negative, parentheses,
  currency symbols, thousands commas, blank, non-numeric.
- `normalizeRows` (signed mode) — valid row, missing date,
  missing description, invalid amount, source-row preservation,
  blank-row skip.
- `normalizeRows` (debit/credit mode) — populated debit becomes
  negative, populated credit becomes positive, both populated
  flagged invalid, neither populated flagged invalid,
  already-negative-debit handled.
- `buildNormalizedCsv` — emits exact backend header, escapes
  commas/quotes, drops invalid rows, folds memo into
  description.

New `src/lib/page-content.test.ts` (`/transactions/import` block,
+5 tests on top of the existing 2):

- Wizard renders drag-and-drop + Choose CSV button.
- Sample CSV download link + "Load sample into wizard" entry
  point.
- Step bar renders Map columns + Validate.
- Amount-mode selector (signed + debit/credit) renders.
- Validation summary fields render (Need attention + Blank rows
  skipped).
- Validate-step second-reminder copy + `/cleanup` CTA + "Start
  monthly cleanup" wording.
- Negative assertion: no "production accounting software" or
  "100% AI" claim.

New `src/lib/productization-docs.test.ts` (+1 test):

- `public/samples/granite-state-bank-sample.csv` exists, includes
  Debit + Credit + Description columns, contains the fictional
  vendor names (NAPA, STRIPE).

**Build / lint / typecheck**

- `cd backend && pytest -q` → **202 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → all formatted
- `cd backend && mypy --strict src` → no issues
- `cd frontend && npm test -- --run` → **219 passed (13 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build

## 9. Mobile QA notes

The wizard is built mobile-first:

- **Upload dropzone** — `p-8` interior padding; takes full container
  width; "Drag & drop a CSV here" headline + secondary "or choose
  a file" + sample CSV card stack vertically on phones.
- **Preview table** — `overflow-x-auto` wrapper so the raw
  bank-CSV columns scroll horizontally inside the contained card,
  rather than overflowing the viewport.
- **Map step** — `grid grid-cols-1 sm:grid-cols-2` for the field
  dropdowns; on phones each `FieldSelect` takes a full row.
- **Amount-mode selector** — `grid grid-cols-1 sm:grid-cols-2` so
  the two radio cards stack on phones.
- **Validate table** — same `overflow-x-auto` pattern; mobile users
  see the row number + date + status columns first and can scroll
  for the rest.
- **Stat tiles** — `grid grid-cols-2 sm:grid-cols-4` so phones get a
  2-up layout instead of cramming 4 numbers.
- **Buttons** — wrap on `flex flex-wrap gap-3`; minimum 48px tap
  targets via the existing button utilities.

Manual responsive check recommended at 360 / 375 / 430 / 768 /
1024 / 1280 px once deployed but no blocking issues are expected.
The wizard reuses the existing AppShell + DataState components, so
it inherits the mobile polish from the reliability sprint.

## 10. Remaining limitations

- **No mapping profile save/load.** Per-tenant storage is a Phase A
  prerequisite from `SECURITY_AND_PRODUCTION_READINESS.md`.
- **No OFX / QFX file support.** CSV only.
- **No split-transaction support.** Each row becomes one ledger
  row.
- **No multi-currency normalization.** USD only.
- **Memo column is folded into description** rather than persisted
  separately.
- **`Reference` and `Account` columns are captured but not sent.**
  Backend doesn't consume them today.
- **Not safe for real bank data.** The visible warnings are the
  enforcement; this is a portfolio demo.

## 11. Recommended next PR

In priority order:

1. **Mobile-first review queue.** The natural pair to this sprint
   — owner uploads on phone, then reviews on phone. Single-card
   review UI with big buttons, sticky save/skip, owner note above
   answers. Designed in `SMALL_BUSINESS_UX_ROADMAP.md` §4.
2. **Account / category mapping wizard.** UI for editing the
   per-business intent → COA map. Read-only v1 is enough to
   demonstrate the architecture; full read/write needs Phase A.
3. **Request IDs + structured logging + redaction utility (Phase
   B).** Smallest production-readiness step that adds real value;
   pairs with the existing `<ErrorState>` technical-details
   surface.
4. **Auth + tenant schema foundation (Phase A design doc).**
   Doesn't need to ship code; the design doc + schema diff would
   unblock per-tenant work later.
5. **QuickBooks-friendly CSV export mapping.** Map the handoff CSV
   to IIF or QBO XML so the accountant can drop it into their
   QuickBooks setup without transformation.
6. **Real Loom recording + launch assets** — the generated
   walkthrough is good; a real Loom would close the homepage
   video story.

The recommended single next PR is **#1 (mobile-first review
queue)** because it directly pairs with this sprint to make the
end-to-end mobile workflow — upload → review → handoff —
genuinely usable on a phone.
