# Owner Questions v2

## 1. Why owner answers needed structure

Owner Questions v1 (PR #36, the original "monthly cleanup assistant" sprint)
ships a `/questions` page that projects the review queue as plain-English
multiple-choice prompts. The user answers, the page submits to
`/review-queue/{tx}/correct|approve|uncategorizable`, and a static
`reviewer_note` string is stamped onto the resulting `ReviewDecision`.

That worked, but it had four limitations the handoff couldn't paper over:

1. **No question identity.** A note like `"Owner: shop parts inventory."`
   doesn't record *which* question template was answered. The handoff
   markdown shows the note verbatim, so the accountant has to reverse-engineer
   the question from the description.
2. **No follow-up flag.** "Needs accountant review" and "Not sure" both
   stamped a note and approved / marked-uncategorizable the row, but there
   was no structured boolean for "this row needs accountant attention."
3. **No owner free-text field.** An owner who picked "Reimbursement" had
   no way to add "Jon, brake job subcontract." The most useful accountant
   context was impossible to capture.
4. **No way to group the handoff section.** The markdown "Questions
   answered by owner" section rendered a flat bullet list because the
   metadata to group by wasn't persisted.

## 2. Implementation — extend `ReviewDecision` (option B)

Adding a separate `OwnerAnswer` table would have duplicated `ReviewDecision`'s
lifecycle, audit trail, and trust-metric plumbing. We picked option B from
the audit: five nullable columns + one boolean on `ReviewDecision`:

```python
owner_question_key: VARCHAR(64)        # e.g. "unknown_ach_transfer"
owner_question_text: VARCHAR(256)      # the prompt the owner saw
owner_answer_label: VARCHAR(128)       # the chosen answer's label
owner_note: VARCHAR(1024)              # free-text the owner typed
suggested_resolution: VARCHAR(64)      # e.g. "owner_draw", "vendor_payment"
accountant_follow_up_required: BOOLEAN NOT NULL DEFAULT FALSE
```

Migration: LedgerLens uses `create_all()` at startup (no Alembic). New
nullable columns appear on next start. Existing rows keep `NULL` and
continue to work. The original `reviewer_note` column is unchanged — v1
free-text answers still live there and the handoff renders them as a
legacy block (see §3).

### API surface

The three review-queue endpoints (`/approve`, `/correct`, `/uncategorizable`)
now accept the optional Owner Answer fields in their JSON body:

```jsonc
POST /review-queue/{tx}/correct
{
  "selected_category_code": "5010",
  "reviewer_note": "Owner: shop parts inventory.",
  "owner_question_key": "parts_vendor",
  "owner_question_text": "What were these parts for?",
  "owner_answer_label": "Shop inventory",
  "owner_note": "PO #88421 — Q1 stock replenish.",
  "suggested_resolution": "parts_inventory",
  "accountant_follow_up_required": false
}
```

v1 callers (the `/review` page that doesn't know about question keys) work
unchanged — all fields default to `null` / `false`.

## 3. How answers appear in the handoff

`HandoffOwnerAnswer` carries the new fields. The handoff service
surfaces a row when either:

- it has a structured `owner_question_key` (v2 path), **or**
- it has a non-empty legacy `reviewer_note` (v1 path).

The markdown export splits the section into a labelled v2 block followed
by a "Legacy review notes (pre-v2)" block:

```markdown
## Questions answered by owner

- **2026-03-25 · OWNER TRANSFER TO PERSONAL** (-1500.00 USD) → [3030] Owner Distributions
    - Question: What was this transfer?
    - Owner answer: **Owner draw**
    - Owner note: Pulled cash for personal use.
    - Suggested resolution: `owner_draw`
- **2026-03-19 · ATM WITHDRAWAL TD BANK** (-200.00 USD) **[needs accountant follow-up]**
    - Question: What was this transfer?
    - Owner answer: **Needs accountant review**
    - Owner note: Branch withdrawal — need to confirm with bookkeeper.

### Legacy review notes (pre-v2)

- **ADOBE CC** (correct → [6080] Professional Services): Move to consulting.
```

The `/handoff` UI renders the v2 entries with their own card style; rows
where `accountant_follow_up_required == true` get an amber border + a
"Needs accountant follow-up" badge.

## 4. How accountant follow-up is flagged (v2 safe semantics)

Each template's `Answer` carries an explicit `resolutionAction`:

| Action | Backend call | Status after | Verified? |
|---|---|---|---|
| `"correct"` | `correctReview` (requires `categoryCode`) | `CORRECTED` | yes |
| `"approve_prediction"` | `approveReview` | `AUTO_APPROVED` | yes |
| `"needs_accountant_review"` | `markForAccountantReview` (new) | `ACCOUNTANT_REVIEW_REQUIRED` | **no** |
| `"exclude"` | `markUncategorizable` | `UNCATEGORIZABLE` | no |

The `/questions` page renders any answer with
`resolutionAction === "needs_accountant_review"` with an amber border
plus a "· accountant review" subtitle. The handler is a `switch` on
`resolutionAction` — it does not infer the backend endpoint from
`categoryCode` presence.

Backend backstop: `POST /approve` returns 422 if
`accountant_follow_up_required=true`, so a frontend regression cannot
silently re-introduce the bug.

## 5. What does and does not become verified

| Owner answer | What happens | Verified by trust metric? |
|---|---|---|
| A choice with `resolutionAction: "correct"` (e.g. "Shop inventory" → 5010) | `/correct` is called with the code. `ReviewDecision` records the owner answer + the corrected code. Status becomes `CORRECTED`. | **Yes** — human review with a chosen category. |
| `resolutionAction: "approve_prediction"` (e.g. "It's a normal business expense — approve the predicted category") | `/approve` is called. Status becomes `AUTO_APPROVED`. | **Yes** — the row was explicitly approved by a human. |
| `resolutionAction: "needs_accountant_review"` (e.g. "Needs accountant review", "Not sure", "Refund — confirm with accountant") | `/accountant-review` is called. Status becomes `ACCOUNTANT_REVIEW_REQUIRED`. **No predicted category is adopted.** | **No** — the row is not finalized. |
| `resolutionAction: "exclude"` (e.g. "Personal / non-business") | `/uncategorizable` is called. Status becomes `UNCATEGORIZABLE`. | **No** — uncategorizable rows are not finalized. |
| "Skip — exclude from books" (the skip button) | `/uncategorizable` is called. Status becomes `UNCATEGORIZABLE`. | **No** — uncategorizable rows are not finalized. |
| "Needs accountant review" + a category code | The row is corrected, but the follow-up flag is set. Accountant sees the flag in the handoff. | **Yes** — same as any reviewed row. The flag is metadata, not a verification gate. |
| "Not sure" | `/approve` with the note; follow-up flag set. | **Yes** — but the flag tells the accountant to double-check. |

Honesty contract preserved: the trust metric stays workflow-level, not
raw model accuracy. An owner's plain-English answer is *business
context*, not an accounting decision.

## 6. Limitations

- **No accountant-side workflow.** The handoff is still one-way export.
  The accountant reads the structured fields but can't write back.
- **No multi-month memory of question/answer pairs.** Each row is
  answered fresh. A future improvement: when a vendor recurs and the
  owner already answered "office supplies" last month, suggest the
  same answer (or auto-resolve at low risk).
- **Single question per row.** The template engine picks one template
  per row. A row that's ambiguous in two ways (e.g. a Stripe deposit
  that might also be a refund) gets one prompt, not a sequence.
- **Templates are in code.** No admin UI to edit them; templates live in
  `frontend/src/app/questions/page.tsx` and ship with the deploy.
- **Free-text note is owner-side only.** An accountant can't add a
  reply note to the same row inside LedgerLens.

## 7. Future improvements

In priority order:

1. **Per-vendor answer memory.** If the owner already answered
   "office supplies" for AMAZON MARKETPLACE last month, surface that
   as the default selection (or skip the question) on next month's
   AMAZON MARKETPLACE row.
2. **Accountant reply / annotation layer.** Let an accountant add a
   structured note that travels back into a `ReviewDecision`. Pairs
   with #1.
3. **Question template config in the database.** Move templates out of
   code so a bookkeeper can edit them per business.
4. **Confidence-aware question routing.** Highest-uncertainty rows
   first; auto-batch low-risk identical questions.
5. **Multi-language templates.** The current set is English-only.

Listed in the sprint review (`docs/OWNER_ANSWERS_AND_RULE_MAPPING_REVIEW.md`)
under "Recommended next PR."
