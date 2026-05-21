# ADR-0002: Deployment topology

**Status:** Accepted
**Date:** 2026-05-21
**Deciders:** Michael Palmer

## Context

LedgerLens is developed entirely through Claude Code (in a remote sandbox) and the GitHub web UI. There is no local development environment. This means there is no way to verify that a change actually runs, beyond unit tests, unless the change is deployed somewhere reachable.

The project needs a deployment target that is cheap, requires no per-machine tooling, deploys on git push, and can host a FastAPI backend, a Next.js frontend, and a Postgres database with pgvector. Candidates considered: Railway, Vercel (frontend) + Railway (backend + Postgres), Fly.io, and Render.

A secondary constraint is operational surface. This is a portfolio-scale project run by one person. Splitting the deployment across two platforms doubles the dashboards, billing accounts, secret stores, and failure modes that need to be tracked. The single-platform goal outweighs per-component optimization.

## Decision

All services run on Railway, in a single Railway project:

- **Backend** — FastAPI service, Nixpacks builder, root directory `backend/`, start command from `backend/railway.toml`.
- **Frontend** — Next.js service, Nixpacks builder, root directory `frontend/`, start command from `frontend/railway.toml`.
- **Postgres** — Railway add-on attached to the project. `DATABASE_URL` is injected into the backend via Railway's variable references; it never appears in a committed file.

The frontend reaches the backend over the public Railway URL (`NEXT_PUBLIC_API_BASE_URL`), not Railway's private network. v0 has no latency or cost pressure that justifies the configuration overhead of private networking; revisit if that changes.

No Dockerfiles. Nixpacks auto-detects FastAPI via `Procfile` and Next.js via `package.json` scripts; per-service `railway.toml` files make the start command and health-check path explicit. One environment (production) per service. Railway PR environments are available but not enabled in this session.

## Consequences

- One dashboard, one bill, one set of credentials.
- Deploys are git-driven — Railway watches the repo and rebuilds on push to main.
- Secrets and connection strings live in the Railway UI, never in git.
- Database backups and Postgres version upgrades are Railway's responsibility.
- Platform lock-in: migration means rewriting `railway.toml` files and reattaching the database.
- Public URLs for service-to-service traffic add a small latency tax and expose the backend to the open internet, mitigated by the CORS allowlist.
- No preview-per-PR until Railway PR environments are configured (deferred).

## Alternatives considered

- **Vercel for frontend + Railway for backend and Postgres** — rejected: splits the deployment across two platforms, contradicting the single-platform goal. The real loss is Vercel's per-PR previews; Railway PR environments are an acceptable substitute when needed.
- **Fly.io** — rejected: more powerful (regions, machines, volumes) and more configuration surface than warranted at portfolio scope. Worth revisiting if scale or geography becomes a real concern.
- **Render** — rejected: comparable feature set to Railway with no compelling differentiator. Railway's Postgres add-on provisioning is slightly cleaner, and the project only needs one of these.
