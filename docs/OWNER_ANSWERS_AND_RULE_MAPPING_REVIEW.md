# Owner Answers v2 + per-business rule mapping — sprint review

## 1. What changed

Two coordinated improvements landed together:

### A. Owner Answers v2 — structured persistence

- `ReviewDecision` model gains six nullable columns
  (`owner_question_key`, `owner_question_text`, `owner_answer_label`,
  `owner_note`, `suggested_resolution`,
  `accountant_follow_up_required: bool default false`).
- Three review-queue endpoints (`/approve`, `/correct`,
  `/uncategorizable`) accept the new fields via a shared
  `OwnerAnswerFields` Pydantic mixin. All optional — v1 callers
  unchanged.
- `HandoffOwnerAnswer` schema gains `transaction_date / amount_cents /
  currency` + all six v2 fields.
- Handoff service `_owner_answers()` includes any decision that has
  either a v2 question key **or** a legacy `reviewer_note`.
- Handoff markdown export splits the section into a v2 block (with
  question, owner answer, owner note, suggested resolution, follow-up
  flag) followed by a "Legacy review notes (pre-v2)" block.
- `/questions` templates gain stable `key`s + per-answer
  `accountantFollowUp` + `suggestedResolution`.
- `/questions` UI renders a new owner-note `<textarea>` per card,
  helper copy ("Your answer will be saved in the accountant handoff
  package … does not blindly finalize the accounting category"), and
  an amber treatment on answer buttons that flag accountant review.
- `/handoff` page renders the v2 fields in a structured card,
  highlighted in amber when follow-up is required.

### B. Per-business rule intent mapping

- `Rule` dataclass + `_coerce_rule` loader gain optional
  `intent: str | None`.
- All 25 rules in `category_rules.json` are tagged with an intent
  (`software_subscription`, `office_supplies`, `fuel_vehicle`,
  `travel`, `meals_entertainment`, `merchant_fees`).
- New `backend/src/ledgerlens/data/business_rule_maps.py` ships
  `BusinessRuleMap` dataclass + `DEFAULT_INTENT_MAP` (24 generic
  intents) + `GRANITE_STATE_INTENT_MAP` (auto-shop-specific
  overrides) + `resolve_category_for_intent(intent, *, business_id,
  fallback_code)`.
- Categorize service, after matching a rule, resolves the effective
  code via the active business mapping. Falls back to the rule's own
  code when no mapping exists or when the mapped code points at a
  missing COA category.
- `RuleOut` gains `intent / mapped_category_code /
  mapped_category_name`. `RuleListOut` gains a `mapping` snapshot of
  the active business's full intent→code grid.
- `/rules` page rebuilt with the shared `<LoadingState>` /
  `<ErrorState>` components, a new "Active business mapping" card at
  the top, two new table columns (Intent, Mapped category), and a
  per-row "overrides rule default" annotation when the mapping
  changes the rule's code.

## 2. Why combining these objectives made sense

Both improvements share one underlying goal: **make LedgerLens's
deterministic + human layers more measurable and more useful in the
handoff package**.

- The handoff section "Questions answered by owner" was the weakest
  link in the cleanup-to-handoff story — a flat list of `reviewer_note`
  strings with no structure for the accountant to triage.
- The rules layer was the weakest link in the *engineering* story —
  rules were hardcoded against the default COA and rules-only eval
  credit was lost whenever the active business's labels didn't match.

Owner Answers v2 strengthens the handoff *artifact*. Rule mapping
strengthens the deterministic *layer*. Together they make the
accountant-facing output and the eval-facing credibility both go up,
while preserving the workflow-level trust metric (a row is verified iff
it came through a rule auto-approval, a memory replay, or an explicit
human review — the new follow-up flag is metadata, not a verification
gate).

Combining them in one sprint also kept the schema + endpoint changes
small: one ReviewDecision migration, one optional rule field, one new
mapping module. Three small, coordinated additions.

## 3. Owner Answers v1 vs v2

| Aspect | v1 | v2 |
|---|---|---|
| Where owner input lives | `ReviewDecision.reviewer_note` (single string) | `reviewer_note` + 6 new structured columns |
| Question identity | Implicit in the note text | `owner_question_key` (e.g. `unknown_ach_transfer`) |
| Question text | Lost after submit | `owner_question_text` preserved verbatim |
| Owner's chosen answer | Embedded in the note text | `owner_answer_label` ("Owner draw", "Needs accountant review") |
| Free-text from owner | Not possible | `owner_note` (1024 chars) |
| Accountant follow-up flag | Pattern-match "accountant review" in the note | `accountant_follow_up_required: bool` |
| Suggested resolution | Not modeled | `suggested_resolution` (e.g. `owner_draw`, `vendor_payment`) |
| Handoff rendering | Flat bullet list | Structured card per item; v2 + v1 (legacy) blocks separated |
| Categorize verification | A reviewed row is verified | Same. The follow-up flag is metadata. |
| Trust metric | Workflow-level | Workflow-level (unchanged) |
| Backward compatibility | n/a | All v2 fields nullable; pre-v2 rows render under the "Legacy review notes" block |

## 4. Rule mapping before vs after

| Aspect | Before | After |
|---|---|---|
| `Rule` shape | `id / name / active / priority / match_type / patterns / category_code / confidence / explanation / notes` | Same + optional `intent: str \| None` |
| `category_rules.json` | 25 rules, hardcoded `category_code` | Same 25 rules + each declares an `intent` |
| Categorize-service resolution | Rule's own `category_code` is used | Active business mapping resolves intent → code; rule's own code is the safe fallback |
| Per-business override | Not possible | `BusinessRuleMap` registry; today ships `DEFAULT_INTENT_MAP` + `GRANITE_STATE_INTENT_MAP` |
| Rules API | `RuleOut` carries only the rule's own category | Carries `intent / mapped_category_code / mapped_category_name`; `RuleListOut` carries the full active mapping |
| `/rules` UI | Plain table | Active-mapping card + intent column + mapped-category column + "overrides rule default" annotation |
| Eval credibility | Lower bound — rules-only mode dropped any rule whose code didn't match the eval COA | Same metric is honest, but the path is open to a "rules-with-mapping" eval mode (data model in place; CLI wiring deferred) |
| Multi-tenant | No concept | Single-tenant today; `active_business_id()` resolves via the sample scenario; multi-tenant requires resolving from request context (out of scope) |

## 5. How this improves small-business value

- **Handoff package is more useful to the accountant.** The structured
  fields turn "Owner: not sure — flagged for review." into
  "Question: What was this transfer for? Owner answer: Not sure
  [needs accountant follow-up]" with the original owner note attached.
- **Owners can attach the *why* their accountant actually needs.** A
  Venmo to "Jon" can carry "Brake job subcontract — invoice #77" as a
  free-text note. v1 had no place for that.
- **The follow-up flag is now first-class.** The accountant scans for
  amber-bordered cards in the markdown export and on the `/handoff`
  page; they don't have to read every owner note hunting for
  "accountant review."
- **The cleanup loop is more sustainable.** Repeat parts-vendor
  questions get a `parts_vendor` template key, so the future "answer
  memory" sprint can use the key as a deterministic match for the
  next month.

## 6. How this improves technical credibility

- **Rules layer is intent-aware.** A reviewer reading `/rules` sees
  every rule's *intent*, the active business's mapping snapshot, and
  the per-row override annotation. The intent layer is the right
  abstraction for the multi-tenant story.
- **Eval credibility path is open.** A future eval-CLI sprint can
  report rules-with-mapping accuracy honestly; the data model is in
  place.
- **No new runtime dependencies.** No ORM extensions, no migrations
  framework (still create_all()), no new top-level packages. One new
  data module, one extended dataclass, six nullable columns.
- **Backward compatible.** Every change is additive. v1 review notes
  still render correctly; the `/review` page that doesn't know about
  question keys keeps working; rules without `intent` behave exactly
  as before.

## 7. Eval impact

This sprint does **not** change the published eval numbers. Raw model
accuracy (~63% overall, ~42% on the adversarial slice) is unchanged.
Rules-only category-code match is unchanged.

What this sprint sets up:

- Every rule now carries an `intent`. Coverage stat is easy to compute.
- `resolve_category_for_intent` is a one-line call from the eval CLI.
- A new eval mode "rules-only-with-mapping" can be added in the next
  sprint without touching the data model.

The honest answer for now: the deltas will be visible once the eval
CLI ships the new mode. This PR refuses to invent numbers — the
mapped-rule eval column would be vapor until the harness runs it.

## 8. Handoff impact

The handoff markdown export is now meaningfully more useful for the
accountant:

- v2 entries show the *question* alongside the answer.
- Free-text owner notes carry through verbatim.
- Accountant-follow-up entries are tagged with a bolded
  `[needs accountant follow-up]` marker.
- Suggested resolutions surface as `vendor_payment` /
  `owner_draw` / `customer_revenue` so an accountant doing batch
  triage can `grep` the export.
- Legacy v1 review notes (any pre-v2 row) still render, in their own
  block so the accountant knows which entries lack the v2 structure.

The trust panel and CleanupImpactSummary are unchanged — the new
fields are context, not new finalization paths.

## 9. Honesty constraints preserved

- ✅ No "100% AI accuracy" claim anywhere.
- ✅ No "100% accurate AI" / "raw model accuracy of 100" — assertions
  in the existing page-content + walkthrough tests still pass.
- ✅ Trust metric is workflow-level. A row is verified iff
  rule-auto-approved, memory-replayed, or human-reviewed. The
  `accountant_follow_up_required` flag is metadata; it does NOT change
  what counts as verified.
- ✅ Fictional sample scenario disclaimers untouched.
- ✅ "Not tax advice or a substitute for accounting review" disclaimer
  still in the handoff markdown export.
- ✅ Demo-stub mode unchanged. The Anthropic SDK is still never
  imported in demo mode (regression test still passes).
- ✅ No email / phone / resume / `tel:` / `mailto:` added anywhere.

## 10. Tests added / updated

### Backend — 163 passed (was 146, +17)

| New file | Tests | Coverage |
|---|---:|---|
| `tests/api/test_owner_answers.py` | 8 | Persistence of all 6 v2 fields on `/correct`, `/approve`, `/uncategorizable`; v1 callers still work without v2 fields; handoff JSON exposes the structured fields; markdown renders the structured block + the legacy fallback block; accountant follow-up flag drives the amber treatment in the markdown. |
| `tests/test_rule_mapping.py` | 7 | Loader picks up `intent`; resolver returns mapped code when present, falls back to rule's code when intent is unknown / None; Granite State overrides (parts_inventory → 5010, internet_telecom → 6150); default map has no `parts_inventory`; `active_business_id()` resolves to Granite State via SAMPLE_SCENARIO. |
| `tests/api/test_rules_mapping.py` | 2 | `/rules` endpoint returns the mapping snapshot keyed to Granite State; e2e categorize call hits `rule.intuit.software` and persists with `model_provider="rule_categorizer"` + the mapped code. |

All 146 prior backend tests continue to pass unchanged.

### Frontend — 154 passed (was 146, +8)

| Test | Coverage |
|---|---|
| `page-content.test.ts` `/questions` | Owner Answers v2 template keys (8 stable keys present); `accountantFollowUp + suggestedResolution` carried; owner-note `<textarea>` rendered; helper copy explaining the handoff destination; amber accountant-review treatment on follow-up answers. |
| `page-content.test.ts` `/handoff` | `owner_question_key`, `owner_answer_label`, `owner_note`, `Suggested resolution`, "Needs accountant follow-up" badge all surface. |
| `page-content.test.ts` `/rules` *(new section)* | Per-business mapping copy; Active business mapping card; Intent + Mapped category columns; shared `LoadingState`/`ErrorState`; "safe fallback" language for unmapped intents; reference to `business_rule_maps`. |

All 146 prior frontend tests continue to pass unchanged.

### Build / lint / typecheck

- `cd backend && pytest -q` → **163 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → 89 files already formatted
- `cd backend && mypy --strict src` → no issues found in 59 source files
- `cd frontend && npm test -- --run` → **154 passed (11 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build

## 11. Mobile / tablet QA notes

New surfaces in this sprint inherit the existing responsive treatment:

- **`/questions` owner-note textarea** — full-width `w-full`, `rows={2}`,
  `resize-y`. Stacks below the answer-button grid on phones.
- **`/questions` accountant-review treatment** — amber border + a
  smaller `· accountant review` subtitle that wraps under the answer
  label on narrow screens without breaking the grid.
- **`/handoff` v2 cards** — `flex flex-wrap items-baseline
  justify-between gap-2` so the date / description / amount line wraps
  cleanly at 360px.
- **`/rules` Active business mapping card** — `grid grid-cols-1
  sm:grid-cols-2 lg:grid-cols-3` so the 24-entry intent grid
  single-columns on phones, 2-up on tablets, 3-up on desktop.
- **`/rules` table** — existing `overflow-x-auto` wrapper still
  contains horizontal scroll inside the card boundary; the new Intent
  + Mapped category columns inherit it.

A manual responsive pass at 360 / 375 / 430 / 768 / 1024 / 1280 is
recommended before LinkedIn announcement but no blocking issues are
expected.

## 12. Remaining weaknesses

- **Eval CLI doesn't yet emit a mapped-rule metric.** Plumbing is in
  place (every rule has an intent, resolver is callable from Python);
  CLI wiring deferred to the next sprint.
- **Single-tenant.** "Active business" is hard-pinned to Granite State.
- **The mapping is static Python.** No admin UI; no per-tenant
  configuration table.
- **Question templates are in code.** No admin UI.
- **No per-vendor answer memory.** An owner who answered "office
  supplies" for AMAZON last month still re-answers next month.
- **No accountant-side workflow.** Handoff is still one-way export.
- **`/cleanup` impact summary unchanged.** It already distinguishes
  rules-or-memory vs review counts; the new intent layer doesn't
  change those numbers.

## 13. Recommended next PR

In priority order:

1. **Wire the mapped-rule eval mode into the eval harness.** Add a
   new eval mode that runs the rules layer with the business mapping
   applied and reports intent coverage + post-mapping category match,
   then update `/evals` with the honest delta. The data model and
   resolver are in place; only the eval CLI needs the new mode. This
   directly capitalises on the plumbing this sprint just shipped.
2. **Auto-derive a per-tenant rule map from correction memory.**
   After N corrections of `(merchant → category)`, generate a
   tenant-specific rule layer that bypasses the model entirely for
   that merchant. Pairs naturally with #1.
3. **Owner-question answer memory.** When a vendor recurs and the
   owner already answered for it, pre-select the same answer (or
   auto-resolve at low risk).
4. **QuickBooks-friendly CSV export mapping.** Map the handoff CSV
   to IIF or QuickBooks Online's import format so the handoff plugs
   directly into an accountant's QuickBooks setup with no
   transformation.
5. **Per-tenant `Business` model + a mapping admin UI.** Turn the
   single-tenant assumption into multi-tenant.

The recommended single next PR is **#1 (mapped-rule eval mode)**
because it directly captures the credibility win this sprint set up:
the rule layer is intent-aware *now*; the eval just needs to report
it.
