# Owner Answers v2 + per-business rule mapping — audit

## 1. Current owner-question behavior

`frontend/src/app/questions/page.tsx` ships eight `QuestionTemplate`
entries (deposits, owner transfers, ACH / wire / paper checks, parts
vendors, home-improvement stores, big-box ambiguous, fuel,
subscriptions) plus a default template. Each template matches against
the transaction description / merchant, presents a single
`question: string`, and offers 4–6 `Answer` choices. Each answer has:

- `label: string` — what the owner sees
- `note: string` — a hardcoded plain-English string stamped into
  `ReviewDecision.reviewer_note` on submit
- `categoryCode?: string` — when set, the page calls
  `/review-queue/{tx}/correct` with that code; when unset, it calls
  `/review-queue/{tx}/approve` with the note only

On the backend, `ReviewDecision` has exactly seven columns:
`id`, `transaction_id`, `categorization_result_id`, `reviewer_action`
(enum), `selected_category_code`, **`reviewer_note`**, `created_at`.
Everything the owner says today lives in `reviewer_note`.

## 2. Current limitations of storing answers only as notes

1. **No question identity.** A note like `"Owner: shop parts
   inventory."` doesn't record *which* question was answered. The
   handoff markdown shows the note verbatim but the accountant has to
   reverse-engineer the question from the description.
2. **No follow-up flag.** "Needs accountant review" and "Not sure"
   both stamp a note and approve / mark-uncategorizable the row, but
   there's no structured `accountant_follow_up_required` boolean. The
   handoff has to pattern-match "accountant review" inside the note
   text to surface follow-ups.
3. **No separation of suggested vs verified category.** When the
   owner picks "Vendor payment → 6080 Professional Services", the row
   gets corrected to 6080 and counts as verified. But "vendor
   payment" is the owner's intent label, not a careful accounting
   decision — the trust metric doesn't distinguish "owner gave
   business context" from "row is provably in 6080".
4. **No owner free-text field.** An owner who picks "Reimbursement"
   has no way to add "Jon, brake job subcontract" — the most useful
   accountant context is impossible to capture.
5. **No reliable way to render structured handoff sections.** The
   markdown "Questions answered by owner" section iterates owner
   answers and renders a bullet; it can't group by question type
   ("Owner draws", "ATM withdrawals to confirm") because that
   metadata isn't persisted.

## 3. Current deterministic rule behavior

`backend/src/ledgerlens/data/category_rules.json` has ~25 rules. Each
rule has `id`, `name`, `active`, `priority`, `match_type`,
`merchant_patterns`, `description_patterns`, `category_code`,
`confidence`, `explanation`, `notes`. The `Rule` dataclass in
`services/rule_categorizer.py` is a frozen dataclass with the same
field set.

When a rule matches a transaction, `find_rule_match()` returns the
rule's `category_code` (e.g. `6070 Software Subscriptions`) verbatim.
The categorize service stamps a `CategorizationResult` with
`model_provider="rule_categorizer"`, `predicted_category_code=<rule's
category_code>`. If confidence ≥ auto-threshold (0.9), the row
auto-approves; if not, it routes to review.

There is no intent layer. A rule that says "NAPA Auto Parts → 5010
Cost of Goods Sold" hard-codes the COA code. If a different business
uses a different code for its parts purchases — say 6175 Parts &
Supplies — the rule doesn't apply, and rules-only eval credit goes
to zero on that vendor.

## 4. Why generic rules can fail against business-specific COA labels

The default chart of accounts (`backend/src/ledgerlens/seed.py`) is a
deliberately generic 29-row SMB COA. Real businesses don't use that
COA. An auto repair shop typically wants:

- A **Parts & Inventory** code (e.g. 5010 or 6175), not just "Cost
  of Goods Sold".
- A separate **Vehicle Maintenance** code distinct from **Fuel &
  Vehicle**.
- Possibly a **Customer Cores** sub-account on returnable parts.

A restaurant wants:
- A **Food & Beverage Inventory** code.
- Separate **Equipment Maintenance** vs **Building Repair**.

