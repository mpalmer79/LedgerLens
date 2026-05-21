# ADR-0003: Synthetic eval data over real anonymized data

**Status:** Accepted
**Date:** 2026-05-21
**Deciders:** Michael Palmer

## Context

ARCHITECTURE §7 establishes the eval harness as a first-class system component. The dataset it runs against is foundational — every accuracy number and gating decision is anchored to it. The dataset has to exist before the categorization pipeline, so "what good looks like" is defined before there is pressure to rationalize whatever the pipeline produces.

Two sources are candidates: **real bank-statement data, anonymized** (pulled from cooperating businesses, scrubbed, hand-labeled by a bookkeeper) or **synthetic data designed to mimic real bank patterns** (fictional businesses with hand-authored charts of accounts and transactions).

Three constraints drive the decision. The dataset must be committable to a public GitHub repo. It must be reproducible across sessions — deterministic and versioned. And the labeling effort must be tractable for one person; anything requiring a sustained bookkeeping engagement is out of scope.

## Decision

We use synthetic data for v0 of the eval dataset: three businesses (specialty coffee shop, single-principal design studio, independent auto-repair shop), ~100 hand-labeled transactions each, ~30 of them flagged adversarial across the three. The data lives in `evals/datasets/v0/` as JSON files. Labels are first-pass and authored by the assisting LLM, awaiting human review and refinement by the project owner.

## Consequences

- **Shareable.** The dataset commits to the public repo with no privacy review and no scrubbing pipeline to maintain.
- **Versionable.** Revisions go into `v1`, `v2`, etc. The eval harness pins to a version; comparisons across versions are explicit.
- **Reproducible.** Synthetic data is deterministic; nothing changes between sessions unless someone changes it.
- **Optimistic accuracy.** Real bank statements include patterns we won't have anticipated — foreign-currency feeds, mid-word truncations, vendors that disappear and reappear under new names. Accuracy on this dataset is an upper bound on real-world accuracy.
- **Adversarial slice is the labeler's best guesses at hard cases.** Genuine bookkeeper disagreement is harder to manufacture than to observe. The adversarial slice likely under-represents the true space of disagreement until iterated.
- **Labels are first-pass.** They are LLM-proposed and not authoritative. The dataset README marks this explicitly. Accuracy numbers run against unreviewed labels measure agreement with the LLM that proposed them, not agreement with a bookkeeper.

A future ADR may add a real-data eval set sourced from customers under NDA, kept out of the public repo. Out of scope for v0.

## Alternatives considered

- **Real anonymized data.** Rejected for v0: anonymization is operationally expensive, the labeling effort requires bookkeeper time the project does not have, and the dataset cannot ship publicly without a defensible scrubbing process. Reconsider if a real-data partnership materializes.
- **LLM-generated data with no human review.** Rejected: the labeler IS the source of truth in an eval. If the LLM both generates and labels with no review, the eval measures the LLM's self-consistency rather than categorization quality. v0 commits to a hybrid — LLM-generated, human-reviewed — with the review explicitly marked as pending.
