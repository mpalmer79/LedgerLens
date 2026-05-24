# Safe rule improvement loop

How LedgerLens turns eval findings into measured deterministic
improvements without overclaiming.

## 1. Why LedgerLens improves rules through evals

The deterministic rule layer is the lowest-cost, most explainable
path from a bank-transaction string to a COA category. Rule
auto-approvals are zero-cost (no model calls), zero-latency, and
auditable — a reviewer can trace exactly which rule fired and why.

But rules only matter if they fire on the right rows AND land in
the right COA bucket for the active business. The mapped-rule eval
harness (PR #42, PR #43) measures both. The improvement loop is
the discipline of using those measurements to drive what we ship
next.

## 2. How gaps are identified

`docs/RULE_GAP_ANALYSIS.md` is the authoritative gap document. It
reads from the most recent mapped-rule eval artifact and surfaces:

- **Top unmapped intents** — rules that fired but had no business
  override → currently using rule's seed-COA default.
- **Rule intents with poor accuracy** — where mapping fires but
  ground truth disagrees. Signals rule needs finer granularity or
  is genuinely ambiguous.
- **Businesses with low deterministic coverage** — where the rule
  layer doesn't fire on enough rows.
- **Merchant patterns that appear repeatedly but lack good rules**
  — the next-batch candidates.

The doc lives in the repo (not in code) so any reviewer can read
the same numbers the next-PR planner sees.

## 3. How safe rules are selected

A new rule is "safe" when:

1. **The merchant pattern is recognizable.** A search for the
   pattern in real bank descriptions returns the vendor we mean,
   not surnames or unrelated industries.
2. **The intent is unambiguous.** "NAPA Auto Parts" → parts
   inventory is unambiguous. "Walmart" → office supplies is NOT
   unambiguous and stays as an owner question.
3. **The confidence is calibrated.** Above 0.9 → auto-approves.
   At 0.88 → routes to review (the user sees the suggested
   category but a human confirms).
4. **The rule's default category code is defensible** for at
   least one business (typically the seed COA + the production
   demo). Per-business mappings handle the rest.
5. **Business maps block fallback** where the rule's default code
   would be silently wrong on a particular COA. Adding NAPA must
   not silently classify a coffee shop's NAPA charge as Green
   Coffee.

Rules that don't meet all five criteria stay out of
`category_rules.json` and route through `/questions` or `/review`
instead.

## 4. How rules are mapped per business

Three layers of mapping resolution, in order:

1. **Active business override** (`BusinessRuleMap.intent_to_code`)
   — wins if the mapped COA code exists on the dataset's COA.
2. **Business explicitly blocks fallback** (`block_fallback_intents`)
   — routes to review even if step 3 would otherwise resolve.
3. **Rule's own `category_code`** — used if it exists on the COA.
4. **None of the above** → route to review (predict
   `UNCATEGORIZABLE`).

Batch #1 added the `parts_inventory` intent to every map:

- Default seed COA: maps to `5010` (Cost of Goods Sold).
- Granite State demo: maps to `5010` (same code in seed COA).
- Auto-repair eval: maps to `1050` (Inventory - Parts (Resale)).
- Coffee-shop eval: blocked (a coffee shop never auto-categorizes
  parts).
- Design-agency eval: blocked (a design agency has no parts
  concept).

The same pattern applies to every future intent. Adding intent
without a per-business decision is a half-finished rule.

## 5. How evals are rerun

```bash
# Free baseline + mapped runs:
python -m ledgerlens.evals.run --categorizer rules-only
python -m ledgerlens.evals.run --categorizer rules-only-mapped

# Side-by-side comparison artifact:
python -m ledgerlens.evals.compare --runs-dir ./evals/runs
```

The comparison output is committed to `evals/runs/YYYY-MM-DD-comparison.{json,md}`
so any reviewer can git-blame the rule layer's measured progress.

## 6. What Batch #1 proved

Batch #1 (this sprint, parts-vendor rules) is the first time
LedgerLens ran the full loop end-to-end with committed artifacts:

| Step | Artifact |
|---|---|
| Gap identification | `docs/RULE_GAP_ANALYSIS.md` §10 — Batch #1 named as highest-leverage rule batch. |
| Audit | `docs/PARTS_VENDOR_RULE_BATCH_AUDIT.md` — defined patterns, safety boundaries, expected impact. |
| Implementation | 8 new rules in `category_rules.json` + `tires_inventory` intent + 5 map updates. |
| Re-run | `evals/runs/2026-05-24-rule-categorizer-{v1,mapped-v1}.json` + comparison. |
| Honest measurement | Auto-repair coverage 5% → 19%, mapped accuracy 40% → 84%, auto-approve accuracy 22.2% → 44.7%. |
| Roadmap update | `docs/RULE_GAP_ANALYSIS.md` updated with Batch #1 result + next-batch ordering. |

Batch #1's measured impact landed close to the audit's prediction
(coverage 5% → ~20% predicted vs 5% → 19% actual). The honest read
is that the rule layer's improvement loop works as designed — gap
analysis predicted the right intervention.

## 7. Why ambiguous rows still route to review

Several merchant types are deliberately NOT in the rule layer:

- **Amazon, Costco, Walmart, Target, Sams Club** — ambiguous
  category (office supplies / inventory / personal). Routed via
  `/questions` `marketplace_purchase` template.
- **Home Depot, Lowe's** — shop supplies vs personal building
  repair. Routed via `/questions` `home_improvement_store`
  template.
- **OWNER TRANSFER, VENMO PAYMENT, ATM WITHDRAWAL** — owner-side
  movement. Routed via `/questions` `owner_transfer` template.
- **CHECK #, ACH TRANSFER VENDOR REF** — vendor without merchant
  context. Routed via `/questions` `unknown_ach_transfer`
  template.

These should not become auto-approval rules. The cost of being
wrong (silently miscategorized rows in the books) outweighs the
benefit of saving a click on `/questions`. The trust metric stays
workflow-level: a row is verified only when a defensible authority
(rule, correction memory, or human review) signed off.

## 8. Future batches

Updated priority after Batch #1 measurement:

1. **Batch #3 — software intent split** for design-agency. Biggest
   accuracy lift available (design-agency mapped accuracy 0% → ~50%).
2. **Batch #2 — payroll-service rules** (ADP, Gusto, OnPay). Hits
   all three businesses; modest impact per-business but broad.
3. **Coffee-shop merchant_fees labelling clarification.**
4. **Utilities split** (electric vs gas/water).
5. **Auto-derive maps from correction memory.** Lets a tenant's
   accumulated `(merchant → category)` corrections produce a draft
   business map without hand-curation.

Each next batch should follow the same six-step loop: gap →
audit → safe rules → mapping decisions → rerun → measure → roadmap
update. The discipline matters more than the speed.
