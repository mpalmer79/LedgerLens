# ADR-0004: Eval harness architecture

**Status:** Accepted
**Date:** 2026-05-21
**Deciders:** Michael Palmer

## Context

ARCHITECTURE §7 specifies that the eval harness is a first-class system component, with merge gating tied to its output. The harness must exist before any categorizer is written, so the categorizer can be tuned against a stable evaluation surface rather than against itself.

Three design questions are in front of us: how the categorizer interfaces to the harness (abstract base class, Protocol, or duck typing); where run artifacts live (JSON files in the repo, a database, or a separate runs server); and whether the harness is synchronous or async given that the real categorizer will make LLM calls.

Constraints: the project is portfolio-scale (one person), develops via Claude Code + GitHub web (no local environment), and ships v0 before any deferred infrastructure. Whatever this session picks has to be reviewable on github.com and replaceable later without rewriting working code.

## Decision

**The categorizer is a `typing.Protocol`.** Any class with the right shape — `name: str` and `categorize(transaction, business, chart_of_accounts) -> CategorizationResult` — is a Categorizer. Test stubs and real implementations share no inheritance. The stub in this session and the real categorizer in the next both satisfy the Protocol; neither imports the other.

**Run artifacts are JSON files committed to `evals/runs/`.** One file per run, named `YYYY-MM-DD-<categorizer_name>.json`, containing run metadata, metrics for overall / non-adversarial / adversarial slices, and the complete per-transaction prediction list. Reviewable in GitHub's diff viewer and grep-able from any checkout.

**The harness is synchronous for v0.** The stub is synchronous, the first real categorizer is expected to make one LLM call per transaction, and parallelism is not required to get to a baseline. The harness refactors to async when the real categorizer benefits from concurrent calls; the Protocol does not lock either choice.

## Consequences

- **Protocol enables clean test stubs.** No inheritance, no shared base; mypy enforces the contract structurally.
- **Committed runs give a visible accuracy trajectory.** `git log evals/runs/` shows when accuracy moved.
- **Run files grow.** At ~120 KB per run, the repo absorbs hundreds before it matters. Past that, a separate runs store is warranted.
- **Synchronous harness will need refactoring.** When the real categorizer adds concurrent LLM calls, the harness changes to `asyncio`. The Protocol does not need to change; only the iteration loop.
- **JSON is not the world's most efficient format.** For v0's volume, the difference is invisible.

## Alternatives considered

- **Abstract base class instead of Protocol.** Rejected: inheritance couples test stubs to production code, and ABCs would drag real-categorizer dependencies (SDK clients, retry logic) into the test surface. Protocol is the modern Python idiom for this contract.
- **SQLite for run artifacts.** Rejected: not reviewable on github.com, harder to share. A future ADR may add SQLite as a *secondary* index keyed off the JSON files if run volume justifies it.
- **Async-first harness.** Rejected as premature. v0 has no concurrency requirement; async is added when it benefits the real categorizer, not before.
