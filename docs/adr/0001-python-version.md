# ADR-0001: Python version requirement

**Status:** Accepted
**Date:** 2026-05-21
**Deciders:** Michael Palmer

## Context

LedgerLens has no local development environment. All work happens in the Claude Code sandbox and on GitHub. This makes the sandbox's installed interpreters the operative constraint, not a per-developer machine.

The session 2 precondition check observed the following in the sandbox:

- `python3` → 3.11.15 (default on `PATH`)
- `python3.12` → 3.12.3 (available)
- `python3.13` → 3.13.12 (available)
- `uv` 0.8.17 available as a fallback installer

Python 3.12 is therefore genuinely available; the 3.11 default on `PATH` is incidental, not a ceiling. The trade-off is between targeting 3.12 (gaining PEP 695 `type` aliases, improved generic syntax, better error messages, and lower long-term migration cost since 3.11 hits end-of-life in October 2027) versus relaxing to 3.11 to match the default interpreter (slightly simpler invocation, no new language constructs to enforce in review).

## Decision

We require Python 3.12+ for the backend. CI pins to `3.12` exactly via `actions/setup-python@v5`. `backend/pyproject.toml` sets `requires-python = ">=3.12"`, ruff `target-version = "py312"`, and mypy `python_version = "3.12"`.

## Consequences

### Positive
- PEP 695 type syntax and other 3.12 improvements are available without backporting.
- One pinned interpreter across `pyproject.toml`, ruff, mypy, and CI — no version skew.
- Longer runway before another EOL-driven upgrade.

### Negative
- Contributors who invoke `python3` directly in the sandbox get 3.11 and will see install failures on `pip install -e ".[dev]"`. Must use `python3.12` explicitly or `uv venv --python 3.12`.

### Neutral
- CI is the enforcement boundary; local-version drift is caught on PR, not at commit time.

## Alternatives considered

- **Relax to Python 3.11** — rejected: 3.12 is available, and matching the sandbox default would forfeit real ergonomic gains for cosmetic convenience.
- **Target 3.13** — rejected: 3.13 is too new for confident dependency support (notably pinned wheels for `psycopg[binary]` and ML-adjacent tooling), and the marginal feature gain over 3.12 doesn't justify the compatibility risk.
