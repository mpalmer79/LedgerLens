# Architecture Decision Records

An Architecture Decision Record (ADR) captures a single significant architectural choice — its context, the decision, the consequences, and the alternatives that were rejected. ADRs are immutable once accepted; reversing a decision means writing a new ADR that supersedes the old one.

## Adding an ADR

1. Copy `template.md` to `NNNN-short-title.md`, incrementing `NNNN` to the next free number.
2. Set the status to `Proposed`.
3. Fill in context, decision, consequences, and alternatives.
4. Open a PR. On merge, update the status to `Accepted` (or `Rejected`, in which case keep the file for the record).

## Planned v0 ADRs

Per [ARCHITECTURE.md §13](../ARCHITECTURE.md):

- **ADR-001** — Choice of Anthropic API over multi-provider abstraction.
- **ADR-002** — Synchronous categorization endpoint over queue-based processing for v0.
- **ADR-003** — pgvector over a dedicated vector store.
- **ADR-004** — Separate `corrections` table over an updates column on `transactions`.
- **ADR-005** — Haiku-primary, Sonnet-fallback model selection over single-model.
- **ADR-006** — Synthetic eval businesses over real anonymized data.
