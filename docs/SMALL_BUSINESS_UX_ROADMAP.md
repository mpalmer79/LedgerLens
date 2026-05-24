# Small-business UX roadmap

Built in response to the senior-review observation that the
marketing surface (hero, walkthrough, comparison) is more polished
than the **actual late-night-on-a-phone owner workflow**. This doc
sequences the next several UX investments and gives each one a
concrete design.

## 1. Current UX strengths

- **Monthly cleanup checklist** (`/cleanup`) — six-step guided
  flow driven by real backend status.
- **Plain-English owner questions** (`/questions`) — multiple-
  choice prompts that avoid forcing accounting jargon on the
  owner.
- **Owner Answers v2 textarea** — free-text owner notes attach to
  each answer; flow into the handoff verbatim.
- **Accountant handoff package** — markdown + CSV exports with
  the "Sample data" badge and "not tax advice" disclaimer
  preserved.
- **Sample scenario** — Granite State Auto Repair March 2026.
  Realistic enough that an owner can pattern-match.
- **Reliable error / empty / loading states** — shared
  `<ErrorState>` / `<EmptyState>` / `<LoadingState>` with retry
  buttons and plain-English messages.
- **Mobile-aware nav** — hamburger menu, clamp-scaled hero,
  responsive grid layouts.

## 2. Current UX gaps

Surfaced by the senior review:

| Gap | Why it matters | Severity |
|---|---|---|
| No drag-and-drop CSV mapping wizard | Owners get a CSV from their bank with arbitrary column names. The current import expects a fixed schema. | High |
| No bank CSV profile detection | Different banks export CSVs differently (signed amount vs debit/credit columns; ISO vs US date format). | High |
| No account-mapping wizard | The intent-to-COA mapping is a Python file. An owner can't tweak it. | Medium |
| No mobile-first review queue | `/review` and `/questions` are table-shaped. A phone-using owner needs one-card-at-a-time review. | High |
| No one-card-at-a-time review mode | Same as above; specific UI shape. | High |
| No bulk actions | "Apply this answer to every NAPA row" would shorten cleanup substantially. | Medium |
| No split transactions | Owner can't tag a Costco run as 50% office / 50% meals. | Medium |
| No accountant collaboration | Handoff is one-way; accountant can't reply inside LedgerLens. | High |

## 3. Priority UX roadmap

Recommended sequence — each step has a self-contained design in
the sections below.

1. **CSV mapping wizard** — owners can import their bank's
   actual CSV without renaming columns. **✅ Shipped in PR #46.**
   See `docs/CSV_IMPORT_MAPPING_WIZARD.md` for the working
   implementation and `docs/CSV_IMPORT_MAPPING_WIZARD_REVIEW.md`
   for the sprint review.
2. **Account-mapping wizard** — owners or their accountant can
   tweak the intent → COA map per business. **✅ Editable v1
   shipped.** `/mapping` is now an editable wizard backed by
   `CategoryMappingProfile` / `CategoryMappingEntry`. Public demo
   has no auth on the writes — the page surfaces an amber warning
   and a reset-to-defaults button. See
   `docs/PERSISTENT_CATEGORY_MAPPING.md` for the contract and
   `docs/CATEGORY_MAPPING_WIZARD.md` for the design.
3. **Mobile-first review queue** — one card at a time, big
   buttons, sticky save/skip. **🟡 Partial — `/review` now offers
   four explicit primary actions on a 1-/2-/4-column responsive
   grid with 44px tap targets and a progress indicator, and the
   safe accountant-review path is a first-class button.** A
   dedicated one-card-per-viewport variant is still future work.
   See `docs/REVIEW_SAFETY_AND_MOBILE_QUEUE.md`.
4. **Sample CSV templates** — bundle 3-5 real-bank-shaped CSVs
   so owners can practice the mapping wizard.
5. **Bulk review actions** — "approve all NAPA as
   parts_inventory" / "skip all owner transfers."
6. **Accountant comments / follow-up workflow** — accountant
   role inside LedgerLens with reply threads on review items.
   Needs the auth / tenant foundation.
7. **Export mapping for QuickBooks / Xero / Sheets** — IIF /
   QBO XML / Xero CSV / Google Sheets-friendly column set. The
   accountant-friendly reviewed-categorization CSV shipped this
   sprint is the first step. See `docs/ACCOUNTANT_CSV_EXPORTS.md`.

