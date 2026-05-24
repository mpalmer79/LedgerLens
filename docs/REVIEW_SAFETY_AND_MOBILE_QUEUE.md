# Review safety and mobile-first review queue

## 1. Why this PR was necessary

Repo review surfaced that `/questions` could silently finalize a row
the owner explicitly flagged for accountant follow-up. The handler
inferred the backend endpoint from `categoryCode` presence, so any
answer without a category — including "Needs accountant review" and
"Not sure" — called `approveReview()`. The approve endpoint adopted
the model's predicted category and stamped the row verified.

That collapses the entire workflow-trust claim: a row carrying
`accountant_follow_up_required=True` could end up in the handoff's
`ready_for_accountant` section with the wrong category code.

This PR closes the hole with explicit semantics (frontend) and a
defensive backstop (backend), and rebuilds `/review` so the
accountant-review path is a first-class action.

## 2. Unsafe old behavior

| Step | Behavior |
|---|---|
| 1 | Owner picks "Needs accountant review" in `/questions`. |
| 2 | `handleAnswer` sees `answer.categoryCode` is undefined → calls `approveReview()`. |
| 3 | Backend records `ReviewDecision(action=APPROVE, selected_category_code=latest.predicted_category_code, accountant_follow_up_required=True)`. |
| 4 | Categorization result transitions to `AUTO_APPROVED`. |
| 5 | `_is_verified()` returns True because `row.reviewed` is True. |
| 6 | Handoff places the row in `ready_for_accountant` with the model's predicted category as the final code. |

## 3. New owner-answer action semantics

`/questions` `Answer` now carries an explicit `resolutionAction`:

| Action | Backend call | Result status | Category adopted |
|---|---|---|---|
| `"correct"` | `correctReview` | `CORRECTED` | yes (explicit) |
| `"approve_prediction"` | `approveReview` | `AUTO_APPROVED` | yes (predicted) |
| `"needs_accountant_review"` | `markForAccountantReview` | `ACCOUNTANT_REVIEW_REQUIRED` | **no** |
| `"exclude"` | `markUncategorizable` | `UNCATEGORIZABLE` | no |

The handler is a `switch (answer.resolutionAction)` — there is no
inference from `categoryCode` presence. Templates were updated to
add the action to every answer.

## 4. Backend safety backstop

`POST /review-queue/{id}/approve` rejects any payload with
`accountant_follow_up_required=true` and returns 422:

> Accountant-follow-up answers cannot approve a predicted category.
> Use `POST /review-queue/{transaction_id}/accountant-review` instead.

Even if the frontend regresses, the trust boundary holds. There is a
dedicated test
(`test_approve_endpoint_rejects_accountant_follow_up_flag`) that
will fail any reintroduction.

A defensive check in `_is_verified()` returns False for any row whose
latest review decision carries `accountant_follow_up_required=True`,
regardless of status. This protects pre-existing data and any
non-API persistence path.

## 5. Handoff / trust changes

- `HandoffOut.accountant_review_required` is a new list of rows the
  owner explicitly flagged. They never appear in `ready_for_accountant`.
- `render_markdown()` splits the old "Needs owner / accountant
  review" section into:
  - `## Owner flagged for accountant review` — first, with owner
    answer label and owner note inline.
  - `## Pending — model could not finalize` — second, for rows the
    model genuinely could not classify.
- `LedgerRow` gains `accountant_follow_up_required`,
  `owner_answer_label`, `owner_note` so the CSV exports can render
  them without re-querying.
- `_compute_trust()` counts `accountant_review_required` rows in
  `review_required_count`.

## 6. Mobile review queue design

`/review` now offers four explicit actions per card:

1. **Approve prediction** — accepts the model's category.
2. **Correct** — picks a different category (requires the dropdown).
3. **Needs accountant review** — defers to an accountant. Uses the
   new safe endpoint. Does not finalize the predicted category.
4. **Exclude / non-business** — `markUncategorizable`.

Layout:

- One card per transaction, stacked vertically.
- Buttons grid: 1 col on phones (`grid-cols-1`), 2 on small
  (`sm:grid-cols-2`), 4 on large (`lg:grid-cols-4`).
- Each button declares `min-h-[44px]` so tap targets meet the
  recommended minimum.
- Header copy makes the four actions explicit.
- A progress indicator (`data-testid="review-progress"`) shows
  pending count with `aria-live="polite"`.

## 7. Remaining limitations

- The accountant cannot reply to a flagged row from inside
  LedgerLens. The handoff package remains the only collaboration
  surface. Two-way collaboration needs the auth/tenant model.
- A flagged row can only be resolved by submitting a later explicit
  `correctReview` / `markUncategorizable`. There is no UI yet that
  lets the accountant resolve it from a separate workspace.
- The "Not sure" answer routes to accountant review. This may be
  overly conservative — a future refinement could split it into a
  "skip for now" that does not flag for follow-up.
- Mobile tests are content-only (assert that classes / IDs exist);
  no Playwright / device test runs against real Chrome yet.

## 8. Future work

- Full mobile review queue at `/review/mobile` with one card per
  viewport (the current page is mobile-friendly but still desktop-
  shaped).
- Two-way accountant collaboration with reply threads.
- Bulk actions ("apply this resolution to every NAPA row").
- Split transactions.
- Editable per-business intent → category mapping at
  `/settings/category-mapping`.
