# Review safety + mobile queue + productization-foundation sprint review

## 1. What changed

A coordinated sprint that closed the most important trust-boundary
hole, made the review queue safer on phones, and laid down the
production-readiness foundations the next sprint needs.

Top-level deliverables:

1. Critical safety bug fixed end-to-end.
2. Backend safety backstop.
3. `/questions` semantics rewritten with an explicit `resolutionAction`.
4. Handoff / trust logic updated to never silently mix follow-up rows
   into the ready-for-accountant bucket.
5. `/review` rebuilt with four explicit actions + mobile-friendly
   layout + progress indicator.
6. Request-ID middleware + structured-logging foundation + redaction
   utility.
7. Category mapping explorer at `/mapping`.
8. Two new accountant-friendly CSV exports.
9. Auth / tenant foundation doc.
10. Live-copy claims regression sweep.
11. Eval workflow supports the full categorizer set with a no-cost
    default.

## 2. Critical unsafe behavior fixed

`/questions` used to call `approveReview()` for any answer without
`categoryCode`. "Needs accountant review" and "Not sure" answers
finalized the model's predicted category and inherited the verified
badge.

Fixed by:

- New `ResultStatus.ACCOUNTANT_REVIEW_REQUIRED` enum value.
- New `ReviewerAction.MARK_FOR_ACCOUNTANT_REVIEW` enum value.
- New endpoint `POST /review-queue/{tx}/accountant-review` that
  records a `ReviewDecision` without adopting a category and sets
  the result status to the new value.
- `/questions` `Answer` type now carries an explicit
  `resolutionAction` and the handler is a `switch` on it.

End-to-end test
(`test_accountant_review_does_not_finalize_predicted_category`)
proves the new status leaves the row unfinalized.

## 3. Backend safety backstop

`POST /review-queue/{tx}/approve` returns 422 when
`accountant_follow_up_required=true`. Even if the frontend regresses,
the trust boundary holds. Locked in by
`test_approve_endpoint_rejects_accountant_follow_up_flag`.

`_is_verified()` returns False for any `auto_approved` / `corrected`
row whose latest review decision carries
`accountant_follow_up_required=True`. Protects pre-existing data and
any non-API path.

## 4. Owner-answer action semantics before / after

| Old behavior | New behavior |
|---|---|
| `answer.categoryCode` → `correctReview` | `resolutionAction === "correct"` → `correctReview` (requires `categoryCode`) |
| `!answer.categoryCode` → `approveReview` | `resolutionAction === "approve_prediction"` → `approveReview` |
| (impossible) | `resolutionAction === "needs_accountant_review"` → `markForAccountantReview` |
| (skip button only) | `resolutionAction === "exclude"` → `markUncategorizable` |

Templates were updated to add `resolutionAction` to every answer.
"Personal / non-business" rows now route to `exclude`. The default
template's "It's a normal business expense — approve the predicted
category" row routes to `approve_prediction`.

## 5. Handoff / trust impact

- `HandoffOut.accountant_review_required` is a new list of rows
  whose status is `accountant_review_required` (or whose follow-up
  flag is set on an auto_approved/corrected row).
- The markdown handoff splits the old "Needs review" section into
  "Owner flagged for accountant review" and "Pending — model could
  not finalize".
- `LedgerRow` gains `accountant_follow_up_required`,
  `owner_answer_label`, `owner_note` for CSV export and downstream
  rendering.
- Trust metric counts `accountant_review_required` rows in the
  `review_required_count`.
- Existing tests pin every behavior; new tests
  (`test_handoff_excludes_accountant_review_from_ready`,
  `test_handoff_markdown_flags_accountant_review_section`) prove the
  follow-up rows never silently end up in `ready_for_accountant`.

## 6. Mobile review queue before / after

