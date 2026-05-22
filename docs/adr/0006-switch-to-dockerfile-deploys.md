# ADR-0006: Switch from Nixpacks to Dockerfile builds

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

[ADR-0002](0002-deployment-topology.md) chose Nixpacks for both Railway services in v0, with an explicit revisit trigger: "custom system packages, image size, or build optimization." The intent was to defer the cost of owning a Dockerfile until it was actually justified.

In practice, the trigger fired sideways. Nixpacks's auto-generated build sequences turned out to be incompatible with our monorepo's package layouts in ways that are not configurable from `railway.toml` alone:

1. **Backend.** Nixpacks's Python provider copies `pyproject.toml` first, runs `pip install .`, then copies source. Our `src/ledgerlens/` layout means setuptools cannot find the package at install time. The predecessor session added `backend/nixpacks.toml` to override the install phase — which worked, but only because we bypassed Nixpacks's default Python flow.
2. **Frontend.** Nixpacks's Node provider runs `npm ci` twice — once during its setup phase, once during install — using a cache mount on `/root/.npm` that conflicts with the second run, producing a non-deterministic build failure.

Three successive Nixpacks patches have produced new Nixpacks-specific errors each time. Every patch has fought Nixpacks's defaults, not fixed anything wrong with the application code. The dependency on Nixpacks's correctness for our exact layouts is the actual constraint, and that constraint is unstable.

## Decision

Both services switch to Dockerfile-based deploys on Railway:

- **Backend:** `python:3.12-slim`, single-stage. Source is copied before `pip install`, eliminating the layout problem at the root. System deps (`build-essential`, `libpq-dev`) installed explicitly. `CMD` runs uvicorn against `$PORT`.
- **Frontend:** `node:20-slim`, single-stage. Standard `npm ci → npm run build → npm start`, no cache mounts to collide with.
- `railway.toml` on both services declares `builder = "DOCKERFILE"`, `dockerfilePath = "Dockerfile"`. Health checks and restart policy unchanged.
- `backend/nixpacks.toml` and `backend/Procfile` are deleted. Nixpacks is no longer a build path.

Single-stage images for now. Multi-stage optimization is deferred until image size becomes a real concern.

## Consequences

- **Deterministic build sequences.** Every line in the Dockerfile is explicit; failures are debugged by reading the Dockerfile rather than reverse-engineering Nixpacks.
- **What goes into the image is visible in one file.** Nixpacks's behavior was implicit and version-dependent.
- **We own the base image.** Security updates to `python:3.12-slim` and `node:20-slim` are our responsibility on Railway redeploy. Mitigated by auto-redeploy on git push and by Docker Hub's image patching.
- **Slightly larger images.** Stock slim images plus our additions are tens of megabytes larger than Nixpacks's optimized output; cost is irrelevant at v0 traffic.
- **~50 lines of Dockerfile added.** A bounded maintenance surface.
- **Deployment time is similar.** Railway treats Dockerfile and Nixpacks builds equivalently downstream.

## Alternatives considered

- **Keep patching Nixpacks.** Rejected: three failed attempts is enough signal that the fight is not going to end, and each patch makes the build harder to reason about.
- **Multi-stage Dockerfile for image-size optimization.** Rejected as premature for v0. Single-stage ships now; multi-stage is a follow-up if image-size becomes a measurable cost.
- **Move off Railway entirely.** Rejected: Railway itself is not the problem — its Nixpacks integration is. Dockerfile deploys are first-class on Railway.

## Supersedes

The "no Dockerfile in v0" provision of [ADR-0002](0002-deployment-topology.md). All other decisions in ADR-0002 (all services on Railway, Postgres as add-on, public-URL service-to-service traffic, no PR environments for v0) remain unchanged.
