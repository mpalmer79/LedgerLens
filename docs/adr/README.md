# Architecture Decision Records

An Architecture Decision Record (ADR) captures a single significant architectural choice — its context, the decision, the consequences, and the alternatives that were rejected. ADRs are immutable once accepted; reversing a decision means writing a new ADR that supersedes the old one.

## Adding an ADR

1. Copy `template.md` to `NNNN-short-title.md`, incrementing `NNNN` to the next free number.
2. Set the status to `Proposed`.
3. Fill in context, decision, consequences, and alternatives.
4. Open a PR. On merge, update the status to `Accepted` (or `Rejected`, in which case keep the file for the record).

## Accepted ADRs

- [ADR-0000](0000-record-architecture-decisions.md) — Record architecture decisions
- [ADR-0001](0001-python-version.md) — Python version requirement
- [ADR-0002](0002-deployment-topology.md) — Deployment topology

## Planned ADRs

Renumbered from [ARCHITECTURE.md §13](../ARCHITECTURE.md) to reflect actual project trajectory. The data model itself does not need an ADR — only the controversial choices within it do.

- **ADR-0003** — pgvector over a dedicated vector store (next, alongside the data model).
- **ADR-0004** — Separate `corrections` table over an updates column on `transactions`.
- **ADR-0005** — Synchronous categorization endpoint over queue-based processing for v0.
- **ADR-0006** — Choice of Anthropic API over a multi-provider abstraction.
- **ADR-0007** — Haiku-primary, Sonnet-fallback model selection over single-model.
- **ADR-0008** — Synthetic eval businesses over real anonymized data.
