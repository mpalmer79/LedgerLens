# Category mapping (read-only explorer this sprint)

A focused page at `/mapping` that shows how the active business's
rule intents resolve to chart-of-accounts categories. Read-only this
sprint; an editable wizard is the next planned workflow.

## 1. Why category mapping matters

The deterministic rule layer fires on merchant + description patterns
and tags each match with an *intent* (e.g. `parts_inventory`,
`fuel_vehicle`, `software_subscription`). A real chart of accounts
varies per business: 6070 means "Software Subscriptions" in the seed
COA but "Merchant Processing Fees" in the design-agency eval COA.

Without per-business mapping, a rule that auto-categorizes Intuit as
6070 would silently misclassify it on the design agency's books.
With the mapping layer, each business decides which COA code an
intent resolves to.

## 2. Current demo-safe implementation

`/mapping` calls `GET /rules` and renders the `mapping` field of the
response:

- **Active business** — name + id.
- **Mapped intents** — every intent the business has overridden.
- **Blocked-fallback intents** — intents the business refuses to
  auto-categorize from the rule's hard-coded default code. Matching
  rows route to review.
- **Unmapped intents** — intents that exist on rules but have no
  override. The rule's own `category_code` is used as a fallback.

This is enough for a reviewer to understand the mapping layer
without reading the Python source.

## 3. Intent-to-category mapping explanation

The mapping is configured in
`backend/src/ledgerlens/data/business_rule_maps.py`. Each business
ships a `BusinessRuleMap` with:

- `intent_to_code: dict[str, str]` — explicit mappings.
- `block_fallback_intents: frozenset[str]` — intents that must not
  fall back to the rule's own code.

Resolution order at categorize time:

1. If the matched rule has no `intent`, use the rule's own
   `category_code`.
2. If the active business has a mapped code for the intent, use it.
3. If the intent is in `block_fallback_intents`, route the row to
   review instead.
4. Otherwise, fall back to the rule's own `category_code`.

## 4. Unmapped and blocked fallback behavior

The `/mapping` page surfaces both:

- **Unmapped** intents render in a neutral list — they are not
  unsafe, but the owner may want to add an explicit override.
- **Blocked-fallback** intents render with an amber border + "routed
  to review" label.

Both are sourced from the backend (`BusinessRuleMapOut` now carries
`block_fallback_intents` and `unmapped_intents`).

## 5. Production tenanting limitations

Editing the mapping requires per-business persistence, which requires
a `Business` table and tenant scoping. Both are blocked on the
auth/tenant foundation (see `AUTH_TENANT_FOUNDATION.md`).

So this sprint ships a read-only explorer. The page is honest about
the limitation:

> Production per-business mapping configuration requires auth and
> tenant isolation, which is not implemented.

## 6. Future editable / persistent mapping plan

The schema foundation already exists as of Auth/Tenant Phase 1 (see
[`AUTH_TENANT_PHASE_1.md`](AUTH_TENANT_PHASE_1.md)):

- `CategoryMappingProfile(id, business_id, name, is_active, …)`
- `CategoryMappingEntry(id, profile_id, intent, category_code,
  category_name, block_fallback, …)`

These tables are **created by the migration but not yet read or
written by any code path.** The active mapping is still resolved
from `backend/src/ledgerlens/data/business_rule_maps.py` so the
public demo and existing tests are unchanged.

Once login / sessions land in Phase 2:

1. Backend: seed `CategoryMappingProfile` rows for the demo business
   from the Python map. `/rules` mapping snapshot reads from the
   table with the Python file as a fallback for unseeded
   businesses.
2. Backend: `PATCH /businesses/{id}/intent-map/{intent}` lets an
   owner-role user change a mapping. Validates against the
   business's COA. 422 if the code is not in the COA.
3. Backend: add an audit event on every change with
   `actor_user_id`.
4. Frontend: turn `/mapping` into a wizard with per-intent
   dropdowns. Defaults to read-only; an edit-mode toggle gated
   behind owner role.
5. Defaults for new businesses come from the seed map. Adding a
   new intent in code without seeding it triggers an "unmapped"
   surfacing on the UI.

Until then, the page is the v0 reviewer-friendly explanation of
how the mapping layer works.
