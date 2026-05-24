# Persistent category mapping audit

A focused look at the current read-only mapping behavior and what
v1 persistent editable mapping should change without breaking the
config-driven path or pretending production tenant isolation
exists.

## 1. Current read-only mapping behavior

- `/mapping` (frontend) calls `GET /rules`, reads
  `response.mapping`, and renders three sections: mapped, blocked
  fallback, unmapped. No editing surface.
- `BusinessRuleMapOut` (backend) carries `business_id`,
  `business_name`, `entries`, `block_fallback_intents`,
  `unmapped_intents`.
- Mapping configuration is entirely in
  `backend/src/ledgerlens/data/business_rule_maps.py`. Five maps
  live in a module-level `_REGISTRY` keyed by `business_id`:
  `DEFAULT_INTENT_MAP`, `GRANITE_STATE_INTENT_MAP`,
  `AUTO_REPAIR_EVAL_INTENT_MAP`, `COFFEE_SHOP_EVAL_INTENT_MAP`,
  `DESIGN_AGENCY_EVAL_INTENT_MAP`.

## 2. Current code/config map behavior

- `BusinessRuleMap` (the dataclass) has
  `intent_to_code: dict[str, str]` and
  `block_fallback_intents: frozenset[str]`.
- `BusinessRuleMap.resolve(intent)` returns the mapped code or
  `None`. `is_fallback_blocked(intent)` is consulted by callers
  separately.
- `active_business_id()` resolves through `SAMPLE_SCENARIO`. It
  is hard-coded to `granite_state_auto_repair` today; a real
  tenant deploy would resolve from session / JWT / header.
- `resolve_category_for_intent()` is the single entry point the
  rule categorizer uses: returns the mapped code if present,
  else the rule's own `fallback_code`.

## 3. Where mapping is used in categorization

Single call site: `ledgerlens.services.rule_categorizer`. The
rule layer:

1. Finds a rule that matches a transaction.
2. Reads the rule's `intent` (may be None).
3. Calls `resolve_category_for_intent(intent,
   fallback_code=rule.category_code)`.
4. If the resolved code is None and the intent is
   block-fallback, routes the transaction to review instead of
   auto-approving.

Eval harnesses (rules-only-mapped, hybrid-rules-model-mapped) read
the same registry to swap business IDs.

## 4. What persistence needs to store

Per active demo business:

- A single active `CategoryMappingProfile` row.
- One `CategoryMappingEntry` row per intent the user has
  customized. Each row carries `category_code` (nullable),
  `category_name` (nullable), `block_fallback` (bool), `notes`
  (nullable).
- A `source` marker so we can tell which entries came from the
  user vs. from the seeded demo defaults.

The schema (`CategoryMappingProfile`, `CategoryMappingEntry`) was
added in Auth/Tenant Phase 1. This sprint wires it up.

## 5. What should remain code/config fallback

The Python registry stays in place as the **read-only baseline**:

- The eval businesses (`auto_repair_eval`, `coffee_shop_eval`,
  `design_agency_eval`) keep their Python maps. They are not user-
  editable.
- The `DEFAULT_INTENT_MAP` stays as the last-resort fallback when
  no profile / no business / unknown business is in scope.
- When the active demo business has no override for an intent,
  resolution falls back to the Python map for that business.

## 6. Demo-safe persistence approach

- One profile per business, seeded with the Python map's contents
  on first read. Idempotent.
- `business_id` is the same string the Python registry uses
  (`granite_state_auto_repair`); no FK to the `Business` table
  is required this sprint because the demo runs without tenant
  resolution.
- Public demo: the routes are unauthenticated. Anyone can edit
  the mapping. The `/mapping` UI and the API docs say so loudly.
- Reset endpoint re-seeds the profile from the Python map so
  reviewers / next-day visitors can recover a known state.

## 7. Future tenant-owned mapping path

Once auth Phase A.2 lands:

1. Replace `active_business_id()`'s hard-coded resolution with a
   session-driven `current_business_id`.
2. Add a `business_id` FK on `CategoryMappingProfile` pointing at
   the `Business` table.
3. Gate `PUT /mapping/profile/entries/{intent}` behind an
   `owner`-role membership check.
4. Profile resolution becomes `(tenant_id, business_id, "active")`.

## 8. Risks and limitations

- **Drift** between the persistent profile and the Python map.
  Mitigated by writing the seed on first read so the two start
  identical; the reset endpoint restores parity.
- **Invalid codes saved.** Mitigated by validating
  `category_code` against the current chart of accounts on every
  write; `null` is allowed (unmapped / blocked).
- **Public demo abuse.** Mitigated by `POST /mapping/profile/reset`
  + clear warning on the UI that edits are not protected.
- **Eval harness contamination.** Mitigated by keeping the eval
  business IDs out of the database read path; they continue to
  read from the Python registry only.
- **Already-finalized rows.** Mitigated by only applying the
  resolver at categorize time. Existing `ReviewDecision` rows
  keep their previously-finalized categories.

## 9. Acceptance criteria

1. A user can edit at least one intent → category mapping from
   `/mapping`. Persistence survives a refresh.
2. A user can set `block_fallback=true` on an intent and matching
   transactions stop auto-approving.
3. A user can reset the demo mapping back to the seeded defaults.
4. Backend rejects invalid `category_code` / unknown `intent` with
   a clear 422.
5. When no persistent profile exists, behavior is identical to
   today (Python map fallback).
6. Eval harnesses see no change.
7. Public demo warnings remain visible on `/mapping`.
8. No "production tenant settings" claim appears.
