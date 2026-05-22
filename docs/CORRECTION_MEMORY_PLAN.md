# Correction memory plan

## Current correction behavior

When a reviewer clicks **Correct** on a transaction:

1. `POST /review-queue/{tx_id}/correct` validates the selected category against the active chart of accounts (`backend/src/ledgerlens/api/review.py`).
2. A `ReviewDecision` row is inserted with `reviewer_action = CORRECT`, the selected code, and the optional reviewer note.
3. The latest `CategorizationResult` status flips to `CORRECTED`.
4. An `AuditEvent` records the action with `from`/`to` codes.

That's it. The correction is stored. No future transaction looks at it. Identical "Adobe Creative Cloud" charges next month would be re-categorized from scratch by Claude Haiku.

This is the explicit gap that session 13 closes.

## What correction memory adds

A deterministic, auditable, explainable layer that reuses prior human corrections.

When a reviewer corrects a transaction, the system records the correction in a new `CorrectionMemory` table keyed by `(merchant_key, normalized_description_key)`. When a future transaction matches the same key, categorization returns the corrected category **without calling the model**, with a status of `auto_approved` and an explanation that names the source review decision.

The user-visible language is "correction memory" or "learned corrections" — not "training", not "AI learning", not "fine-tuning". This is rule lookup on top of a model categorizer, with corrections as the rules.

## Matching strategy

Two deterministic keys are built per transaction:

- **`merchant_key`** — the `merchant` field if present, else the first token of `normalized_description`. Uppercased, stripped of trailing/leading whitespace.
- **`description_key`** — `normalized_description` itself (uppercase, whitespace-collapsed, prefixes/IDs stripped — already produced by `services/normalize.py`).

Lookup priority:

1. **Exact `merchant_key` match.** Strongest signal — same vendor, same category.
2. **Exact `description_key` match.** Useful when the merchant field is empty or generic.
3. No match → fall through to the model categorizer.

There is **no fuzzy matching**. Prefix/token similarity is intentionally not in scope — the false-positive risk on financial data is not worth the lift. We can add it later behind a feature flag if the false-positive rate of exact matching turns out to be acceptable.

## Safety rules

A correction memory record will be ignored when matching if any of these are true:

- The selected category is inactive (`AccountCategory.active = False`).
- The memory record itself is inactive (`CorrectionMemory.active = False`).
- The candidate's `merchant_key` is too short (≤ 2 characters) or in the **generic blocklist**: `PAYMENT`, `ACH`, `DEBIT`, `TRANSFER`, `CHECK`, `POS`, `ONLINE`, `WEB`, `PURCHASE`, `WIRE`, `BANK`, `DEPOSIT`, `WITHDRAWAL`, `FEE`, `INTEREST`.
- The candidate's `description_key` is too short (< 6 characters).

A correction memory record will **not** be created from:

- `approve` review actions (we'd be claiming the model was right, not capturing a human override).
- `mark_uncategorizable` actions (no category to learn).
- Corrections whose target category is no longer active by the time we'd record.

If multiple `CorrectionMemory` records resolve for the same key with **different categories** (e.g. someone corrected ADOBE → Software, then later corrected ADOBE → Subscriptions), the lookup returns `conflict`. The categorize service routes that transaction to `needs_review` rather than auto-applying either record.

If a `CorrectionMemory` match disagrees with a **high-confidence (≥ auto-threshold) model prediction**, the categorize service routes to `needs_review`. The reviewer sees both signals on the detail page and decides.

## API changes

New endpoints (all under the existing FastAPI app):

- `GET /corrections` — list memory rows; supports `active`, `category_code`, and `q` (search) filters.
- `GET /corrections/{id}` — single row.
- `PATCH /corrections/{id}` — set `active` true/false, optionally change `selected_category_code` (validated), optionally update `notes`.
- `DELETE /corrections/{id}` — soft deactivate (sets `active = False`); no hard delete.
- `GET /transactions/{id}/memory-matches` — returns the matches that would apply to this transaction and the verdict (`apply` / `conflict` / `none`).

Existing endpoints change behavior, not signature:

- `POST /review-queue/{tx_id}/correct` — additionally calls `record_correction_memory()` if the transaction passes the safety filters. A new audit event `correction_memory_recorded` is written.
- `POST /categorize` and `POST /categorize/batch` — first call `find_memory_match()`. On `apply`, persist a `CategorizationResult` with `model_provider = "correction_memory"`, `confidence = 1.0`, zero cost, and an explanation citing the source review decision. On `conflict`, force `needs_review`. Otherwise, fall through to the model.

## UI changes

- **App nav** — add **Learned corrections** between Review queue and Ledger.
- **Dashboard `/app`** — add a tile "Learned corrections" showing the count of active memory rows.
- **New page `/corrections`** — table of memory rows with merchant key, description key, category, hit count, last used, source transaction link, active/inactive, and a per-row "Deactivate" button.
- **Transaction detail `/transactions/[id]`** — new "Memory match" panel: shows matched memory record (if any), or "no match" with the merchant/description keys that were checked. When a memory match drove the categorization, the latest-result card explicitly says so (model = "correction_memory").
- **Review/correction success messaging** — "Correction saved. Future transactions matching this merchant or description will be categorized automatically."

The `/corrections` page is read-mostly: a reviewer can deactivate a memory record (to disable it without losing the audit trail) but cannot edit category codes inline. To change a learned category, they correct another transaction. Deactivation is the safe operation.

## Tests

Backend (~13 new tests):

1. Correction creates a `CorrectionMemory` row.
2. Same merchant corrected twice updates the existing row's `match_count` and `last_used_at`.
3. Future transaction with matching merchant categorizes from memory (no model call).
4. Memory categorization persists `CategorizationResult` with `model_provider = "correction_memory"` and `estimated_cost_usd = 0`.
5. Generic merchant ("ACH TRANSFER") does NOT create a memory record.
6. Conflicting memories (same key, different categories) route to `needs_review`.
7. Inactive category is not used.
8. Inactive memory is not used.
9. `GET /corrections` returns rows; filters work.
10. `PATCH /corrections/{id}` toggles active.
11. `DELETE /corrections/{id}` soft-deactivates.
12. `GET /transactions/{id}/memory-matches` returns expected shape.
13. Existing categorize tests still pass (memory layer is transparent when nothing matches).

Frontend (~3 new tests on the API client):

1. `listCorrections`, `getMemoryMatches`, `deactivateCorrection` shapes.
2. PATCH/DELETE call right paths.

## Known limitations

- No semantic embeddings. We don't match "Adobe Creative Cloud" with "Adobe CC" via meaning — exact key only.
- No multi-tenant memory isolation. Single-tenant by data model (same as everything else in v0).
- No model fine-tuning. This is rule lookup, not training.
- No QuickBooks/Xero integration. The corrected categories are LedgerLens's own COA.
- No automatic expiry of memory rows. If a vendor changes how it bills, the reviewer has to deactivate the stale memory and correct a fresh transaction. UI makes this easy.
- Approve actions don't create memory. We only learn from explicit overrides. Future work could weight approve-vs-correct ratios into a `trust_level`, but that's deferred.
