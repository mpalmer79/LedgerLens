# Persistent category mapping v1 — sprint review

## 1. What changed

- `/mapping` is now an editable wizard. The previous read-only
  explorer shape (status badges, missing intents) is preserved;
  every row now has a category dropdown, a block-fallback toggle,
  a save button, and an optional notes field.
- New backend service `ledgerlens.services.category_mapping` owns
  seeding, validation, write, reset, and the new resolver.
- New `/mapping` API: `GET /mapping/profile`, `PUT
  /mapping/profile/entries/{intent}`, `POST /mapping/profile/reset`.
- `services/categorize.py` calls the new resolver. `block_fallback=True`
  now routes the matching row to `needs_review` with an explicit
  reason instead of auto-approving on the rule's own default.
- Two schema tweaks on Phase 1 tables:
  - `category_mapping_profiles.source` (`"seed"` | `"user"`).
  - `category_mapping_entries.notes` nullable.
  - `category_mapping_entries.category_code` is now nullable so
    an entry can represent an intentionally unmapped or
    block-fallback state.
- Alembic revision `527984084a01_category_mapping_editable_source_notes`.

## 2. Why this was the right next PR

The previous sprint shipped the schema; without wiring it up the
new tables were dead weight. The wiring unblocks the most
recruiter-visible workflow gap on the small-business UX roadmap
(item #2: editable account-mapping wizard) without requiring
auth Phase 2 — the public-demo warning + reset button keep the
boundary honest.

## 3. Data model added

| Field | Behavior |
|---|---|
| `CategoryMappingProfile.source` | `"seed"` when in sync with the Python registry; flips to `"user"` on the first write. UI labels the active state. |
| `CategoryMappingEntry.category_code` | Now nullable. None means "unmapped" — either intentional or paired with `block_fallback=True`. |
| `CategoryMappingEntry.notes` | Short owner-supplied note. Surfaced in the UI; not used by the resolver. |

## 4. API routes added

| Verb | Path | Behavior | Validation |
|---|---|---|---|
| `GET` | `/mapping/profile` | Returns the active profile, seeded on first read. Includes every active COA category + every registry intent the profile hasn't customized. | — |
| `PUT` | `/mapping/profile/entries/{intent}` | Upserts the entry. | 422 on unknown intent; 422 on non-null category code not in the COA. |
| `POST` | `/mapping/profile/reset` | Wipes and re-seeds from the registry. | — |

Every response includes the public-demo warnings the UI echoes.

## 5. Resolution order

`ledgerlens.services.category_mapping.resolve()`:

1. **Active persistent profile entry**
   - `block_fallback=True` → `(None, block_fallback=True, "profile")`.
   - non-null `category_code` → `(code, False, "profile")`.
   - both null → fall through to (2).
2. **Python registry** → `(registry_code, False, "registry")` if mapped.
3. **Registry block-fallback** → `(None, block_fallback=True, "registry")`.
4. **Rule's own `fallback_code`** → `(fallback_code, False, "rule_fallback")`.

## 6. UI before / after

| Before | After |
|---|---|
| Read-only listing of mapped / blocked / unmapped intents. | Editable list with a dropdown, a checkbox, a save button, and an optional notes field per intent. |
| No public-demo warning on the page. | Amber warning at the top + every backend-supplied warning rendered at the bottom. |
| No reset path. | "Reset demo defaults" button. |
| Status badges via plain text. | Coloured badges (`mapped` / `unmapped` / `fallback blocked`). |
| One column. | Mobile-friendly grid: control column stretches; checkbox + save sit on the same row on desktop, stack on phone. All editable controls declare `min-h-[44px]`. |

## 7. `block_fallback` behavior

When the owner toggles `block_fallback=True`:

- The dropdown is disabled and `category_code` is implicitly
  cleared.
- Save persists `(category_code=None, block_fallback=True,
  notes=…)`.
- The categorize path returns
  `MappingResolution(code=None, block_fallback=True)`.
- The rule categorizer persists the row as
  `ResultStatus.NEEDS_REVIEW` with the reason "Owner mapping
  blocks fallback for this intent; routed to review."

## 8. Demo-safe limitations

- No authentication on the write endpoints. The page warning + the
  every-response warnings echo this.
- The reset endpoint is the safety valve — anyone can click it to
  restore the seeded state.
- No per-tenant business switcher. The active business is still
  `granite_state_auto_repair`.
- Edits affect future categorize calls only. Existing finalized
  rows keep their previously-applied categories.
- Eval businesses (`auto_repair_eval`, `coffee_shop_eval`,
  `design_agency_eval`) intentionally stay on the Python registry;
  the editable wizard does not touch them, so the eval harness is
  unaffected.

## 9. Future tenant-owned path

The next sprint should:

1. Add an `owner`-role membership check on `PUT` and `POST` once
   auth Phase 2 ships.
2. Replace `active_business_id()` with a session-driven resolver.
3. Add a business-switcher control on the page for users with
   multiple memberships.
4. Migrate the eval businesses into seeded profiles so the
   registry can be retired as a primary read path.

## 10. Tests added / updated

| Suite | Before | After |
|---|---|---|
| Backend pytest | 234 | **247** |
| Frontend vitest | 236 | **242** |

New backend tests (highlights, all in
`tests/api/test_persistent_category_mapping.py`):

- `test_mapping_profile_seeded_from_registry_on_first_read`
- `test_mapping_profile_persists_across_requests`
- `test_put_entry_updates_category_code`
- `test_put_entry_enables_block_fallback`
- `test_put_entry_rejects_unknown_intent`
- `test_put_entry_rejects_unknown_category_code`
- `test_put_entry_rejects_empty_intent`
- `test_reset_profile_returns_to_seed`
- `test_persistent_mapping_overrides_registry_on_categorize`
- `test_block_fallback_routes_to_review_not_auto_approve`
- `test_no_persistent_profile_falls_back_to_registry`
- `test_mapping_routes_return_x_request_id`
- `test_seed_resilience_when_session_already_open`

New frontend tests (in `lib/page-content.test.ts > category
mapping editable wizard`):

- "renders the public-demo warning and active-business context"
- "uses the new editable API surface"
- "renders the category dropdown + block-fallback + save controls"
- "shows mapped / unmapped / fallback-blocked badges"
- "has 44px tap targets on the editable controls"
- "does not claim production tenant isolation or real-bank safety"

## 11. Remaining weaknesses

- No mapping change preview. The owner cannot see "if I change X,
  Y transactions move" before saving.
- No re-categorize-existing-rows button. Edits only apply to new
  categorize calls.
- No history / audit trail of mapping changes (needs
  `AuditEvent.actor_user_id`, which needs auth Phase 2).
- No bulk edit. Each row is saved individually.
- No per-business switcher on the page — the active business is
  still the hard-coded demo.
- Public-demo writes are unauthenticated. Mitigated by the visible
  warning + the reset button, but a real deployment must gate
  these.

## 12. Recommended next PR

The blunt recommendation: **Saved CSV import profiles**. The CSV
import wizard's "save this mapping as TD Bank Personal Checking"
v2 is the next natural editable-config workflow, follows the same
shape as this PR (model + endpoint + UI), and pairs naturally with
mapping persistence for the next-day-owner-comes-back scenario.

Other strong candidates:

- **Auth Phase A.2** — `password_hash` + `Session` + login UI
  behind a feature flag. Unblocks gating the mapping wizard.
- **Audit retention / deletion policy** — explicit TTL on
  `AuditEvent` + a `DELETE /tenant/{id}/data` placeholder.
- **Accountant collaboration workflow** — reply threads on review
  items. Needs auth.
- **Split transaction design** — orthogonal to auth.
- **QuickBooks / QBO / IIF export research spike** — figure out the
  COA → list-id mapping problem.