If LedgerLens generates a rule that says "NAPA → 5010" and the
business's 5010 doesn't exist (or is named differently), the rule
either fails to validate at load time or routes the matched row to
review. Either way the rule layer scores zero for that vendor on
that business. The eval harness can't tell the difference between
"the rule was wrong" and "the rule's intent was right, but the COA
label didn't match."

This matters for the eval credibility story. The honest answer is
that deterministic rules are *intent-correct* for most repeating
vendors; the gap is *label-resolution*, not classifier capability.

## 5. How structured owner answers and rule mapping support the same product goal

Both improvements share one underlying goal: **make LedgerLens's
deterministic + human layers more measurable and more useful in the
handoff package**.

- **Structured owner answers** give the handoff a labelled,
  follow-up-tagged context that the accountant can act on. They
  also create the foundation for cross-month memory (future
  improvement) since you now know what the owner *meant*, not just
  what they typed.
- **Per-business rule mapping** lets the rule layer hit the same
  *intent* across many businesses without having to ship a separate
  rule per COA variation. Eval credibility goes up because the
  rules-only mode can report intent-match coverage, not just literal
  category-code match.

The combined story for the handoff: rows with a clear deterministic
intent (parts, payroll, utilities) carry both their original rule
id *and* the resolved business category. Rows that came from an
owner question carry the question key, the labelled answer, the
optional free-text note, and an explicit `accountant_follow_up_required`
flag. The accountant reading the markdown export sees one coherent
story.

## 6. Proposed MVP scope

### A. Structured owner answers — extend `ReviewDecision`

Add five nullable columns to `ReviewDecision`:

- `owner_question_key: VARCHAR(64)` — e.g. `unknown_ach_transfer`
- `owner_question_text: VARCHAR(256)` — the question prompt
- `owner_answer_label: VARCHAR(128)` — the chosen answer's label
- `owner_note: VARCHAR(1024)` — free-text the owner typed
- `accountant_follow_up_required: BOOLEAN NOT NULL DEFAULT FALSE`
- `suggested_resolution: VARCHAR(64)` — a small enum-ish hint
  (`vendor_payment`, `owner_draw`, `customer_revenue`, etc.)

Reasoning: option B from the prompt. A new `OwnerAnswer` table would
duplicate `ReviewDecision`'s lifecycle, audit trail, and trust-metric
plumbing. Five columns on the existing table reuses all that.

Migration story: LedgerLens uses `create_all()` on startup (no
Alembic). New nullable columns appear on next start. Existing rows
keep `NULL` and continue to work.

### B. Question templates — add question keys + structured behavior

Each `QuestionTemplate` gets:
- `key: string` — e.g. `unknown_ach_transfer`
- existing `question`, `match`, `answers`
- each `Answer` gets:
  - `accountantFollowUp?: boolean`
  - `suggestedResolution?: string`

When the page submits, it sends the new fields to the backend.

### C. Per-business rule intent mapping

Add `intent: string | None` to the `Rule` dataclass + JSON entries
that benefit (NAPA → `parts_inventory`, ADP → `payroll`, Comcast →
`internet_telecom`, etc.).

Add a tiny `business_rule_maps.py` module with two maps:
- `DEFAULT_INTENT_MAP` — safe generic mapping (most intents resolve
  to the closest default-COA code; some resolve to `None` to force
  review).
- `GRANITE_STATE_INTENT_MAP` — Granite State Auto Repair's
  preferred resolution for each intent.

Add an `apply_business_mapping(intent, fallback_code, business_id)`
helper. Active business is determined by the sample-scenario module
(single-tenant for now). When `intent` is set and a mapping
override exists, use the mapped code; otherwise fall back to the
rule's original `category_code`.

When a rule has `intent` but the active business has *no* mapping
for it (and no fallback), the row routes to review with
`model_provider="rule_unmapped"` instead of being silently
miscategorized.

### D. Eval credibility — add intent coverage stat

The eval harness gains one additional reporting field per run:
`rule_intent_coverage` — the fraction of transactions where a rule
matched **and** the active business mapping resolved a category. This
is the honest "how often does deterministic-with-intent-mapping
land?" number. Old metrics (rules-only label accuracy) stay where
they are — nothing is hidden.

### E. UI surfacing

