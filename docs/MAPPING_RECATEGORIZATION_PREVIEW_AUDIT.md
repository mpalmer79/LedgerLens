# Mapping recategorization preview — audit

## 1. Current persistent mapping behavior

`/mapping` writes go to `CategoryMappingProfile` /
`CategoryMappingEntry`. The categorize service reads the active
profile via `services.category_mapping.resolve()` and honors
`block_fallback`. Edits take effect on the **next** categorize
call.

## 2. What changes after editing a mapping today

- Future imports / categorize calls pick up the new mapping
  immediately.
- Existing rows keep whatever final category they had at the
  time the rule layer ran. There is no UI affordance to
  re-categorize past rows.
- The owner gets no visibility into "if I save this, how many
  past rows would have used a different code."

## 3. Why silent recategorization is unsafe

A one-click "apply mapping to all matching rows" would:

- Overwrite human corrections — the owner explicitly picked a
  category, the rule layer should not silently override it.
- Overwrite accountant-follow-up rows — defeating the safety-bug
  fix from the review-safety sprint.
- Change rows that may have been exported to the accountant
  already, breaking the handoff audit trail.

The brief calls preview-first, apply-deferred. This sprint ships
preview only.

## 4. Which rows may be eligible for preview

Rows where:

- The latest `CategorizationResult` was produced by
  `rule_categorizer` (an intent maps to a code via the resolver),
  AND
- No `ReviewDecision` exists that would make the row a human
  correction or accountant follow-up.

Eligibility check is per-row in the preview endpoint.

## 5. Which rows must not be touched

| State | Reason |
|---|---|
| Latest `ReviewDecision.reviewer_action == CORRECT` | Human explicitly picked a category. |
| Latest `ReviewDecision.accountant_follow_up_required == True` | Owner flagged for accountant. |
| Latest `CategorizationResult.status == ACCOUNTANT_REVIEW_REQUIRED` | Same — the row is awaiting accountant action. |
| Latest `CategorizationResult.status == UNCATEGORIZABLE` | Explicitly excluded; respect that. |
| Categorization came from `correction_memory` | The memory rule encodes a previous human decision. |

The preview returns each row with an `eligible` flag and the
`reason` when ineligible.

## 6. Future imports vs current transaction updates

- **Future imports** — already affected by mapping edits. No
  preview needed; that's the existing behavior.
- **Current transactions** — preview-only in v1. No apply
  endpoint until we agree on the audit trail.

## 7. Preview-only v1 recommendation

Ship `POST /mapping/preview` that:

- Reads the current `CategoryMappingEntry` for the intent (the
  baseline) and accepts the proposed code / block_fallback.
- Walks the existing `Transaction` + `CategorizationResult` +
  `ReviewDecision` rows that match the intent.
- Returns per-row: id, date, merchant/description, amount,
  current category, proposed category, eligible bool, reason.
- Returns summary: affected_count, eligible_count,
  ineligible_count, would_route_to_review_count.
- Carries the public-demo warning.
- **No mutation.** No insert, no update, no delete.

Apply is deferred. The UI button reads
"Preview impact — apply flow not implemented yet" so the boundary
is explicit on the page.

## 8. Acceptance criteria

1. New endpoint is read-only.
2. Human-corrected and accountant-follow-up rows are returned as
   ineligible with a clear reason.
3. ACCOUNTANT_REVIEW_REQUIRED and UNCATEGORIZABLE rows are
   returned as ineligible.
4. `block_fallback=true` preview reports
   `would_route_to_review_count`.
5. UI surfaces a "Preview impact" button per intent that calls
   the endpoint and renders the affected rows with eligible /
   ineligible badges and a "nothing has been changed yet" line.
6. No silent recategorization is introduced anywhere.
