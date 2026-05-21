# ADR-0000: Record architecture decisions

**Status:** Accepted
**Date:** 2026-05-21
**Deciders:** Michael Palmer

## Context

LedgerLens will make a series of architectural choices — model selection, retrieval strategy, data-model boundaries — whose rationale must remain legible to future maintainers and to a reader evaluating the project as portfolio work. Tribal knowledge in commit messages and chat logs decays; design rationale that lives only in the maintainer's head is indistinguishable from no rationale at all.

## Decision

We will use Architecture Decision Records (ADRs) in the format described by Michael Nygard ([original article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)). ADRs live in `docs/adr/`, are numbered sequentially starting at 0000, are immutable once accepted (superseded rather than edited), and follow the template in `template.md`.

## Consequences

### Positive
- Every significant decision has a durable, reviewable artifact.
- New contributors can read the ADR set to understand the system's "why".
- Reversing a decision is itself a decision, captured as a new ADR superseding the old one.

### Negative
- Marginal overhead per non-trivial decision.

### Neutral
- ADRs are not a substitute for the architecture document; they complement it.

## Alternatives considered

- **No ADRs (rely on commit messages and ARCHITECTURE.md)** — rejected: commit messages don't surface decisions for later readers, and ARCHITECTURE.md captures the system as designed, not the path that led there.