## 4. Mobile-first review queue design

**Path:** `/questions` extended with a `?mobile=1` variant (or
new `/review/mobile` page).

Design principles:

- **One transaction per card.** Full viewport on phone; max-width
  with surrounding context on desktop.
- **Big answer buttons.** Min 48px tap target; min 16px text.
- **Sticky bottom bar with Save / Skip / Needs accountant review.**
  Always reachable with thumb.
- **Owner note input always above the answer buttons, not
  collapsed.** Owners type context first, then choose.
- **Progress indicator at the top.** "Question 3 of 12 · 8
  minutes remaining (est.)."
- **"Needs accountant review" is a single primary action**,
  not buried in a multi-select menu.
- **Hand-off-ready before all questions answered.** A persistent
  "Skip rest and review handoff" link in case the owner has 10
  minutes to do 6 questions and wants to come back tomorrow.
- **Optimistic UI.** Save the answer locally first, queue the
  network request, retry once on failure (the existing retry
  layer handles this).
- **Works at 11pm on phone in landlord-portrait mode.** Test the
  flow with screen brightness at 30%, one-hand grip.

## 5. CSV mapping wizard design

**Path:** new `/transactions/import/wizard` that the import page
links to.

Flow:

1. **Drop or pick the CSV.** Visual drop zone with file size /
   row count after upload.
2. **First-10-row preview.** Read-only table showing the raw CSV
   so owners can see what they uploaded.
3. **Column mapping step.** Dropdowns for date / description /
   amount / merchant / category. LedgerLens auto-detects when
   it can; the dropdowns are pre-selected with the best guess.
4. **Debit/credit detection.** Two strategies: "signed amount in
   one column" or "two columns (debit, credit)." Auto-detect by
   sampling. Owner confirms.
5. **Date format detection.** ISO `2026-03-14` vs US `03/14/2026`
   vs ambiguous. Auto-detect; owner overrides if needed.
6. **Validation.** Run the first 10 rows through the importer with
   the chosen mapping; show inline errors before committing.
7. **Save mapping profile.** Owner can name the profile (e.g.
   "TD Bank Personal Checking") so the next month's import skips
   to step 6.
8. **Commit.** Existing import endpoint receives a normalized CSV
   produced from the mapping.

No new backend endpoints needed for v1 — the wizard transforms the
input client-side and sends the existing `/transactions/import`
payload.

## 6. Account-mapping wizard design

**Path:** new `/rules/mapping` (or extend `/rules`) for editing
the active business's intent → COA mapping.

Flow:

1. **Show current map** as a sortable list (intent on left,
   mapped COA code on right).
2. **Suggest defaults** for intents that aren't in the map.
3. **Unmapped intents** at the top with a clear "decide what to
   do" label.
4. **Per-intent options:** "use this code", "leave unmapped (rule
   default wins)", or "block fallback (route to review)."
5. **Never force ambiguous mapping.** When the owner picks a code
   that doesn't exist on the active COA, the picker shows that
   visually and refuses to save.
6. **Save.** Today the map is Python; the wizard either writes to
   a JSON/YAML file the backend reloads, or stores to a
   `BusinessIntentMap` ORM table (requires Phase A from
   `SECURITY_AND_PRODUCTION_READINESS.md` because per-tenant
   editing implies a tenant model).

For v0 the wizard could be read-only (show the active map; explain
how to edit it in code) — that's already most of the value to a
reviewer evaluating the architecture.

## 7. Acceptance criteria

- ✅ Roadmap is concrete.
- ✅ Each priority has a self-contained design.
- ✅ Responds directly to the senior-review observation about the
  marketing surface vs the actual owner workflow.
- ✅ Mobile-first review queue is described concretely (one card,
  big buttons, sticky bar, owner note above answers).
- ✅ CSV mapping wizard is described concretely (drop, preview,
  column mapping, debit/credit detection, date format detection,
  validation, save profile).
- ✅ Account-mapping wizard is described concretely (current map,
  suggest defaults, unmapped at top, per-intent options).
- ✅ Each design names its prerequisite (e.g. tenant model for the
  account-mapping wizard).
