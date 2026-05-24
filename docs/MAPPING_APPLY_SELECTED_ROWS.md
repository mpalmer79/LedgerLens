# Mapping apply — selected eligible rows only

The Phase 2 upgrade to the recategorization preview shipped a
safe apply path: `POST /mapping/apply-preview` accepts an
explicit list of selected transaction ids, recomputes
eligibility server-side, applies the proposed mapping to
**only** the eligible rows, and records an actor-aware audit
event. Protected rows are always rejected — even if the
frontend explicitly passes them in.

## Endpoint contract

```
POST /mapping/apply-preview
{
  "intent": "parts_inventory",
  "proposed_category_code": "6080",   // null when block_fallback=true
  "block_fallback": false,
  "selected_transaction_ids": ["txn_...", "txn_..."]
}
```

Required:

- `intent` — must match the active business's rule map.
- `selected_transaction_ids` — non-empty list.
- `proposed_category_code` — required when `block_fallback=false`;
  must exist on the active COA.

Response (`MappingApplyOut`):

```json
{
  "intent": "parts_inventory",
  "requested_count": 7,
  "applied_count": 5,
  "rejected_count": 2,
  "rejected_rows": [
    {"transaction_id": "txn_a", "reason": "row was human-corrected; explicit decision protected"},
    {"transaction_id": "txn_b", "reason": "row is flagged for accountant follow-up"}
  ],
  "audit_event_id": "aud_...",
  "warnings": [
    "Apply touched only the selected eligible rows; protected rows were rejected.",
    "Trust metric semantics preserved — no row was silently marked verified.",
    "Public demo — apply is recorded against the seeded demo user."
  ]
}
```

## Server-side eligibility

The server runs `_server_side_eligibility()` on each selected id:

1. Looks up the `Transaction`. Missing → reject with
   `"transaction not found"`.
2. Runs `find_rule_match()` on the transaction. If the matched
   rule's intent doesn't equal the supplied intent → reject
   with `"rule layer no longer matches this intent for this
   transaction"`.
3. Reads the latest `CategorizationResult`. Missing → reject.
4. Reads the latest `ReviewDecision`. Hands both to
   `_ineligibility_reason()` from the preview service.

The `_ineligibility_reason()` function rejects:

| Trigger | Reason |
|---|---|
| `latest.status == ACCOUNTANT_REVIEW_REQUIRED` | "accountant-review-required rows are protected" |
| `latest.status == UNCATEGORIZABLE` | "row was excluded from books" |
| `latest.model_provider == "correction_memory"` | "category came from correction memory (encodes a previous human decision)" |
| `latest.model_provider != "rule_categorizer"` (and no review) | "row was not categorized by a deterministic rule" |
| `review.accountant_follow_up_required` | "row is flagged for accountant follow-up" |
| `review.reviewer_action == CORRECT` | "row was human-corrected; explicit decision protected" |
| `review.reviewer_action == MARK_FOR_ACCOUNTANT_REVIEW` | "row was marked for accountant review" |
| `review.reviewer_action == MARK_UNCATEGORIZABLE` | "row was marked uncategorizable" |

The frontend cannot override these. Test
`test_apply_rejects_human_corrected_row` proves the protection
holds even when the frontend deliberately submits a protected
id.

## Mutation behavior

For each eligible row:

- If `block_fallback=true`: the row's `status` flips to
  `ResultStatus.NEEDS_REVIEW`. The category code is preserved
  (so the row goes back to the review queue rather than gaining
  a new code).
- Otherwise: the row's `predicted_category_code` is set to
  `proposed_category_code`. The predicted name follows the code
  if it changed. If status was `NEEDS_REVIEW` it flips to
  `AUTO_APPROVED` (the new code came from a deterministic rule
  mapping).

Trust-metric semantics are preserved — no row gains the
"verified" badge just because mapping apply touched it. The
existing rules in `_is_verified()` (auto-approved by
`rule_categorizer` with no `accountant_follow_up_required`
flag) remain the only path to verified status.

## Audit event

A single `mapping_apply.selected_rows_applied` audit event is
recorded after the apply commits. The `details.metadata` JSON
carries:

- `proposed_category_code`
- `block_fallback`
- `requested_count`
- `applied_count`
- `rejected_count`
- `applied`: list of `{transaction_id, old_category_code,
  new_category_code, old_status, new_status}`
- `rejected`: list of `{transaction_id, reason}`

The event's `actor_user_id` / `actor_display_name` /
`request_id` are populated from the resolved `DemoActor`.

## Frontend UX

- The preview panel's row list now ships a checkbox per row.
  Protected rows render the checkbox disabled.
- "Select all eligible" and "Clear selection" helpers.
- The Apply button label flips between **"Apply selected
  eligible rows"** and **"Route selected rows to review"**
  depending on whether `block_fallback` is set in the draft.
- Clicking Apply opens an amber confirmation dialog with the
  protection guarantee in plain English. Confirm → POST →
  result panel with the audit-event id and a link to `/audit`.

## Limitations

- No undo / revert flow. A subsequent apply can change the rows
  again, and each apply records its own audit event, but there
  is no one-click rollback.
- The audit `details` payload truncates nothing — for a very
  large `selected_transaction_ids` list the `applied` /
  `rejected` arrays grow proportionally. The API enforces a
  500-item cap on the request to keep this bounded.
- No transactional re-categorize → if the apply somehow runs
  during a concurrent edit, the row's status flip and the
  audit event are in the same DB transaction (consistent) but
  there is no optimistic-concurrency check.
