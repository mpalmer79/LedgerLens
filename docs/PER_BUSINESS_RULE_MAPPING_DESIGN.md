# Per-business rule intent mapping — design

## 1. Current rules limitation

`backend/src/ledgerlens/data/category_rules.json` ships ~25 deterministic
rules that match merchants / descriptions and assert a `category_code`.
For example:

```json
{
  "id": "rule.intuit.software",
  "merchant_patterns": ["INTUIT", "QUICKBOOKS"],
  "category_code": "6070",  // Software Subscriptions
  "confidence": 0.95
}
```

The `category_code` is hard-coded against the default seed COA. The
rules loader filters out any rule whose `category_code` doesn't exist
on the active business — so if a business's COA uses a different code
for software (or doesn't have a Software Subscriptions account at all),
the rule silently drops out of the rule set.

That's two related problems:

- **Label-resolution friction.** The rule's *intent* (this is a
  software subscription) is correct for ~every business — only the COA
  code differs. Today we have to ship a separate rule per COA variation,
  or the rule disappears entirely.
- **Eval credibility friction.** Rules-only eval mode reports
  category-code match accuracy. A rule that says "INTUIT → 6070" gets
  zero credit if the eval COA uses `6075` for software. The eval can't
  tell the difference between "the rule was wrong" and "the rule's
  intent was right, but the label didn't match."

## 2. Why this matters for eval credibility

The honest LedgerLens story is: deterministic rules + correction memory
are *intent-correct* for the vast majority of repeating vendors. The
gap between "rule fires" and "row ends in the right COA bucket" is
label-resolution, not classifier capability. The eval harness should
let us measure that explicitly.

Without intent mapping, the rules-only eval mode is a pessimistic lower
bound on the rule layer's real value. With intent mapping, we can
report two numbers honestly: (a) intent match (the rule's intent equals
the labelled intent), and (b) post-mapping category match (the
resolved code equals the labelled code). Today we only had (b), and only
when the labels happened to match.

## 3. Intent-based rule mapping approach

Each rule declares an optional `intent: string`. The Rule dataclass
in `services/rule_categorizer.py` carries it. The loader extracts it
from the JSON.

A `BusinessRuleMap` is a per-business `dict[intent, category_code]`.
Two ship today (single-tenant):

- `DEFAULT_INTENT_MAP` — generic mapping aligned to the default seed
  COA. Covers software_subscription, payroll, rent, utilities, fuel,
  meals, etc.
- `GRANITE_STATE_INTENT_MAP` — the Granite State Auto Repair sample
  scenario's overrides. Parts → 5010 (COGS), Comcast Business → 6150
  (Telecom), Stripe deposit payout → 4010 (revenue), etc.

The categorize service, after a rule matches, resolves the effective
code via `resolve_category_for_intent(rule.intent, fallback_code=rule.category_code)`.
If the active business has a mapping, the mapped code wins.

The "active business" is resolved through
`ledgerlens.data.sample_scenario.SAMPLE_SCENARIO` (single-tenant). A
real multi-tenant deploy would resolve from a request header / JWT.

## 4. Mapping behavior when exact category is unavailable

Three cases:

1. **Rule has no `intent`.** No-op. The rule's own `category_code` is
   used. Backward-compatible with v1.
2. **Rule has `intent` and the active business has a mapping for it.**
   The mapped code wins. If the mapped code doesn't validate against
   the active COA, fall back to the rule's own code.
3. **Rule has `intent` and the active business has *no* mapping.** The
   rule's own `category_code` is used as a safe fallback.

The rules loader still validates `category_code` against the COA at
load time — a rule whose own code doesn't exist on the active business
is dropped from the active rule set. The mapping layer is an
**override**, not a replacement.

## 5. Fallback behavior

When a rule fires but no clean category can be resolved (mapped code
invalid AND rule's own code invalid AND no fallback), the categorize
service routes the transaction to review via the standard
`ResultStatus.NEEDS_REVIEW` path — the same place a confidence-below-
threshold match would land. The handoff treats it like any other
review item.

We deliberately did **not** add a new `ResultStatus.RULE_UNMAPPED`
because (a) it would create a new state to thread through the trust
metric and (b) `NEEDS_REVIEW` is the right user-facing answer either
way: a human looks at the row.

## 6. How this affects the demo scenario

Granite State Auto Repair gains accurate parts categorization on first
seed:

- NAPA / AutoZone / O'Reilly / Advance Auto / LKQ → `parts_inventory` →
  **5010 Cost of Goods Sold** (when a parts rule is added; today these
  go to review by default and the owner answers "Shop inventory" which
  hits 5010 via the questions workflow).
- ADP Payroll → existing rule, intent `payroll`, **6030 Wages &
  Salaries**.
- Mitchell1 / QuickBooks / Google Workspace → existing rules, intent
  `software_subscription`, **6070 Software Subscriptions**.
- Shell / Irving / Mobil → existing rules, intent `fuel_vehicle`,
  **6130 Fuel & Vehicle**.
- Comcast Business → intent `internet_telecom` → **6150 Telephone &
  Internet** (rather than the default's generic 6020 Utilities).
- Stripe / Square fees → intent `merchant_fees`, **6100 Bank &
  Merchant Fees**.

The mapping is visible to a reviewer at `/rules` — the page shows the
active business name, the full intent→code table, and a per-row
"overrides rule default" annotation when the mapped code differs.

## 7. How this affects evals

Today's eval harness reports raw model accuracy (~63%) and rules-only
category-code match. With intent mapping the eval can report:

- **Rules-only (no mapping)** — what we report today.
- **Rules-only (with mapping)** — the new number. Should be at least
  as high as the no-mapping number; will be meaningfully higher when
  the eval COA differs from a rule's hardcoded `category_code`.
- **Hybrid (model + rules + memory + mapping)** — the production number.
- **Unmapped intent coverage** — how often a matched rule had an
  `intent` but the active business had no mapping (these route to
  review).

The eval page (`/evals`) keeps the honest raw model number visible and
adds a small "Why rule mapping matters" explainer. Numbers are not
cherry-picked. If mapping doesn't move the needle on a given dataset,
we say so.

## 8. Limitations

- **Single-tenant today.** "Active business" is hard-pinned to the
  Granite State sample scenario. A real multi-tenant deploy would
  resolve this per-request.
- **The mapping is static Python.** No admin UI; no per-tenant
  configuration table. Defensible for a portfolio demo, not for
  production multi-tenant.
- **No auto-derivation from correction memory.** A future improvement
  would let accumulated `(merchant → category)` corrections seed a
  business-specific intent map. Listed as the next-PR candidate.
- **No way for a rule to declare multiple intents.** Each rule has
  one `intent` field. A row that hits two different rules with
  different intents would route to conflict-review (the existing
  conflict path), which is the right behavior.
- **`accountant_review` is not a real intent.** A row whose intent
  is "send to accountant" should already be routed to review by the
  question template, not by a fake intent code. We didn't add it.
- **Mapped codes share the same auto-approve threshold.** A 0.95
  rule still auto-approves whether its category came from
  `category_code` or from the mapping.

The design intentionally stops short of becoming a full per-tenant rule
engine. That's the natural next sprint.
