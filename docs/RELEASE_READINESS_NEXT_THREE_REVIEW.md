# Release-readiness sprint review — three workstreams

## 1. What changed

Three coordinated workstreams shipped in order:

| Workstream | Outcome |
|---|---|
| A — AppShell readiness truth | Header dot now separates process liveness (`/health`) from demo-data readiness (`/demo/ready`). The old misleading "API: ok" copy is gone. |
| B — Saved CSV import profiles | A returning owner can save the current import-wizard mappings as a named profile, reuse the seeded sample profile, and see clear feedback when a new CSV's headers don't match. Profiles store **header metadata only**. |
| C — Mapping recategorization preview | Every intent row in `/mapping` gains a "Preview impact" panel showing affected rows, eligible vs protected counts, and the proposed code. Preview-only — apply is deferred. |

## 2. Why these three workstreams were combined

They share one product theme: the demo currently exposes rough
edges that erode owner trust even when the backend is alive.

- (A) The header dot tells a visitor whether the rest of the page
  is worth their time. Fixing it first prevents the next reviewer
  from being misled.
- (B) Saved profiles are the highest-frequency repeated chore in
  the monthly cleanup flow. Lands once CI is steady from (A).
- (C) The persistent mapping shipped two sprints ago is now
  editable but blind — owners can't see the impact of edits before
  saving. Preview-only is the safe v1.

## 3. AppShell readiness before / after

**Before:** one `HealthDot` driven entirely by `/health` →
"API: ok" / "API: unreachable" / "Checking API…".

**After:** `ReadinessIndicator` with five states + an explanatory
tooltip:

| State | Dot | Label |
|---|---|---|
| `checking` | grey | "Process: …" |
| `process_ok_demo_ready` | brand green | "Process: ok · Demo: ready" |
| `process_ok_demo_degraded` | amber | "Process: ok · Demo: degraded" |
| `process_ok_demo_unavailable` | amber | "Process: ok · Demo: unavailable" |
| `process_unreachable` | red | "Backend: unreachable" |

Mobile collapses to the process label only; the full string
appears on `>=sm` screens. The indicator carries
`data-testid="appshell-readiness"` + `data-readiness-state` for
tests + monitoring.

## 4. Saved CSV import profile workflow

A returning owner who wants to import next month's TD Bank export
now sees a "Saved import profile" panel above the wizard. Picking
a profile:

1. Auto-applies the saved column mappings (date, description,
   amount mode, optional fields).
2. Once the CSV is parsed, runs
   `POST /import-profiles/{id}/validate` against the parsed
   headers.
3. Renders a ✓ when every required column is present, or a clear
   "Your bank may have changed the export format. Missing: …"
   warning when not.
4. Surfaces extra headers as a no-op.

Saving the current mapping ("Save mapping as profile") writes a
new profile with the parsed header list + the in-progress column
mappings. The save button stays disabled until required mappings
are filled in.

The seeded "Granite State sample bank CSV" profile is created on
first read for the demo business so the sample CSV import is
one-click.

## 5. Mapping recategorization preview workflow

Each row in `/mapping` has a collapsible
`<details>` panel labelled **"Preview impact — apply flow not
implemented yet"**. Inside:

- A short safety paragraph (Nothing has been changed yet …
  Human-corrected and accountant-follow-up rows are protected).
- A **Run preview** button that calls `POST /mapping/preview`
  with the current draft (proposed code, block_fallback).
- A four-card summary (Affected / Eligible / Would route to
  review / Protected).
- A row-by-row list (first 25 visible; "Showing first 25 of N")
  with `eligible` / `protected` badges and a plain-English
  reason on protected rows.

Apply is deferred. The button copy is explicit about that.

## 6. Safety guardrails

