# LedgerLens trust metric

## The headline number is not raw model accuracy

LedgerLens advertises one product-level metric:

> **100% of finalized guided-demo rows are procedurally verified before handoff.**

That is **not** a claim about Claude Haiku's raw accuracy on adversarial bookkeeping data. Raw model accuracy is reported honestly on `/evals` (model-only ≈ 63% on the synthetic dataset, ≈ 42% on the adversarial slice) and is intentionally not the trust boundary anywhere else in the product.

## What "procedurally verified" means

Verification is **procedural**: a defensible authority signed off on each finalized row before handoff. This is a **workflow trust boundary**, not a guarantee of accounting or tax correctness, and not a substitute for CPA review. See [`docs/ACCOUNTING_DOMAIN_BOUNDARY.md`](ACCOUNTING_DOMAIN_BOUNDARY.md) for the full domain boundary.

A row counts as **verified** iff it is **finalized** *and* its category came through one of three defensible paths:

1. **Human review** — a reviewer approved or corrected this specific row.
2. **Correction memory** — the row was categorized by `correction_memory`. Every memory rule was originally seeded by a real human correction, so a replay inherits that authority.
3. **Rule auto-approval** — the row was categorized by `rule_categorizer` and the rule confidence cleared the configured auto-threshold (`LEDGERLENS_AUTO_QUEUE_THRESHOLD`, default 0.90).

A row is **finalized** when its `categorization_status` is `auto_approved` or `corrected`. The following are explicitly **not** finalized:

- `needs_review` — by definition awaiting human input.
- `uncategorizable` — the pipeline (or a human) explicitly excluded it.
- `pending` / `failed` — never categorized successfully.

The combinations that produce an **unverified finalized** row — and therefore must stay at zero on a finalized demo ledger:

- `auto_approved` by `anthropic` (real model) with no `ReviewDecision` attached.
- `auto_approved` by `rule_categorizer` *below* the auto threshold (the pipeline already routes these to review, so they cannot reach `auto_approved`; this is here for completeness).
- Any other model that auto-approves without being touched by a human.

## API contract

`GET /ledger` returns the existing `rows` array plus a new `trust` block:

```json
{
  "total": 12,
  "unresolved": 3,
  "rows": [
    {
      "...": "...",
      "categorization_status": "auto_approved",
      "model_provider": "rule_categorizer",
      "reviewed": false
    }
  ],
  "trust": {
    "finalized_count": 9,
    "verified_count": 9,
    "unverified_finalized_count": 0,
    "review_required_count": 3,
    "deterministic_count": 7,
    "human_reviewed_count": 2,
    "verification_rate": 1.0
  }
}
```

`GET /ledger/export.csv` carries `model_provider` and `verified` columns per row so downstream tooling can filter unverified rows before posting. Every CSV export writes an `AuditEvent` with `entity_type="ledger"`, `action="exported"`, and a `details` block that includes `finalized`, `verified`, `verification_rate`, and the active `categorizer_mode`.

## How the UI surfaces it

- **Landing page** — a dedicated "Trust metric" panel with the verified-ledger headline. The raw-model-accuracy line that used to be in the tech-credibility section was reframed as "see the eval evidence for raw model performance" with a pointer to the trust panel.
- **`/demo`** — step 6 renders a `<TrustPanel variant="demo" />` after the ledger loads. A reviewer walking the guided demo sees the metric update in real time.
- **`/ledger`** — same `<TrustPanel />` at the top of the page, plus the existing per-row table.
- **`/evals`** — an honesty callout above the existing metrics: "Raw model accuracy is not the product's trust boundary." Pointer to the verified-ledger framing.

## Edge cases

- **Zero finalized rows** — the rate displays as `—` rather than 100% so a first-time visitor never sees "100% verified" on an empty database.
- **All finalized rows are verified, but `review_required_count > 0`** — the headline is `100% verified`. The trust panel additionally surfaces "review-required" so the viewer knows the workflow isn't done; they just shouldn't ship the finalized rows yet.
- **The eval page does not get a verified-ledger metric**, because eval predictions are not persisted as ledger rows. The eval page reports model behavior; the ledger reports product behavior.

## What this guarantees and what it doesn't

**It does guarantee:**

- No demo-stub result ever reaches a finalized ledger row.
- No high-confidence model auto-approval reaches a finalized ledger row without an explicit human sign-off.
- Every verified row points to one of three traceable decision authorities: a curated rule id, a correction-memory entry (which points to a source review decision), or a `ReviewDecision` row with reviewer note + timestamp.

**It does not guarantee:**

- That a *rule* is the right category for this specific tenant. The rule layer's accuracy depends on the chart of accounts being the default seed COA; on the synthetic eval businesses with mismatched COAs, rules-only accuracy is 0%. That's the per-tenant-rule-generation gap, documented separately.
- That a *human review* was thoughtful. Approve and correct both produce a `ReviewDecision` row; the system trusts the reviewer.
- That the model's prediction was right when a reviewer approves it. The product trusts the human's sign-off, not the model's probability.

## Why this is a defensible 100%

Claiming 100% raw AI accuracy on adversarial bookkeeping data would be dishonest — adversarial cases exist *because* a junior bookkeeper would forward them. Claiming 100% of finalized rows are verified before export is different in kind: it's a property of the workflow, not the model. The workflow enforces it by routing anything that lacks a defensible authority to human review. The number is true by construction — the eval and trust tests assert it — and it stays true as the model improves or degrades, because the trust boundary doesn't depend on model probability.

That's the kind of guarantee a small-business owner can actually act on, and the kind of design property a recruiter can evaluate independently of the model's headline accuracy.
