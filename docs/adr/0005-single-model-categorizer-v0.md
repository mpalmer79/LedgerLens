# ADR-0005: Single-model categorizer for v0

**Status:** Accepted
**Date:** 2026-05-21
**Deciders:** Michael Palmer

## Context

ARCHITECTURE §4 specifies a two-model categorization chain: Haiku on every transaction, with Sonnet as a fallback when Haiku's confidence falls below a tuned threshold or an "ambiguity heuristic" fires. The chain trades cost for accuracy on the harder transactions.

Building the fallback chain requires three inputs: a calibrated confidence signal from Haiku, a defensible threshold, and a heuristic for ambiguity. As of this session the project has none of them — session 5's stub reported confidence 0.5 on every prediction, a constant, not a signal. The threshold has to come from Haiku's actual confidence distribution against ground truth, which is exactly what the first real run produces.

Choosing the fallback shape before that run means tuning against guesses. Once a fallback is in the code, swapping it for the empirically right one becomes a refactor instead of a clean choice.

## Decision

The v0 real categorizer is single-model: Claude Haiku (`claude-haiku-4-5-20251001`), pinned. One API call per transaction. The fallback chain is deferred to a future session, gated on examination of the first run's calibration data.

The categorizer name `claude-haiku-v1` is structured to allow future versions without naming collisions: `claude-haiku-v2` for prompt revisions on the same model, `claude-haiku-sonnet-v1` for the eventual fallback chain.

## Consequences

- **Simpler implementation.** One model, one prompt, one parse step, one retry path. Easier to reason about and to compare against the stub baseline.
- **Calibration data from a single model becomes the input to the fallback design.** The reliability diagram from the first real run tells us whether Haiku's confidence already correlates with accuracy. If it does, the fallback threshold has an obvious place to sit. If it doesn't, the fallback itself is the wrong tool and prompt iteration is the next move.
- **Accuracy is bounded by what Haiku can do.** Transactions Sonnet would handle better are mishandled here. The cost of this bound is measured directly by the v0 run.
- **Cost is bounded too.** Single-call Haiku at v0 prompt size is approximately $0.001-0.002 per transaction; the whole 302-transaction dataset runs under a dollar. Cheap enough to re-run after every prompt revision.
- **Determinism.** LLM outputs are not deterministic across runs. The harness processes transactions in sorted ID order, but two runs of the same categorizer produce slightly different per-transaction outputs; aggregate metrics are stable to within a few percentage points.

## Alternatives considered

- **Implement the Haiku → Sonnet fallback immediately.** Rejected: threshold and ambiguity heuristic both require empirical data we don't have. Building them now means tuning against guesses, then refactoring once real data arrives. The refactor cost is paid twice.
- **Use Sonnet only.** Rejected: 5-10× the per-call cost of Haiku with no measured benefit. Cost is a named architectural driver in §2; spending it without a demonstrated need is the failure mode this project is supposed to avoid.
- **Use response_format JSON mode for structured output.** Rejected: `tool_use` is the idiomatic Anthropic pattern and is the same surface the production categorizer will use once it grows.
