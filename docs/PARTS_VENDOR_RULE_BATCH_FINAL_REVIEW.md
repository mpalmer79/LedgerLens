# Parts-vendor rule batch (Batch #1) — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| `category_rules.json` | 25 deterministic rules. No parts-vendor rules. | **33 rules.** Added 7 parts-vendor rules + 1 tire-distributor rule (NAPA, AutoZone, O'Reilly, Advance Auto, LKQ, Carquest, plus a tire-distributor keyword_any rule). |
| `Rule.intent` taxonomy | 6 intents in active use. | Same + **`parts_inventory`** (used by 6 new rules) + **`tires_inventory`** (new intent, used by 1 new rule). |
| `BusinessRuleMap` registry | 5 maps. No `parts_inventory` on default; no `tires_inventory` anywhere. | Same 5 maps; **`parts_inventory` + `tires_inventory` added to default and Granite State**; **`tires_inventory` added to auto-repair eval** (1070); **both intents added to `block_fallback_intents`** on coffee-shop and design-agency (refuses silent miscategorization). |
| Eval mapped-rule output | Auto-repair: 5 mapped / 2 correct (40%). | Auto-repair: **19 mapped / 16 correct (84%)** — 11 parts_inventory + 3 tires_inventory + the existing 5. |
| Committed eval artifacts | `2026-05-24-*` from PR #43 (PR #43's numbers). | `2026-05-24-*` regenerated with Batch #1 rules active. |
| `/rules` page | Cross-link to multi-business evals. | Same + a **Batch #1 section** that names the new rules, their intents, and the safety boundary ("ambiguous auto-related purchases still route to owner questions"). |
| `/evals` page | Per-business mapped-rule breakdown table from PR #43. | Same + a **Batch #1 note** under the section heading: "Auto-repair mapped-row count lifted from 5 → 19; auto-approve accuracy lifted from 22.2% → 44.7%." |
| Docs | `RULE_GAP_ANALYSIS.md` from PR #43 with Batch #1 as the highest-leverage candidate. | Same + **batch-status section** marking Batch #1 shipped with measured result; next-batch ordering revised. Plus 4 new docs (audit, before/after review, improvement-loop reference, this final review). |

## 2. Why Batch #1 was chosen