| Old | New |
|---|---|
| Three actions (Approve / Correct / Mark uncategorizable) | Four actions (Approve / Correct / Needs accountant review / Exclude) |
| Flat row of buttons | Responsive grid: 1 col on phone, 2 on small, 4 on large |
| 1.5em buttons | `min-h-[44px]` tap targets |
| No progress indicator | Pending count + `aria-live="polite"` + `data-testid="review-progress"` |
| No accountant-review path | First-class amber-tinted action that calls the safe endpoint |
| Copy: "Approve to accept, correct to override…" | Copy: explicit list of the four primary actions |

## 7. Request ID / logging / redaction foundation

New `backend/src/ledgerlens/observability.py`:

- `RequestIdMiddleware` — validates inbound `X-Request-ID`,
  generates UUID if missing, echoes on response. CORS now exposes
  the header.
- `configure_logging()` — root-logger baseline with request_id in
  every record via `RequestIdFilter`. Idempotent.
- Targeted redactors: `redact_email`, `redact_phone`,
  `redact_account_number_like`, `redact_card_like`.
- `sanitize_for_log(value, max_len=80)` — combined helper for the
  call site every future logger emission should use.

`main.py` wires the middleware ahead of CORS and calls
`configure_logging()` at module load.

11 new tests cover the middleware behavior, malformed-id rejection,
and every redactor.

## 8. Category mapping explorer

New `/mapping` route. Read-only this sprint:

- Shows the active business name + summary counts (mapped,
  blocked-fallback, unmapped intents).
- Lists every mapped intent → COA code.
- Surfaces blocked-fallback intents with amber styling.
- Surfaces unmapped intents with a "rule default in use" label.
- Links to `/rules` and `/technical-story` for context.
- Explicit copy: editable per-business mapping needs the auth /
  tenant foundation.

Backend `BusinessRuleMapOut` now returns
`block_fallback_intents` and `unmapped_intents` so the page can
surface them without re-deriving.

## 9. Accountant CSV export changes

Two new endpoints:

- `GET /handoff/export.reviewed.csv` — finalized + verified rows.
- `GET /handoff/export.followup.csv` — accountant-review rows +
  pending rows, separated.

Column set: Date, Description, Merchant, Amount, Currency, Suggested
Category, Category Code, Review Status, Verification Source, Owner
Answer, Owner Note, Accountant Follow-Up Required, Source,
Transaction ID.

`/handoff` exposes both via dedicated download buttons with copy
that says "Not a QuickBooks import file" and "Not a true accounting
ledger." No QBO / IIF / Xero claims.

## 10. Auth / tenant foundation work

`docs/AUTH_TENANT_FOUNDATION.md` documents:

- Current no-auth demo state.
- Proposed entities (User, Tenant, Membership, Business, Account,
  BusinessIntentMap, AuditEvent extensions, Session).
- Tenant scoping rules.
- Migration + backfill strategy.
- API authorization strategy.
- Phased route protection plan (Phase 0 → Phase 4).
- Explicit list of what this sprint does and does not do.

No tables added. No login UI. No protected routes. The doc is the
blueprint a future implementation PR follows.

## 11. Claims regression sweep results

Live-surface phrases that conflicted with the productization
boundary, now fixed:

- `/app`: "verified ledger export" → "reviewed accountant handoff".
- `/app`: "Bring a real bank export" → "Use the sample CSV or
  synthetic test data".
- `/demo`: "Postgres-ready persistence" → "SQLAlchemy models, SQLite
  for the public demo (Postgres-compatible in principle)".
- `/review`: "final ledger export" → "reviewed categorization export".
- `TrustPipeline`: "Verified ledger export" → "Reviewed
  categorization handoff" + "not a true accounting ledger".
- homepage: "Verified ledger rows separated" → "Procedurally
  verified rows separated"; "Verified ledger summary" → "Reviewed
  categorization summary".
- layout + site.ts: drop "verified ledger" from OG alt + title +
  description + tagline; add "Not production accounting software."
- README: "CSV ledger export" → "Reviewed categorization CSV export.
  Not a true accounting ledger."
