# Review safety semantics audit

A blunt audit of how owner-question and review answers flow through the
backend, why the current behavior can silently finalize a row that the
owner explicitly flagged for accountant follow-up, and the path to a
safe semantics.

## 1. Current review/owner-question behavior

### Frontend: `/questions` (`frontend/src/app/questions/page.tsx`)

The handler picks a backend endpoint **based only on whether the answer
carries a `categoryCode`**:

```ts
if (answer.categoryCode) {
  await correctReview(id, answer.categoryCode, answer.note, ownerFields);
} else {
  await approveReview(id, answer.note, ownerFields);
}
```

This is the bug. Any answer without a `categoryCode` — including
"Needs accountant review", "Not sure", "Refund of a business expense
(confirm with accountant)", and "Loan payment — confirm" — calls
`approveReview()`.

`ownerFields.accountant_follow_up_required` is sent to the backend, but
the approve endpoint does not branch on it.

### Frontend: `/review`

`/review` is closer to safe because the three buttons map directly to
the three backend actions (`Approve prediction` → `approveReview`,
`Correct` → `correctReview`, `Mark uncategorizable` →
`markUncategorizable`). But it does not have an explicit
"Needs accountant review" path, so the only escape for an uncertain row
is "Mark uncategorizable" — which excludes the row from books entirely.

### Backend: `POST /review-queue/{tx}/approve`
(`backend/src/ledgerlens/api/review.py`)

The approve handler unconditionally:

```py
decision = ReviewDecision(
    ...
    reviewer_action=ReviewerAction.APPROVE,
    selected_category_code=latest.predicted_category_code,
    accountant_follow_up_required=payload.accountant_follow_up_required,
)
latest.status = ResultStatus.AUTO_APPROVED
```

So the latest categorization result for the transaction transitions to
`AUTO_APPROVED` and **adopts the predicted category** as the final
category, regardless of `accountant_follow_up_required`.

### Backend: ledger trust (`backend/src/ledgerlens/api/ledger.py`)

`_is_verified()` returns `True` for any row where `row.reviewed` is
true:

```py
def _is_verified(row: LedgerRow) -> bool:
    if not _is_finalized(row):
        return False
    if row.reviewed:
        return True
    ...
```

`reviewed=True` is set whenever any `ReviewDecision` exists for the
transaction. The `accountant_follow_up_required` flag is not consulted.

### Backend: handoff (`backend/src/ledgerlens/services/handoff.py`)

`build_handoff()` produces `ready_for_accountant` by:

```py
ready = [r for r in rows if _is_verified(r)]
```

So a row that came through `/questions` with "Needs accountant review"
ends up in `ready_for_accountant`, with the model's predicted category
stamped on it as the final code.

## 2. Why this is unsafe

Concrete failure case:

- A March 2026 row reads "ACH DEBIT — UNKNOWN COUNTERPARTY".
- The model predicts `[6080] Professional fees` at 0.55 confidence and
  routes the row to `NEEDS_REVIEW`.
- The owner answers "Needs accountant review" in `/questions`.
- `/questions` calls `approveReview()` because the answer has no
  `categoryCode`.
- Backend records a `ReviewDecision` with action `APPROVE`,
  `selected_category_code = "6080"`, **and** `accountant_follow_up_required = true`.
- The categorization result transitions to `AUTO_APPROVED`.
- The ledger marks the row as `reviewed=True`, `finalized=True`,
  `verified=True`.
- The accountant handoff places it in `ready_for_accountant` as
  `[6080] Professional fees`.
- The owner believes they raised a flag. The accountant sees a finalized
  row with a workflow-verified badge and the wrong category code.

The trust metric — "100% of finalized guided-demo rows are procedurally
verified before handoff" — silently collapses under this bug, because
the row carrying an explicit follow-up request is counted as verified.

## 3. Current statuses and how they affect finalized / verified counts

`ResultStatus` (in `backend/src/ledgerlens/models/categorization_result.py`):

| Status | `_is_finalized()` | `_is_verified()` when reviewed | Behavior in handoff |
|---|---|---|---|
| `AUTO_APPROVED` | True | **True if any review decision exists** | Ready for accountant |
| `CORRECTED` | True | True | Ready for accountant |
| `NEEDS_REVIEW` | False | False | Needs review |
| `UNCATEGORIZABLE` | False | False | Not in ledger; excluded |
| `REJECTED` | False | False | Not in ledger |
| `FAILED` | False | False | Not in ledger |

There is no status that means **"reviewed but explicitly deferred to an
accountant — do not finalize."**

## 4. How handoff currently treats ready vs needs-review rows

`render_markdown()` produces two transaction tables:

- `## Ready for accountant` — `_is_verified()` rows
- `## Needs owner / accountant review` — `categorization_status == "needs_review"`

And a separate `## Questions answered by owner` section that surfaces
`owner_answer_label`, `owner_note`, `accountant_follow_up_required`.
The follow-up flag is rendered as `**[needs accountant follow-up]**` in
that section.

But because the row is also in `ready_for_accountant` (via
`_is_verified`), an accountant looking only at the top table sees a
finalized row. The follow-up flag only shows up in a separate later
section that may be skipped on a quick scan.