`RULE_GAP_ANALYSIS.md` §10 (written in PR #43) ranked it #1 by
predicted impact: lift auto-repair coverage from 5% to ~20% via 5
new rules. The dataset has 12 NAPA rows + 1 Carquest row + 3 tire
rows that the bundled rule set didn't match at all — the cleanest
"add rules, measure result" exercise available.

The point of starting here wasn't just the headline number. It
was to prove the eval-driven rule-improvement loop **end-to-end
with committed artifacts** — gap analysis → safe rules → mapping
decisions → re-run eval → measure honestly → update roadmap. This
sprint is the first time LedgerLens has run that loop completely.

## 3. Rules added

```json
rule.napa.parts              → parts_inventory (conf 0.92)
rule.autozone.parts          → parts_inventory (conf 0.92)
rule.oreilly.parts           → parts_inventory (conf 0.92)
rule.advance_auto.parts      → parts_inventory (conf 0.92)
rule.lkq.parts               → parts_inventory (conf 0.88)
rule.carquest.parts          → parts_inventory (conf 0.90)
rule.tire_distributor.tires  → tires_inventory (conf 0.88, new intent)
```

Each rule's `category_code` is `5010` (seed COA's Cost of Goods
Sold) so the default mapping is sensible. The auto-repair eval
map overrides parts_inventory to 1050 and tires_inventory to 1070.
The Granite State demo map keeps both at 5010 (the demo's COGS).

## 4. Safety boundaries

- **Patterns require a recognizable vendor name + auto-context
  anchor.** No bare "AUTO" or "PARTS" patterns.
- **Fuel stations stay in `fuel_vehicle`.** A `SHELL FUEL` row
  hits `rule.shell.fuel` (intent=`fuel_vehicle`), NOT any of the
  new parts rules. Test asserts this.
- **Generic "AUTO" text does not match.** Test asserts
  `AUTO REPAIR SHOP INVOICE` / `AUTO INSURANCE PREMIUM` /
  `WALMART AUTO CENTER` produce no parts-rule match.
- **Ambiguous marketplace purchases stay review-routed.** Amazon
  / Home Depot / Lowe's have no auto-categorize rules. Test
  asserts they predict UNCATEGORIZABLE.
- **Coffee-shop and design-agency block `parts_inventory` +
  `tires_inventory` fallback.** A NAPA charge on a coffee shop
  routes to review, never silently classifies as COGS - Green
  Coffee. Test asserts both.

## 5. Eval before/after

| Metric | Before (PR #43) | After (this PR) | Δ |
|---|---:|---:|---:|
| Overall accuracy | 2.32% | **6.95%** | +4.6pp |
| Non-adversarial accuracy | 1.85% | 7.01% | +5.2pp |
| Adversarial accuracy | 6.45% | 6.45% | 0 |
| Auto-approve accuracy | 22.2% | **44.7%** | +22.5pp |
| Total mapped rows | 72 | 86 | +14 |
| `correct_when_mapped` (total) | 7 | 21 | +14 |

## 6. Business-specific impact

| Business | Before | After |
|---|---|---|
| auto-repair | 5 mapped / 2 correct (40%) | **19 mapped / 16 correct (84%)** |
| coffee-shop | 28 mapped / 5 correct (17.9%) | 28 mapped / 5 correct (17.9%) — unchanged |
| design-agency | 39 mapped / 0 correct (0%) | 39 mapped / 0 correct (0%) — unchanged |

Auto-repair was the target. Coffee-shop and design-agency
behaviour is unchanged by design — the new merchant patterns
don't appear in those datasets, and the new intents are
block-fallback on those businesses so future NAPA-style charges
will route to review, not auto-categorize.

## 7. What improved

- **Auto-repair deterministic coverage** lifted from 5% to 19%.
- **Auto-repair mapped-accuracy** lifted from 40% to 84%.
- **Auto-approve accuracy** on the rules-only mode lifted from
  22.2% to 44.7%.
- **The improvement loop is now demonstrated.** A reader can
  diff `evals/runs/2026-05-24-comparison.json` against the
  previous artifact and see the rule-batch's measured impact.

## 8. What stayed weak

- **Design-agency mapped accuracy is still 0%.** Batch #3 (software
  intent split) is the next-best rule work; promoted to top
  priority in the updated `RULE_GAP_ANALYSIS.md`.
- **Coffee-shop merchant_fees row labelling** remains
  dataset-ambiguous (22 fallback rows where the dataset can't
  decide between 6100 Merchant Fees and 6110 Bank Service
  Charges).
- **Adversarial rows** still untouched. Mapping parts doesn't help
  on Mitchell1-prepaid-policy or shop-supplies-vs-COGS judgement
  calls.
- **Hybrid mapped run** not committed (requires Anthropic credit).

## 9. Honesty constraints preserved

- ✅ No "100% AI accuracy" claim anywhere.
- ✅ Raw Haiku accuracy (62.9% / 41.9% adversarial) still headline
  on `/evals`.
- ✅ Design-agency 0% mapped-accuracy continues to be reported
  plainly (no cherry-picking).
- ✅ Adversarial accuracy (unchanged at 6.45%) still reported
  honestly.
- ✅ `block_fallback` reported as safe abstention, not
  misclassification.
- ✅ Workflow-level trust language preserved. Rule auto-approval is
  still one of the three defensible verification authorities; no
  new path to verification.
- ✅ Fictional sample scenario + "not tax advice" disclaimers intact.
- ✅ Demo-stub regression test still passes (Anthropic SDK still
  never imported in demo mode).
- ✅ No email / phone / resume / `tel:` / `mailto:` added.

## 10. Tests added / updated

**Backend — 202 passed (was 183, +19)**

New `backend/tests/test_parts_vendor_rule_batch.py`:

- NAPA / AutoZone / O'Reilly / Advance Auto / LKQ / Carquest each
  resolve to `parts_inventory` and land on auto-repair `1050`.
- Tire distributors (TIRERACK, SNOW TIRE BULK, GRANITE STATE
  TIRE) resolve to `tires_inventory` and land on auto-repair
  `1070`.
- `SHELL FUEL` still resolves to `fuel_vehicle`, not parts.
- Generic AUTO text does not match any parts rule.
- Granite State demo map carries both intents pointing at 5010.
- Coffee-shop blocks parts_inventory + tires_inventory fallback.
- Design-agency blocks parts_inventory + tires_inventory fallback.
- Amazon rule unchanged at 0.4 confidence (never auto-approves).
- Home Depot / Lowe's do NOT hit any auto-approval rule.

New `backend/tests/api/test_parts_vendor_production_path.py`:

- NAPA, AutoZone, LKQ, Granite State Tire each fire through the
  production `find_rule_match` (not just the eval categorizer).

One existing test updated: `test_granite_state_specific_overrides`
in `tests/test_rule_mapping.py` — the assertion that
`DEFAULT_INTENT_MAP.resolve("parts_inventory") is None` updated to
`== "5010"` since the default map now carries the intent.

**Frontend — 161 passed (was 159, +2)**

New `page-content.test.ts` assertions:

- `/rules` describes Batch #1 (NAPA, AutoZone, parts_inventory,
  tires_inventory, Home Depot routes to owner questions).
- `/evals` notes the Batch #1 measured impact (22.2% → 44.7%
  auto-approve accuracy).

## 11. Remaining weaknesses

- **Design-agency mapped-accuracy is the single most visible weak
  spot.** Batch #3 is the explicit next move.
- **Coffee-shop merchant_fees ambiguity** is a dataset-labeling
  question; needs the dataset README to document the rule between
  Stripe-fee vs Bank-Service-Charge before more rules can help.
- **Hybrid mapped run uncommitted** — requires Anthropic credit;
  documented as a manual local step.
- **No auto-derivation of business maps from correction memory** —
  still hand-curated. Future work.
- **Bundled rule set still small (33 rules).** Each batch chips
  away at coverage; the rule layer will never replace the model
  for the long tail.

## 12. Recommended next PR

In priority order (revised after Batch #1 measurement):

1. **Batch #3 — split `software_subscription` intent for
   design-agency.** Add `software_design`, `software_hosting`,
   `software_project_mgmt`, `software_communication` sub-intents
   + rules for Figma, Vercel, Notion, Linear, Slack, Asana, Zoom
   variants. **Design-agency mapped accuracy 0% → ~50%.** Biggest
   accuracy lift available right now.
2. **Batch #2 — payroll-service rules** (ADP, Gusto, OnPay). Hits
   all three businesses.
3. **Coffee-shop merchant_fees labelling documentation** + a
   small dataset-side label-rule clarification.
4. **QuickBooks-friendly CSV export mapping** (off the rule
   track; separate value).
5. **Observability / request IDs** — backend echoes `X-Request-Id`,
   frontend surfaces it in `<ErrorState>` technical details.

The recommended single next PR is **#1 (Batch #3 software intent
split)** because it directly targets the only business in the
mapped run with 0% accuracy and applies the same improvement loop
this sprint just demonstrated.
