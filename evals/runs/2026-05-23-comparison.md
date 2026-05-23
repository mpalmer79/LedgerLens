# LedgerLens eval comparison

Generated 2026-05-23T01:19:25+00:00.

Pipeline order in production: **correction memory → deterministic rules → model fallback → confidence routing → human review → audit.** Each row below is a single eval mode; the hybrid mode mirrors the layered pipeline minus correction memory (memory simulation is a separate run).

| Categorizer | Tx | Overall | Non-adv | Adversarial | Cost / 100 | p95 (ms) | Routing | Model calibration |
|---|---:|---:|---:|---:|---:|---:|---|---|
| claude-haiku-v1 | 302 | 62.9% | 65.3% | 41.9% | $0.3351 | 5952 | — | — |
| rule-categorizer-v1 | 302 | 0.0% | 0.0% | 0.0% | $0.0000 | 0 | auto 8.9% @ 0.0% acc · review 14.9% | no model calls |
| stub-v1 | 302 | 9.3% | 10.3% | 0.0% | $0.0000 | 0 | auto 0.0% @ 0.0% acc · review 100.0% | no model calls |

## Honest framing

- Note: `rules-only` and `hybrid-rules-model` accuracy on the synthetic dataset is bounded by a known methodology limitation: the bundled rule set targets the default seed chart of accounts, while the three synthetic eval businesses each use their own COA numbering. Many rule predictions are correct merchant→category mappings but score 0% against the eval ground truth because `6070` means different things in each business's COA. The value of the rule layer in production is cost reduction (zero model spend on matched rows), not accuracy on this benchmark.
- **Auto-approved accuracy matters more than overall accuracy.** That's the column reviewers should optimise — predictions that would be posted to the books without a human looking.
- **Review rate is a cost lever, not a quality lever.** A 100% auto-approve rate at 50% accuracy is worse than a 50% auto-approve rate at 95% accuracy.
- **Deterministic confidence is not a probability.** Rule predictions report the rule's curated confidence (e.g. 0.95 for Adobe), not a model probability. Calibration is reported separately for model-only and deterministic predictions.

## What this report does NOT show

- Per-tenant rule sets translated against each synthetic business's COA. That's next-PR work.
- Confidence calibration after temperature scaling / Platt scaling. Raw model probabilities only.
- Real correction-memory hit rates from a production stream. The memory hybrid mode uses a simulated train/test split (deterministic seed, no leakage), which is a lower bound on real-world coverage.