| Rule | Where it's enforced |
|---|---|
| Profiles never store row-level financial data | `CsvImportProfile` columns + audit-doc + test that paranoia-checks the JSON shape for `raw_csv` / `account_number` / `password` / `secret` etc. |
| Profiles store header metadata only | `expected_headers_json` + the validate endpoint accepts a header list only. |
| Preview is read-only | `POST /mapping/preview` runs zero `INSERT` / `UPDATE` / `DELETE`. A test confirms `/mapping/profile` and `/ledger` snapshots are byte-identical before + after a preview call. |
| Human-corrected rows are protected | `_ineligibility_reason()` returns "row was human-corrected; explicit decision protected". |
| Accountant-follow-up rows are protected | Two paths: `ACCOUNTANT_REVIEW_REQUIRED` status + `accountant_follow_up_required` flag on the latest review. |
| `correction_memory` rows are protected | Encodes a previous human decision. |
| `UNCATEGORIZABLE` rows are protected | Owner already excluded them from books. |
| No apply UI | Preview panel button reads "Preview impact — apply flow not implemented yet". |
| Header copy never claims production safety | `data-readiness-state="process_ok_demo_ready"` does not mean "demo is safe for real bank data". |

## 7. Data saved vs not saved

**Saved on `CsvImportProfile`:**

- Profile name, source (`seed` / `user`), amount mode.
- Column name strings: date / description / amount / debit /
  credit / merchant / account / memo / reference.
- The exact header row the bank exported when the profile was
  saved (`expected_headers_json`).

**Never saved:**

- Raw CSV rows.
- Parsed transaction descriptions.
- Account numbers / customer / employee identifiers.
- Bank credentials.
- Anything that would re-identify the file beyond its header
  shape.

## 8. Tests added / updated

| Suite | Before | After |
|---|---|---|
| Backend pytest | 266 | **295** |
| Frontend vitest | 262 | **279** |

**Backend additions:**

- `tests/api/test_csv_import_profiles.py` — 20 tests covering seed,
  CRUD, validation matrix (blank name, missing required column per
  mode, invalid mode, duplicate name), header validation (all-
  present, missing-required, allow-extra), 404s, refusal to delete
  seed, reset, privacy guards, and `X-Request-ID` propagation.
- `tests/api/test_mapping_preview.py` — 9 tests covering input
  validation (unknown intent, unknown code), the "no mutation"
  invariant (profile + ledger byte-identical), eligibility for a
  clean rule row, protection for human-corrected and accountant-
  follow-up rows, `block_fallback` "would route to review"
  counting, the summary shape, and `X-Request-ID`.

**Frontend additions:**

- `AppShell readiness truth (Workstream A)` — 5 tests.
- `import wizard saved profile UI (Workstream B)` — 6 tests.
- `mapping recategorization preview (Workstream C)` — 6 tests.

`ruff check`, `ruff format --check`, `mypy --strict`, `npm run
lint`, `npm run build` all green.

## 9. Remaining weaknesses

- **Preview apply is deferred.** Owners can see what would change
  but can't act on it from inside LedgerLens. Auth Phase 2 + an
  audit-event-aware apply path are the right next step.
- **Profile selector is per-business only.** Once auth lands, the
  selector should switch businesses.
- **Header validation does not yet propose a remap.** If a bank
  rename ed `Posted Date` to `Date`, we surface a missing-header
  warning; we don't auto-suggest the rename.
- **Static handoff fallback is still hard-coded.** Drifts over
  time. The "build-time live snapshot" idea from the audit is the
  best long-term fix.
- **Mobile nav still scrolls horizontally on small phones.** The
  earlier owner-onboarding sprint flagged this; a drawer overlay
  is the cleanest follow-up.

## 10. Recommended next PR

The blunt recommendation: **Auth/Tenant Phase 2** (login UI +
session middleware + protected-route gating). It unblocks:

- A safe selected-row "apply mapping change" flow on top of the
  preview (an `actor_user_id` makes the audit event meaningful).
- A real business-switcher on `/mapping` and `/import-profiles`.
- The accountant-collaboration sprint (reply threads on review
  items).

Other strong candidates:

- **Build-time static handoff snapshot.** The static handoff
  fallback drifts; snapshotting the live JSON during the frontend
  build would close the gap.
- **Mobile nav drawer.** A burger-style menu would scale better
  on small phones.
- **Saved-profile header remap suggester.** When a bank renames a
  column, propose the most-similar replacement instead of just
  warning.
