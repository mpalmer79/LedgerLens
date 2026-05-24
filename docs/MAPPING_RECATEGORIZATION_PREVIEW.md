# Mapping recategorization preview

A read-only "if I changed this mapping, here's what would change"
view, accessible from each row of the `/mapping` editable wizard.
**No row is silently rewritten.** Apply is deferred until the
audit-trail / accountant-collaboration sprint.

## 1. Why preview exists

Editing a `CategoryMappingEntry` only affects **future** categorize
calls. Existing rows keep whatever final category they had at the
time the rule layer ran. An owner who fixes a mapping has no
visibility into "how many past rows would have used the new
code?" — until the preview shipped, the answer was "I have to
spot-check them by hand."

The preview answers that question without touching any row.

## 2. What it checks

For an intent + a proposed `(category_code, block_fallback)`:

1. Walks the active workspace's transactions.
2. Runs the existing rule-matcher on each one (pure-Python; no
   writes).
3. Identifies rows whose matched rule carries the supplied intent.
4. For each such row, decides whether it's eligible for the
   proposed mapping and, if not, returns a plain-English reason.
5. Returns a summary + a per-row breakdown.

## 3. Eligible rows

A row is eligible when:

- Its latest categorization result came from the deterministic
  `rule_categorizer` (not the model fallback, not correction
  memory, not the demo stub).
- It has no `ReviewDecision` that protects it (see §4).

For an eligible row, the preview labels it with `eligible=true`
and a green "eligible" badge in the UI.

## 4. Protected rows

A row is ineligible (and the preview surfaces it as a protected
amber row with the reason) when any of these hold:

| Trigger | Reason returned |
|---|---|
| `latest.status == ACCOUNTANT_REVIEW_REQUIRED` | "accountant-review-required rows are protected" |
| `latest.status == UNCATEGORIZABLE` | "row was excluded from books" |
| `latest.model_provider == "correction_memory"` | "category came from correction memory (encodes a previous human decision)" |
| `latest.model_provider != "rule_categorizer"` (and no review) | "row was not categorized by a deterministic rule" |
| `review.accountant_follow_up_required` | "row is flagged for accountant follow-up" |
| `review.reviewer_action == CORRECT` | "row was human-corrected; explicit decision protected" |
| `review.reviewer_action == MARK_FOR_ACCOUNTANT_REVIEW` | "row was marked for accountant review" |
| `review.reviewer_action == MARK_UNCATEGORIZABLE` | "row was marked uncategorizable" |

`review.reviewer_action == APPROVE` (without follow-up flag) is
**allowed** — the row accepted a rule-mapped category and the new
mapping should be able to re-apply.

## 5. Why accountant-follow-up rows are protected

The review-safety sprint added a strict boundary: a row the owner
flagged for accountant review must not silently get a category
applied to it. Auto-applying a mapping change to those rows would
defeat that safety bug fix. The preview echoes the same boundary.

## 6. Future imports vs current rows

- **Future imports / categorize calls** — pick up mapping edits
  immediately via the existing `services.category_mapping.resolve`
  precedence (profile → registry → rule fallback). No preview
  needed; that's the normal path.
- **Existing rows** — preview-only. The UI does not offer a
  one-click apply.

## 7. Apply behavior — not implemented in v1

The preview button reads:

> Preview impact — apply flow not implemented yet

This is deliberate. A safe apply needs:

1. Explicit selection of eligible rows (no bulk apply).
2. An audit event per row recording the old code + the new code
   + the actor.
3. A path for the accountant to roll back if the change is wrong.

All three depend on Auth Phase 2 (so we can record an
`actor_user_id` on audit events). Until that lands, the v1 preview
is the safer answer.

## 8. Limitations

- The preview only walks the current workspace's transactions — it
  doesn't synthesize hypothetical future rows.
- It hard-caps at `limit=200` rows per call (configurable via the
  endpoint). Larger ledgers would need pagination.
- The proposed-code preview doesn't validate against per-business
  CoA rules beyond "does this code exist on the active COA?".
- The preview is read-only; if a row's eligibility changes after
  the preview is rendered, the UI does not refresh until the user
  clicks "Run preview" again.

## 9. Future work

- An explicit selected-row apply flow gated behind auth (Phase 2).
- Audit events recording every rewrite with old + new code.
- Pagination for large workspaces.
- Pair with `/mapping` block-fallback edits to count
  "would route to review" rows ahead of time (already returned by
  the preview as `would_route_to_review_count`; the UI surfaces
  it in a summary card).
- "Re-run categorize on this month's NEEDS_REVIEW queue" as a
  narrower, lower-risk apply variant.
