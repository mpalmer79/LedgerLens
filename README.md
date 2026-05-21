# LedgerLens

> AI-assisted transaction categorization for bookkeepers. Calibrated confidence, human-in-the-loop review, learns from corrections.

**Status:** Pre-implementation scaffolding. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design intent.

## What this is

LedgerLens categorizes bank and credit-card transactions against a per-business chart of accounts. Each decision carries a calibrated confidence score and a short reasoning trace; low-confidence and ambiguous decisions route to a human review queue, and corrections feed back as retrieval signal for future categorizations. It is a focused assistive tool for bookkeepers — not a general ledger, tax-filing, or payroll system.

## Stack

- Backend: FastAPI, Python 3.12, Postgres + pgvector, SQLAlchemy, Alembic
- Frontend: Next.js 14, TypeScript, Tailwind CSS
- AI: Anthropic Claude (Haiku primary, Sonnet fallback)
- Evals: Pytest-based harness with versioned test sets

## Repository layout

```
backend/   FastAPI application source and tests
frontend/  Next.js 14 + TypeScript review UI
evals/     Versioned test sets, harness, and run outputs
docs/      Architecture spec and ADRs
scripts/   Operational and developer scripts
```

## Getting started

### Prerequisites

- TODO: pin Python and Node versions once `backend/pyproject.toml` and `frontend/package.json` are finalized.
- TODO: document Postgres + pgvector setup (local Docker vs. hosted).

### Backend setup

- TODO: virtualenv creation, dependency install, env file, database migration, and run command.

### Frontend setup

- TODO: dependency install, env file, and dev server command.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design and rationale
- [ADRs](docs/adr/) — architecture decision records

## License

MIT. See [LICENSE](LICENSE).
