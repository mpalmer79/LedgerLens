# Rule mapping — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| `Rule` dataclass (`services/rule_categorizer.py`) | Frozen dataclass with `id / name / active / priority / match_type / merchant_patterns / description_patterns / category_code / confidence / explanation / notes`. | Same + optional **`intent: str \| None`**. |
| Rule loader (`_coerce_rule`) | Read all v1 fields. | Same + extracts the new optional `intent` field from the JSON entry. |
| `category_rules.json` | 25 rules, each pointing at a hardcoded `category_code`. | Same 25 rules, each gains an `"intent"` field (`software_subscription`, `office_supplies`, `fuel_vehicle`, `travel`, `meals_entertainment`, `merchant_fees`). The schema description in the file updated to reference the new mapping layer. |
| Business mapping module | Did not exist. | New `backend/src/ledgerlens/data/business_rule_maps.py` shipping `BusinessRuleMap` dataclass + `DEFAULT_INTENT_MAP` (24 intents) + `GRANITE_STATE_INTENT_MAP` (Granite State Auto Repair specifics) + `get_business_rule_map(business_id)` / `active_business_id()` / `resolve_category_for_intent(intent, *, business_id, fallback_code)`. |
| Categorize service | After rule match: `matched_cat = cat_repo.get(rule.category_code)` → persist with rule's own code. | After rule match: resolve effective code via the active business mapping; if the mapped code doesn't exist on the active COA, fall back to the rule's own code; persist with the resolved code. The rule is rebuilt with `dataclasses.replace(rule, category_code=mapped_code)` so the audit / explanation / persistence all use the resolved code consistently. |
| `RuleOut` schema | `category_code + category_name + confidence + explanation`. | Same + **`intent`** (the rule's declared intent) + **`mapped_category_code`** + **`mapped_category_name`** (the active business's resolved code, equal to `category_code` when no override exists). |
| `RuleListOut` schema | `total + items`. | Same + new **`mapping: BusinessRuleMapOut`** snapshot exposing the active business id + business name + full intent→code entries list. |
| `/rules` page | Hand-rolled table with rule / match-type / patterns / category / confidence / priority. Single error string on failure. | Uses shared `<LoadingState>` + `<ErrorState>`. New header copy explains the per-business mapping layer. **New "Active business mapping" card** at the top with the full intent→category grid. Table gains **Intent** + **Mapped category** columns; rows where the mapping overrides the rule's own code get a small "overrides rule default" annotation. Honest "safe fallback" copy explains what happens when no mapping exists. |
| `/rules` frontend types | `Rule = { ..., category_code, category_name, confidence, explanation }`. | Same + `intent / mapped_category_code / mapped_category_name`. New `BusinessRuleMap` + `BusinessRuleMapEntry` types. `RuleList = { total, items, mapping: BusinessRuleMap \| null }`. |

## 2. Why per-business rule mapping matters

The rule layer is *intent-correct* for ~every business — only the COA
code differs. Without the mapping layer, every rule was hard-coded
against the default seed COA. The categorize service either dropped
rules whose `category_code` didn't validate, or it auto-applied a code
the active business didn't use. Eval credibility took a hit because
the rules-only mode reported category-code match, not intent match.

With the mapping layer, the rule layer's *intent* is the unit of work
and the COA code is configuration. A rule that says
"INTUIT → software_subscription" carries the same intent regardless of
which business is active; the business decides whether
`software_subscription` resolves to 6070 (the default), 6075 (some
businesses' SaaS code), or "send to review" (a business that wants
all software vetted).

## 3. How rule intents work

Three behaviors, in order:

1. **Rule has no `intent` field.** No-op. The rule's own
   `category_code` is used. Backward-compatible with every v1 rule
   that doesn't declare an intent.
2. **Rule has `intent` and the active business has a mapping for it.**
   Mapped code wins. If the mapped code points at a missing / inactive
   COA category, fall back to the rule's own code.
3. **Rule has `intent` and the active business has no mapping.** The
   rule's own `category_code` is used as a safe fallback.

The active business is resolved by `active_business_id()`, which today
reads `SAMPLE_SCENARIO["business_name"]` and returns
`"granite_state_auto_repair"` for the Granite State scenario or
`"default"` otherwise. Multi-tenant resolution is out of scope for
this sprint.

## 4. Demo scenario mapping examples

The Granite State Auto Repair scenario gains explicit overrides where
its preferred COA usage differs from the default:

| Rule intent | Default code | Granite State code | Why |
|---|---|---|---|
| `parts_inventory` | (no mapping) | 5010 Cost of Goods Sold | An auto shop tracks parts as COGS, not generic supplies. |
| `internet_telecom` | 6150 | 6150 | Same code, but explicitly declared so Comcast Business resolves to telecom, not generic utilities (6020). |
| `software_subscription` | 6070 | 6070 | Mitchell1 / QuickBooks / Google Workspace all land in software. |
| `fuel_vehicle` | 6130 | 6130 | Shell / Irving / Mobil — fuel category. |
| `vehicle_maintenance` | (no mapping) | 6140 Repairs & Maintenance | Auto-shop-specific intent. |
| `merchant_fees` | 6100 | 6100 | Stripe / Square processing fees. |
| `customer_revenue` | 4010 | 4010 | Stripe / Square / customer-check deposits — revenue side. |
| `owner_draw` | 3030 | 3030 | OWNER TRANSFER → owner distributions. |
| `loan_payment` | (no mapping) | 8010 Interest Expense | TD Bank business loan payment — accountant will split interest from principal. |

Visible at `/rules` under "Active business mapping."

## 5. Eval impact

Today's eval harness reports raw model accuracy (~63%) and rules-only
category-code match. The mapping layer doesn't change those numbers —
it changes what the rules-only metric **could** report:

- **Rules-only (no mapping)** — what we report today.
- **Rules-only (with mapping)** — at least as high as the no-mapping
  number; meaningfully higher when the eval COA differs from a rule's
  hardcoded `category_code`.
- **Intent-only coverage** — what fraction of transactions hit a rule
  with an `intent` declared.

The eval harness wiring for the mapped-rule metric is intentionally
**out of scope** for this PR — it adds machinery to the eval CLI that
isn't observable to the frontend, and the honest numbers we have today
already tell the story. `/evals` is unchanged. The next sprint can
wire the mapped-rule eval mode end-to-end.

What this PR does provide for evals:

- Every `Rule` carries `intent` so the eval harness can opt in to the
  new metric by calling `resolve_category_for_intent` post-match.
- `category_rules.json` is fully tagged with intents.
- The eval can compute "intent coverage" trivially: count rules where
  `rule.intent is not None`.

The `/evals` page copy stays honest: raw model accuracy remains the
headline model number, the workflow-level trust metric remains the
headline product number, and the per-business mapping is documented in
`docs/PER_BUSINESS_RULE_MAPPING_DESIGN.md` for anyone who clicks
through.

## 6. Remaining limitations

- **Single-tenant.** "Active business" is hard-pinned to Granite State.
- **The mapping is static Python.** No admin UI; no per-tenant
  configuration table.
- **No auto-derivation from correction memory.** A future improvement
  would let accumulated `(merchant → category)` corrections seed a
  business-specific intent map.
- **Eval harness doesn't yet emit a mapped-rule metric.** The plumbing
  is in place (rules carry intent, resolver is callable from
  Python) but the eval CLI isn't wired up. Listed as the natural
  next-sprint follow-up.
- **No multi-intent rules.** Each rule has one `intent`. A row that's
  ambiguous in two ways still uses the existing conflict-review path.
- **`/rules` only shows the active mapping.** No UI to compare the
  default vs Granite State maps side-by-side. Not blocking.

## 7. Recommended next PR

In priority order:

1. **Wire the mapped-rule mode into the eval harness.** Add a new
   eval mode that runs the rules layer with the business mapping
   applied, reports intent coverage and post-mapping category match,
   and updates `/evals` with the honest delta. This is the natural
   continuation of this sprint — the data model is in place; only
   the eval CLI needs the new mode.
2. **Auto-derive a per-tenant rule map from correction memory.**
   After N corrections of `(merchant → category)`, generate a
   tenant-specific rule layer that bypasses the model entirely for
   that merchant. Pairs with #1.
3. **Per-tenant `Business` model + a mapping admin UI.** Turn the
   single-tenant assumption into multi-tenant. Out of scope but the
   single biggest follow-up.
4. **Owner-question free-text answer memory.** When a vendor recurs
   and the owner already answered for it, surface the same answer
   pre-selected. Listed in `docs/OWNER_QUESTIONS_V2.md`.
5. **QuickBooks-friendly CSV export mapping.** Map the handoff CSV
   to IIF or QuickBooks Online's import format.

The recommended single next PR is **#1 (mapped-rule eval mode)** —
it directly capitalises on the plumbing this sprint just shipped.
