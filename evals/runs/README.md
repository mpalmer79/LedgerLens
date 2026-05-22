# Eval Runs

> Each new categorizer produces its own run file. The accuracy trajectory across runs is the project's measured improvement signal.

One JSON file per run, named `YYYY-MM-DD-<categorizer-name>.json`. Each file is a complete `RunResult` — metadata, metrics, full per-transaction predictions.

Run files are committed to the repo to provide a versioned history of categorization accuracy. `git log evals/runs/` is the accuracy trajectory.

To produce a new run:

```
cd backend && python -m ledgerlens.evals.run --dataset v0 --categorizer <name>
```

See [ARCHITECTURE.md §7](../../docs/ARCHITECTURE.md) for metric definitions and [ADR-0004](../../docs/adr/0004-eval-harness-architecture.md) for design.
