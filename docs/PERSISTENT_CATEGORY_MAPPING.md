# Persistent category mapping (v1)

`/mapping` is now an editable wizard backed by the persistent
`CategoryMappingProfile` / `CategoryMappingEntry` tables introduced
in Auth/Tenant Phase 1. Edits survive a refresh; a reset endpoint
restores the seeded defaults so reviewers and next-day visitors
can recover a known state.

## 1. Why persistent mapping was added

The previous `/mapping` page was read-only and the only path to
change an intent → COA code was to edit
`backend/src/ledgerlens/data/business_rule_maps.py` and redeploy.
That ruled out the small-business workflow we're targeting: an
owner who wants Intuit to post to "Software Subscriptions" rather
than the rule's default code, or who wants to block fallback for an
unfamiliar intent so it lands in review.

This sprint wires the persistent tables to the categorize path so
edits take effect immediately for any new categorization.

## 2. Data model

Existing tables (from Phase 1) gained two columns this sprint:

- `category_mapping_profiles.source` — `"seed"` when the profile is
  in sync with the Python registry, `"user"` once the owner has
  edited anything. Used by the UI to label the active state.
- `category_mapping_entries.notes` — short owner-supplied note.
- `category_mapping_entries.category_code` is now nullable so an
  entry can represent an intentionally unmapped or block-fallback
  state.

Schema (effective columns):

```
category_mapping_profiles(
  id PK, business_id (FK businesses), name, is_active,
  source, created_at, updated_at,
  UNIQUE(business_id, name)
)

category_mapping_entries(
  id PK, profile_id (FK category_mapping_profiles),
  intent, category_code NULLABLE, category_name NULLABLE,
  block_fallback BOOL, notes NULLABLE,
  created_at, updated_at,
  UNIQUE(profile_id, intent)
)
```

Alembic revision `527984084a01_category_mapping_editable_source_notes`
covers all three changes.

## 3. API behavior

| Verb | Path | Behavior |
|---|---|---|
| `GET` | `/mapping/profile` | Returns the active profile for the active business. Seeds from the Python registry on first read. Includes every active COA category for the dropdown and every missing intent the registry knows about. |
| `PUT` | `/mapping/profile/entries/{intent}` | Upserts the entry. Validates `intent` against the registry (422 on unknown). Validates `category_code` against the active COA when non-null (422 on unknown). Sets `profile.source = "user"`. |
| `POST` | `/mapping/profile/reset` | Deletes every entry on the active profile and re-seeds from the Python registry. `profile.source` returns to `"seed"`. |

All three responses include a `warnings` array surfaced by the UI:

- "Public demo — these mapping settings are not protected by
  production authentication."
- "Do not upload real bank data. Use synthetic / sample CSVs only."
- "This is a categorization handoff aid, not a true accounting
  ledger."

The endpoints are reachable without authentication; this is
demo-safe but not production-safe. The auth/tenant Phase 2 PR will
gate them behind an `owner`-role membership check.

## 4. Resolution order

At categorize time `ledgerlens.services.category_mapping.resolve()`
returns a `MappingResolution(code, block_fallback, source)`:

1. **Active persistent profile entry** (when present)
   - `block_fallback=True` → `MappingResolution(code=None,
     block_fallback=True, source="profile")` → caller routes the
     row to review.
   - non-null `category_code` → `MappingResolution(code=…,
     block_fallback=False, source="profile")` → caller applies that
     code.
   - both fields null → fall through to (2).
2. **Python registry** — same as the previous behavior. Returns
   the registry's mapped code if any.
3. **Registry block-fallback** — if the registry flags the intent
   as block-fallback, return `MappingResolution(code=None,
   block_fallback=True, source="registry")`.
4. **Rule's own `fallback_code`** — last-resort default. Returned
   only when none of (1)-(3) produced an answer.

The rule categorizer (`services/categorize.py`) honors a
`block_fallback=True` resolution by persisting the row as
`ResultStatus.NEEDS_REVIEW` with the explicit reason "Owner mapping
blocks fallback for this intent; routed to review."

## 5. `block_fallback` semantics

`block_fallback=True` on a persistent entry means: "for any
transaction the rule layer matches to this intent, do **not**
auto-apply the rule's own default category code; route the row to
review instead."

This is the same boundary the existing
`BusinessRuleMap.block_fallback_intents` set carried in the Python
registry. Surfacing it on the editable wizard means the owner can
mark an intent as needing accountant review without writing code.

When `block_fallback=True`:

- `category_code` is implicitly cleared (UI disables the dropdown).
- The resolution returns `code=None, block_fallback=True`.
- The row's `categorization_status` becomes `needs_review`.
- The owner answer / accountant review flow at `/review` and
  `/questions` picks it up like any other queued row.

## 6. Demo-safe limitations

- No authentication on the endpoints. Anyone with the demo URL
  can edit the mapping.
- Public-demo warnings are echoed on every response and on the
  `/mapping` page itself.
- The reset endpoint exists so a known state is one click away.
- Per-tenant isolation is **not** implemented. The active business
  is still resolved by `active_business_id()` (hard-coded to
  `granite_state_auto_repair` in this deploy).
- Eval businesses (`auto_repair_eval`, `coffee_shop_eval`,
  `design_agency_eval`) are intentionally not exposed by the
  editable wizard. They continue to use the Python registry only,
  so eval harnesses are unaffected.

## 7. Future tenant-owned mapping path

Once auth Phase 2 lands:

1. Replace `active_business_id()` with a session-driven resolver.
2. Add an `owner`-role membership check on the `PUT` and `POST`
   routes.
3. Surface a business switcher on `/mapping` for users with
   multiple `Membership` rows.
4. Migrate the eval businesses' rule maps into seeded profiles so
   the registry-as-fallback can be retired.

## 8. How to reset demo mapping

From the UI: the "Reset demo defaults" button on `/mapping`.

From the API:

```
POST /mapping/profile/reset
```

The response is the re-seeded profile; `source` returns to
`"seed"`.

## 9. Testing notes

- Backend: 13 new tests in
  `tests/api/test_persistent_category_mapping.py` cover the read
  endpoint, write validation, reset, categorize-path integration
  (override wins, block_fallback routes to review, no-profile
  falls back to registry), and X-Request-ID propagation.
- Frontend: 6 new tests in `lib/page-content.test.ts > category
  mapping editable wizard` pin the public-demo warning, the
  editable API surface, the dropdown / block-fallback / save
  controls, the badge variants, the 44px tap targets, and the
  honesty contract.
- The Auth/Tenant Phase 1 alembic baseline test still passes; the
  new revision `527984084a01` applies cleanly on top.
- The demo-stub no-Anthropic regression test still passes — no
  paid model calls are introduced.

## 10. Future improvements

- **Mapping change preview.** "If you change `parts_inventory` from
  5010 to 6080, the next categorize pass would touch 7
  transactions on the demo business." Out of scope this sprint.
- **History view.** Track every entry change in `AuditEvent` so
  the owner / accountant can see who changed what (needs auth).
- **Re-categorize finalized rows.** Today edits only affect new
  categorize calls. A "Re-run categorize on this month's NEEDS_REVIEW
  queue" button would let the owner pull the new mapping through
  existing pending rows.
- **Bulk edit.** Edit several intents at once with a single Save.
- **Per-business UI.** Once auth lands, swap the active business
  via a dropdown rather than the hard-coded resolver.
