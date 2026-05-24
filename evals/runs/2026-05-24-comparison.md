# LedgerLens eval comparison

Generated 2026-05-24T04:54:00+00:00.

Pipeline order in production: **correction memory → deterministic rules → model fallback → confidence routing → human review → audit.** Each row below is a single eval mode; the hybrid mode mirrors the layered pipeline minus correction memory (memory simulation is a separate run).

| Categorizer | Tx | Overall | Non-adv | Adversarial | Cost / 100 | p95 (ms) | Routing | Model calibration | Mapping |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
| claude-haiku-v1 | 302 | 62.9% | 65.3% | 41.9% | $0.3351 | 5952 | — | — | — |
| rule-categorizer-mapped-v1 | 302 | 7.0% | 7.0% | 6.5% | $0.0000 | 0 | auto 12.6% @ 44.7% acc · review 15.9% | no model calls | mapped 86 · fallback 0 · review 0 |
| rule-categorizer-v1 | 302 | 0.0% | 0.0% | 0.0% | $0.0000 | 0 | auto 12.6% @ 0.0% acc · review 15.9% | no model calls | — |
| stub-v1 | 302 | 9.3% | 10.3% | 0.0% | $0.0000 | 0 | auto 0.0% @ 0.0% acc · review 100.0% | no model calls | — |

## Honest framing

- Rules are tenant-specific. The `rules-only` (generic) baseline targets the default seed chart of accounts, while the three synthetic eval businesses each use their own COA numbering. The `rules-only-mapped` mode resolves each rule's intent through a per-business map (see `ledgerlens.data.business_rule_maps`) — curated maps now exist for **all three** eval businesses (auto-repair, coffee-shop, design-agency). Two of the three businesses' maps additionally use `block_fallback_intents` to refuse the rule's seed-COA default when it would silently miscategorize on the dataset COA (e.g. seed 6120 = Meals on coffee-shop is Office Supplies; we route to review instead). The deeper value of the rule layer in production is cost reduction (zero model spend on matched rows), not raw accuracy on this synthetic benchmark — see `docs/RULE_GAP_ANALYSIS.md` for the concrete next-best rule work.
- **Auto-approved accuracy matters more than overall accuracy.** That's the column reviewers should optimise — predictions that would be posted to the books without a human looking.
- **Review rate is a cost lever, not a quality lever.** A 100% auto-approve rate at 50% accuracy is worse than a 50% auto-approve rate at 95% accuracy.
- **Deterministic confidence is not a probability.** Rule predictions report the rule's curated confidence (e.g. 0.95 for Adobe), not a model probability. Calibration is reported separately for model-only and deterministic predictions.

## What this report does NOT show

- Per-business breakdowns of mapped/fallback/review counts. See `metrics.overall.mapping.per_business` in the mapped run JSON or the `/evals` Business-specific rule mapping section.
- Confidence calibration after temperature scaling / Platt scaling. Raw model probabilities only.
- Real correction-memory hit rates from a production stream. The memory hybrid mode uses a simulated train/test split (deterministic seed, no leakage), which is a lower bound on real-world coverage.