- `/questions` — optional owner note `<textarea>`; helper copy;
  small "will be flagged for accountant review" warning on
  follow-up answers.
- `/handoff` — render the structured fields (question, label, note,
  follow-up badge) in the Questions-answered-by-owner section.
- `/rules` — show rule `intent` next to each rule; show the
  Granite State mapping panel.
- `/evals` — optional small callout explaining rule-intent
  coverage.

## 7. What should wait for later

- **A separate `OwnerAnswer` table.** Useful when the accountant
  becomes a collaborator and answers themselves; out of scope here.
- **Multi-tenant `Business` table with per-tenant COA, intent map,
  and rule layer.** This sprint keeps single-tenant and uses the
  sample-scenario identity to pick the active map.
- **An admin UI for editing the intent map.** Out of scope. The map
  lives in Python.
- **Generating per-tenant rules from accumulated correction
  memory.** Listed as the next-PR candidate; intentionally
  separate.
- **Question-template editing UI.** Templates stay in code.
- **Accountant collaboration / shared notes / approvals.** Out of
  scope; the handoff stays a one-way export.

## 8. Risks and honesty constraints

- **Owner answers are not verified accounting decisions.** The
  trust metric must continue to count only rule-auto-approvals,
  correction-memory replays, and explicit human reviews as
  *verified*. An owner picking "Vendor payment" is business
  context, not a verified category.
- **The `accountant_follow_up_required` flag is a hint, not a
  guarantee.** Setting it true doesn't excuse the accountant from
  looking at any row; it just helps them triage.
- **Per-business mapping can mask label bugs.** A bad mapping
  could route NAPA to a wrong category for a business and the eval
  number wouldn't catch it on the rule layer. Mitigation: ship a
  conservative default map; require the demo's Granite State map
  to be defensible per row.
- **Trust contract unchanged.** A row that came from a rule with an
  intent mapping is still verified iff the mapped code is a valid
  COA category and confidence ≥ auto-threshold. No new path to
  verification.
- **Old reviewer_note answers stay readable.** The handoff still
  renders any pre-v2 `ReviewDecision.reviewer_note` as a legacy
  free-text answer.
- **`/evals` raw model accuracy numbers remain visible.** The new
  rule-intent coverage stat is an additional column, not a
  replacement.
- **No paid API calls.** Anthropic SDK still never imported in
  demo mode; the regression test still passes.
- **No new disclaimers removed.** "Fictional sample scenario" and
  "not tax advice or substitute for accounting review" remain
  intact.

## 9. Acceptance criteria for this sprint

- [ ] `ReviewDecision` carries `owner_question_key`,
  `owner_question_text`, `owner_answer_label`, `owner_note`,
  `accountant_follow_up_required`, `suggested_resolution`.
- [ ] `/review-queue/{tx}/correct|approve|uncategorizable`
  endpoints accept the new fields.
- [ ] `HandoffOwnerAnswer` schema surfaces the new fields.
- [ ] `/handoff/export.md` renders question key + answer label +
  follow-up flag + owner note.
- [ ] `/questions` ships question keys, optional owner-note input,
  follow-up warnings, and helper copy.
- [ ] `category_rules.json` rules gain `intent` where it applies.
- [ ] A small `business_rule_maps.py` ships `DEFAULT_INTENT_MAP`
  and `GRANITE_STATE_INTENT_MAP`.
- [ ] `rule_categorizer` resolves intents through the active
  business mapping; unmapped intents route to review.
- [ ] `/rules` shows rule intent + the Granite State mapping panel.
- [ ] Backend tests cover: structured owner answers persisted,
  follow-up flag set on "Needs accountant review" / "Not sure",
  handoff returns structured fields, markdown includes them, rule
  intent maps to Granite State category, unmapped intent routes to
  review.
- [ ] Frontend tests cover: question templates carry keys,
  follow-up warning rendered, owner-note field present, handoff
  renders structured fields.
- [ ] Honesty contracts preserved: no 100% AI accuracy claim, no
  removal of sample-scenario / not-tax-advice disclaimers, demo
  mode unchanged, Anthropic SDK still not imported.
- [ ] All 146 + 146 existing tests still pass.