## 5. Proposed safe behavior

Three coordinated fixes:

### A. New status: `ACCOUNTANT_REVIEW_REQUIRED`

Add a new `ResultStatus` value:

```py
ACCOUNTANT_REVIEW_REQUIRED = "accountant_review_required"
```

This status means: a human looked at the row and explicitly said
"this needs an accountant — do not finalize the predicted category."
It is **not** finalized and **not** verified by `_is_verified()`. The
row carries an associated `ReviewDecision` with structured owner-answer
context.

### B. New endpoint: `POST /review-queue/{tx}/accountant-review`

Records a `ReviewDecision` with:

- `reviewer_action = MARK_FOR_ACCOUNTANT_REVIEW`
- `selected_category_code = None`
- `accountant_follow_up_required = True`
- The owner-answer-v2 fields (`owner_question_key`,
  `owner_answer_label`, `owner_note`, `suggested_resolution`).

Sets `latest.status = ACCOUNTANT_REVIEW_REQUIRED`.

### C. Approve-endpoint backstop

`POST /review-queue/{tx}/approve` rejects any payload where
`accountant_follow_up_required = true` with a 422:

```
"Accountant-follow-up answers cannot approve a predicted category.
Use the accountant-review path."
```

This is a defensive backstop so a future frontend regression cannot
silently re-introduce the bug.

### D. Handoff / trust updates

- `_is_verified()` returns False for `ACCOUNTANT_REVIEW_REQUIRED`.
- `_is_verified()` returns False for any `AUTO_APPROVED` row whose
  latest `ReviewDecision.accountant_follow_up_required` is True
  (defensive: covers any legacy / non-API paths that might persist a
  follow-up flag on an approved row).
- Handoff splits the existing `needs_review` section into:
  - **Needs accountant review** — rows in `ACCOUNTANT_REVIEW_REQUIRED`,
    with the owner's question + answer label inline.
  - **Pending (model has not finalized)** — rows in `NEEDS_REVIEW` that
    do not have an explicit accountant-review decision.

### E. Frontend `/questions` semantics

Each `Answer` carries an explicit `resolutionAction`:

| Action | Backend call | Status after |
|---|---|---|
| `"correct"` | `correctReview` (categoryCode required) | `CORRECTED` |
| `"approve_prediction"` | `approveReview` | `AUTO_APPROVED` |
| `"needs_accountant_review"` | `markForAccountantReview` (new) | `ACCOUNTANT_REVIEW_REQUIRED` |
| `"exclude"` | `markUncategorizable` | `UNCATEGORIZABLE` |
| `"skip"` | (no-op, advance to next) | unchanged |

The current "It's a normal business expense — approve the predicted
category" answer becomes `approve_prediction`. Every other no-category
answer that the current code treats as approve becomes
`needs_accountant_review` or `exclude`, never silent approve.

### F. Frontend `/review`

Adds a fourth explicit primary action: "Needs accountant review".
Existing approve, correct, and mark-uncategorizable actions stay.

## 6. What should change now

- New `ResultStatus.ACCOUNTANT_REVIEW_REQUIRED` + new
  `ReviewerAction.MARK_FOR_ACCOUNTANT_REVIEW`.
- New endpoint `POST /review-queue/{tx}/accountant-review`.
- Approve endpoint rejects `accountant_follow_up_required=true` with 422.
- Ledger `_is_verified()` excludes ACCOUNTANT_REVIEW_REQUIRED and
  approved rows with a follow-up flag.
- Handoff splits the needs-review section into accountant-review and
  pending.
- `/questions` answer model gains `resolutionAction` and the handler
  branches on it.
- `/review` gets a "Needs accountant review" primary action.
- Tests prove every claim above.
- Docs explain follow-up rows are never counted as verified finalized.

## 7. What should wait

- Persistence of resolution audit trails beyond the existing
  `ReviewDecision` row — out of scope for this sprint.
- Resolving a follow-up row from inside LedgerLens via an accountant
  role — needs the auth/tenant foundation, which is design-only this
  sprint.
- A general "review state machine" with multi-stage decisions.
- A way for the owner to escalate a follow-up row to a specific
  accountant in the product (the handoff package is still the export
  surface).
- Migrations for legacy databases that already have
  `accountant_follow_up_required=true` flags on `AUTO_APPROVED` rows —
  the defensive check in `_is_verified()` handles those silently.

## 8. Acceptance criteria

1. "Needs accountant review" answer in `/questions` does **not** call
   `approveReview()`.
2. "Not sure" answer in `/questions` does **not** call `approveReview()`.
3. Backend `POST /approve` returns 422 if
   `accountant_follow_up_required=true`.
4. New `ACCOUNTANT_REVIEW_REQUIRED` rows are not finalized and not
   verified.
5. Handoff shows accountant-review rows in a labelled follow-up
   section, never silently mixed into `ready_for_accountant`.
6. Trust metric `verification_rate` does not change just because a
   follow-up row was answered.
7. `/review` has an explicit accountant-review action.
8. Tests prove 1-7.
