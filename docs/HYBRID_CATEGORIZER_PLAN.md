# Hybrid categorizer plan

## Current categorization flow

`services/categorize.py::categorize_transaction` runs in this order today:

1. **Correction memory** lookup (`services/correction_memory.py::find_memory_match`):
   - `apply` → persist a `CategorizationResult` with `provider="correction_memory"`, `confidence=1.0`, `cost=0`, `status=auto_approved`, explanation cites the source review.
   - `conflict` → persist `needs_review` with `confidence=0` and the conflicting codes.
   - `none` → fall through.
2. **Model categorizer** (default: `ClaudeHaikuCategorizer`):
   - Persist with `provider="anthropic"`, real cost / latency / confidence.
   - Status resolved by `_route_status` against the active COA and the configured thresholds:
     `auto_approved` ≥ 0.90, `needs_review` ≥ 0.60 or unknown code, `uncategorizable` for the `UNCATEGORIZABLE` sentinel.

The "obvious case" is paying full model cost: every Adobe charge that hasn't been seen by a reviewer hits Anthropic, even though the answer is mechanical. That's the gap this session closes.

## Proposed hybrid flow

Insert a deterministic rule categorizer between memory and the model:

1. Correction memory lookup (unchanged).
2. **NEW** Deterministic rule categorizer (`services/rule_categorizer.py`).
   - Strong match (single rule, confidence ≥ auto threshold) → persist with `provider="rule_categorizer"`, zero cost, `status=auto_approved`.
   - Ambiguous match (multiple distinct categories matched, or low rule confidence) → persist with `status=needs_review` and an explanation listing the candidates.
   - No match → fall through to the model.
3. Model categorizer (unchanged).
4. Confidence routing → status (unchanged for the model path).
5. Human review (unchanged).
6. Audit event identifies the source layer (`categorized_from_memory`, `categorized_from_rules`, or `categorized`).

The order is: memory > rules > model. **Rules never override correction memory**, and **rules never override an active high-confidence model prediction once the model has been called** — they sit *before* the model precisely so the model isn't called when the rule layer can decide safely.

## Rule data source

Rules live in `backend/src/ledgerlens/data/category_rules.json`. Each rule:

| Field | Type | Notes |
|---|---|---|
| `id` | string | stable identifier (e.g. `rule.adobe.software`) |
| `name` | string | human-readable |
| `active` | bool | inactive rules are skipped at load |
| `priority` | int | higher wins on tie-break |
| `match_type` | enum | `exact_merchant`, `merchant_contains`, `description_contains`, `keyword_any`, `keyword_all` |
| `merchant_patterns` | string[] | uppercase tokens to match against the transaction merchant |
| `description_patterns` | string[] | uppercase tokens to match against the normalized description |
| `category_code` | string | must exist in the active COA at load time |
| `confidence` | float [0,1] | suggested rule confidence; only ≥ auto threshold auto-approves |
| `explanation` | string | shown to reviewers |
| `notes` | string | maintainer note, not surfaced to UI |

Match-type semantics:

- **`exact_merchant`** — `tx.merchant.upper().strip()` exactly equals any of `merchant_patterns`. Strongest signal.
- **`merchant_contains`** — `tx.merchant.upper()` includes any token. Medium signal.
- **`description_contains`** — `normalized_description` includes any token. Medium signal.
- **`keyword_any`** — at least one keyword appears in merchant or normalized description.
- **`keyword_all`** — every keyword must appear (good for compound patterns like "AMAZON BUSINESS").

## Conflict strategy

After scanning all active rules:

- 0 matches → `none` → model fallback.
- 1+ matches that all agree on the same `category_code` → use the **strongest evidence rule** (highest priority, then highest confidence). Confidence on the persisted result is the matched rule's confidence (clamped). If that ≥ `auto_queue_threshold`, status is `auto_approved`; otherwise `needs_review`.
- 2+ matches with **different** category codes → ambiguity → `needs_review` with a "rule_conflict" explanation listing the candidates. Confidence 0.