- `GeneratedWalkthrough`: "Verified ledger, owner answers..." →
  "Reviewed categorization, owner answers...".
- `/technical-story`: "ledger export reflects review state" →
  "accountant handoff export reflects review state".

A dedicated test block in `page-content.test.ts` fails any
reintroduction.

## 12. Eval workflow update

`.github/workflows/eval.yml`:

- Categorizer choice expanded to `stub`, `rules-only`,
  `rules-only-mapped`, `hybrid-rules-model`,
  `hybrid-rules-model-mapped`, `claude-haiku-v1`.
- Default flipped to `rules-only-mapped` (deterministic, no cost,
  exercises the per-business mapping layer).
- Inline comments + the input description call out which modes
  require `ANTHROPIC_API_KEY` and incur cost.

## 13. Tests added / updated

| Suite | Before | After | Net |
|---|---|---|---|
| Backend | 202 | 221 | +19 |
| Frontend | 219 | 231 | +12 |

New / updated backend tests (highlights):

- `test_approve_endpoint_rejects_accountant_follow_up_flag`
- `test_approve_endpoint_still_accepts_explicit_approve`
- `test_accountant_review_endpoint_records_follow_up_decision`
- `test_accountant_review_does_not_finalize_predicted_category`
- `test_accountant_review_row_is_unfinalized`
- `test_handoff_excludes_accountant_review_from_ready`
- `test_handoff_markdown_flags_accountant_review_section`
- `test_reviewed_csv_export_has_accountant_columns`
- `test_reviewed_csv_export_excludes_follow_up_rows`
- 11 new tests in `test_observability.py` (middleware + redactors)

New frontend tests (highlights):

- `claims regression sweep — live surfaces` block:
  - "no live route says 'verified ledger export'"
  - "/app does not tell users to bring a real bank export"
  - "/demo no longer says bare 'Postgres-ready'"
  - "/review no longer says 'final ledger export'"
  - "homepage says 'procedurally verified' not 'verified ledger rows'"
  - "TrustPipeline final step labels itself as a categorization handoff"
  - "site lib title/description no longer claims a verified ledger"
- `review page mobile-first content` block:
  - "offers all four explicit actions"
  - "Needs accountant review calls the safe endpoint, not approve"
  - "action buttons have at least 44px tap targets"
  - "shows a progress indicator"
- `/questions`:
  - "never silently approves a Needs accountant review answer"
  - "records owner answers via the four explicit resolution endpoints"

## 14. Remaining weaknesses

- No auth / tenant tables yet. Demo is still single-tenant.
- No editable per-business mapping. `/mapping` is read-only.
- No dedicated one-card-per-viewport mobile review queue. The
  current `/review` is mobile-friendly but still desktop-shaped.
- No real CI runs against a phone-sized viewport (Playwright /
  device runs are future work).
- No QBO / IIF / Xero exports.
- No bulk review actions.
- No two-way accountant collaboration.
- No split transactions.
- JSON-structured logging is the next upgrade; current logger is
  text-format.
- No rate limiting on public routes.

## 15. Recommended next PR

Pick the highest-impact item that does not need auth:

1. **Editable category mapping** — needs auth / tenant scoffolding
   first, so do auth foundation Phase 1.
2. **Auth + tenant Phase 1** (User / Tenant / Membership / Session
   tables + login UI behind a `/admin` route) — unblocks (1) and (3)
   and (6).
3. **Two-way accountant collaboration** — reply threads on review
   items. Needs auth.
4. **Split transactions** — model + UI work; does not need auth.
5. **JSON-structured logging + frontend request-id surfacing** —
   Phase B finish.
6. **Real Loom recording + launch assets** — marketing surface
   refresh.
7. **QBO / IIF export research spike** — figure out the COA → list
   id mapping problem.
8. **Persistent eval artifact rotation** — bigger eval surfaces +
   automatic comparison summaries.

The blunt recommendation: do auth Phase 1 next, because items 1, 3,
and 6 all depend on it.
