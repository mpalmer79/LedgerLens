# Release readiness — next three workstreams audit

The three workstreams in this sprint share a common theme: the
public demo currently exposes a few rough edges that erode owner
trust even when the backend is technically alive. They belong
together because (1) the header dot tells visitors whether the rest
is worth their time, (2) saved CSV profiles remove the most
repetitive monthly chore, and (3) the recategorization preview
turns the new editable mapping into something an owner can actually
use without fear.

## 1. Current readiness signal behavior

`AppShell` renders a `HealthDot` driven entirely by `getHealth()`
(`/health`). The states are `checking` / `ok` / `unreachable` with
copy `"API: ok"` and `"API: unreachable"`.

`/health` is a one-liner liveness check — it doesn't touch the
database, the demo tables, or any of the seeded foundation rows.
The public-demo incident hotfix added `/demo/ready` for that, but
the header dot still ignores it.

## 2. Why `/health` alone is misleading

Every page in the AppShell sees the same dot. When `/demo/status`
is broken (the recent incident), `/handoff` crashes, the import
wizard can't reach the backend, and `/admin/foundation/status`
returns `ready=false`, the header still says "API: ok". The
reviewer's most-quoted criticism after the last incident was
exactly this.

## 3. Current CSV wizard behavior

`/transactions/import` (the wizard) parses an uploaded CSV with
Papa Parse, auto-detects common bank-export header names, and
asks the user to confirm or override per-column mappings before
the import POST. State is per-render only — leaving the page
loses the mappings. A returning owner who runs cleanup next month
re-does the same column-by-column confirmation every time.

## 4. What users must repeat each month

For a recurring TD-Bank export the owner currently has to:

1. Click through each column dropdown to confirm
   `Posted Date` → date, `Description` → description,
   `Debit` / `Credit` → debit_credit mode.
2. Click "Apply mapping".
3. Hit "Import".

Nothing remembers the bank's header shape between sessions. The
audit doc for the import wizard already lists "save mapping as
TD Bank Personal Checking" as v2 work (see
`docs/CSV_IMPORT_MAPPING_WIZARD.md` §10).

## 5. Current persistent category mapping behavior

`/mapping` is editable. Edits go to
`CategoryMappingProfile` / `CategoryMappingEntry` and take effect
for **future** categorize calls. Existing rows keep whatever final
category they had at the time the rule layer ran. There is no
preview of what would change, no way to selectively re-apply, and
no warning that the new mapping has zero effect on previously
categorized rows.

## 6. What happens after a mapping edit today

| Row state at edit time | Behavior |
|---|---|
| Already `auto_approved` from a previous rule pass | Stays in its old final category. No re-categorize. |
| Already `corrected` by a human | Same — human override is sticky. |
| `accountant_review_required` | Stays awaiting accountant input. |
| `needs_review` (queued) | Re-categorize on next manual `/categorize` call picks up the new mapping. |
| Future imports | Pick up the new mapping immediately. |

So an owner who fixes a mapping after seeing it apply the wrong
code to past rows gets surprised: nothing changed.

## 7. Risks of silent recategorization

If "apply mapping change to existing rows" were a one-click button:

- Human-corrected rows could be silently flipped back to the new
  rule-mapped code, throwing away the owner's explicit decision.
- Accountant-follow-up rows could quietly get a category, defeating
  the safety-bug fix from the review-safety sprint.
- Already-exported rows could change after the accountant received
  the handoff CSV, breaking the audit trail.
- Bulk apply with no preview is the kind of "click and discover"
  flow that costs an owner an evening of cleanup.

The preview-only-first stance from this sprint's spec is the right
call. Apply is deferred.

## 8. Proposed implementation order

The brief locks the order: **A first, B second, C third.** That
matches risk too:

- A (header readiness) is small, ships in hours, and stops the
  next reviewer from being misled.
- B (saved CSV profiles) is the biggest piece — backend model +
  alembic + API + wizard UI + tests. Land it once A is green so
  CI is steady.
- C (preview-only recategorization) is medium and depends on the
  persistent mapping being in place (it already is).

## 9. What must remain out of scope

- No full auth / login / session middleware. (Auth Phase 2 is the
  next dedicated sprint.)
- No tenant scoping retrofit on existing repositories.
- No Plaid / MX / bank-direct integration. The CSV wizard remains
  the only data path.
- No raw CSV row storage in import profiles. **Profiles store
  header metadata + column mappings only.**
- No "apply mapping change to all matching rows" big-red-button.
  Preview only.
- No removal of any public-demo warning or fictional-sample
  disclaimer.

## 10. Acceptance criteria

1. The AppShell header no longer says "API: ok" alone. It
   separates **process** liveness from **demo data** readiness,
   reading `/health` for the first and `/demo/ready` for the
   second.
2. A user can save the current import-wizard mappings as a named
   profile, reuse the seeded "Granite State sample bank CSV"
   profile, and see clear feedback when an uploaded CSV is missing
   a required column.
3. Profiles store **headers + mapping choices only** — no
   transaction descriptions, no account numbers, no rows.
4. `/mapping` exposes a "Preview impact" button per intent. The
   preview is read-only; ineligible rows (human-corrected,
   accountant-follow-up, accountant-review-required) are flagged
   and protected.
5. No mapping edit silently rewrites any existing row.
6. The public-demo warning surfaces on every new UI added.
7. No claim of production auth, tenant isolation, real-bank-data
   safety, or 100% AI accuracy is added anywhere.
8. Tests pin every contract above; the full backend + frontend +
   lint + build pipeline stays green.
