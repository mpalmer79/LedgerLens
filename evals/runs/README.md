# Eval Runs

> Each new categorizer produces its own run file. The accuracy trajectory across runs is the project's measured improvement signal.

One JSON file per run, named `YYYY-MM-DD-<categorizer-name>.json`. Each file is a complete `RunResult` — metadata, metrics, full per-transaction predictions.

Run files are committed to the repo to provide a versioned history of categorization accuracy. `git log evals/runs/` is the accuracy trajectory.

To produce a new run:

```
cd backend && python -m ledgerlens.evals.run --dataset v0 --categorizer <name>
```

See [ARCHITECTURE.md §7](../../docs/ARCHITECTURE.md) for metric definitions and [ADR-0004](../../docs/adr/0004-eval-harness-architecture.md) for design.

## Methodology caveat: `rule-categorizer-v1`

The `2026-05-23-rule-categorizer-v1.json` run is the deterministic rule layer scored against the synthetic v0 dataset. Coverage is roughly **24% (72 of 302 transactions matched at least one bundled rule)**, but ground-truth **accuracy is 0%** on the matched subset. This is the expected outcome, not a defect:

- The bundled rules in `backend/src/ledgerlens/data/category_rules.json` target the default seed chart of accounts (`backend/src/ledgerlens/seed.py`).
- The synthetic eval businesses (coffee-shop, design-agency, auto-repair) each use a *different* COA. The numeric code `6070` means "Software Subscriptions" in the default seed but "Payroll Service Fees" in the coffee-shop COA, and "Merchant Processing Fees" in the design-agency COA.
- So when the Adobe rule fires and emits code `6070`, the eval marks it incorrect against the design-agency ground truth (which expects code `6100`, the agency's "Software - Design Tools").

The finding is that **rules are tenant-specific**. The bundled rule set is a sensible default for the seed COA, not a general-purpose categorizer for arbitrary businesses. Per-tenant rule sets — or auto-translation of the bundled rules against each business's COA — are deferred work.

Stub and claude-haiku runs are unaffected by this caveat (their predictions are not tied to a particular COA's code numbering convention).