## Safety rules

- Rules never run if correction memory already applies.
- Rules **must** map to an active category. Rules pointing at an inactive or missing code are skipped at load time with a logged warning. The eval/test harness asserts no warnings on the bundled rule file.
- Rules with `confidence < ledgerlens_review_queue_threshold` (0.60) never auto-apply — they force `needs_review` even on a single match.
- "Generic" or very short keyword tokens (length < 3, or in the same blocklist correction-memory uses) are stripped at load time. A bundled rule cannot ship with `["A"]` as its only pattern.
- Rule explanations are deterministic and cite the rule id, so reviewers can see *which* rule fired (and turn it off if it's wrong).
- We never claim a rule result is "AI". UI distinguishes the three providers: `correction_memory`, `rule_categorizer`, `anthropic`.

## API / UI impact

Backend:

- New service: `services/rule_categorizer.py`.
- `categorize_transaction` extended to consult the rule layer between memory and the model.
- New router endpoints:
  - `GET /rules` — list active rules (loaded from JSON, validated against current COA).
  - `GET /transactions/{id}/rule-matches` — show what the rule layer would predict for a transaction (verdict + matched rule, or "no match").
- `CategorizationResult.model_provider` adds the literal value `"rule_categorizer"`; `model_name` becomes the rule id when applicable (e.g. `"rule.adobe.software"`).
- Audit event `categorized_from_rules` is written when the rule layer produces the persisted result; `rule_conflict_routed_to_review` is written for ambiguous matches.
- `CategorizeBatchOut` already counts statuses; no schema change needed. A new aggregate field `zero_cost` is added for honesty about how many of these transactions never reached the model.

Frontend:

- `/transactions/[id]`:
  - Latest-categorization card shows a "Source" line: `correction memory`, `deterministic rules` (with rule id), or model name.
  - New "Rule matches" panel parallel to the existing "Correction memory" panel, showing rule verdict + matched rule.
- Review queue card surfaces the rule id when a transaction is in review because of rule ambiguity.
- Dashboard `/app` adds a "Zero-cost categorizations" tile (count of results with `cost = 0 AND provider ∈ {correction_memory, rule_categorizer}`).
- Optional `/rules` page: lightweight, read-only, lists the bundled rule set.

## Test plan

Backend (≥ 13 new tests):

1. Strong exact-merchant rule auto-approves and zero-cost.
2. Rule categorization does not call the model.
3. Rule result has `provider="rule_categorizer"` and `model_name` = rule id.
4. Rule result has `estimated_cost_usd == 0`.
5. Inactive rule ignored.
6. Rule pointing at an inactive / missing category is filtered at load.
7. Two rules with different categories for the same input route to `needs_review` (rule conflict).
8. Correction memory beats rules — when memory exists, the rule layer never runs.
9. No rule match falls through to the model unchanged.
10. Low-confidence rule (below `review_queue_threshold` but still > 0) routes to `needs_review`, not `auto_approved`.
11. Audit event `categorized_from_rules` is written.
12. `GET /rules` returns the active rule set.
13. `GET /transactions/{id}/rule-matches` returns verdict + matched rule.
14. Conflict audit `rule_conflict_routed_to_review` is written.

Frontend:

- API client unit tests for `listRules` and `getRuleMatches`.
- Existing frontend tests remain green.

## Known limitations

- The bundled rule set is manually curated. A multi-tenant deployment will want per-tenant rules; we don't have that abstraction yet.
- No semantic embeddings. Adobe ≠ "ADOBE INC USD CHG" unless one of the bundled patterns covers both.
- No accounting-system integration: the rule category codes are LedgerLens's own COA only.
- No auto-learning of rules from corrections. Corrections live in `CorrectionMemory`; rules live in the JSON file. Two distinct layers on purpose.
- No "rule overrides high-confidence model" path. By design — rules run *before* the model so the model never gets called when a rule decides. The other direction (let a rule veto a model prediction afterwards) is more dangerous and intentionally not in scope.
