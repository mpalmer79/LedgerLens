# ADR-0011: Build-time eval artifact loading

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

The eval harness ([ADR-0004](0004-eval-harness-architecture.md)) writes one JSON file per run. The GitHub Actions workflow ([ADR-0009](0009-evals-run-in-ci.md)) auto-commits those files to `evals/runs/`. The data is therefore versioned, public, and immutable from any consumer's point of view.

The dashboard at `/evals` needs to render this data. Three patterns are available:

1. **Build-time loading.** Next.js server components read `evals/runs/*.json` from the filesystem during `npm run build` and embed the data into the statically-rendered HTML.
2. **Runtime fetch.** The dashboard calls a backend HTTP endpoint (e.g. `GET /evals/latest`) on each request.
3. **Manual snapshot.** A developer copies eval values into a constants file on each release.

The constraints: the dashboard is the project's highest-value portfolio page; it must render instantly without spinners; it must be obvious that the data is real (not faked); and it must auto-update when a new run lands without manual intervention.

## Decision

Build-time loading via Node's `fs` and `path` modules inside a server component. `frontend/src/lib/evals.ts` walks up from `process.cwd()` looking for `evals/runs/`, picks the most recent claude-haiku JSON, and exports typed accessors (`loadLatestEvalRun`, `loadStubBaseline`, `summarizePerBusiness`, `adversarialDeepDive`) consumed by `frontend/src/app/evals/page.tsx`.

When the eval workflow commits a new run, the same commit triggers Railway's auto-redeploy, which rebuilds the frontend and re-reads the JSON. The dashboard's "freshness" is therefore bounded by deploy time, which is on the order of minutes, not by any data plumbing.

The dashboard cross-references predictions against the dataset JSONs (also at build time) to recover ground-truth and `is_adversarial` flags that the run artifact does not duplicate. This keeps run files compact without making the dashboard dependent on a backend service.

## Consequences

- **Instant render, no spinner.** The dashboard is statically-rendered HTML. There is no API call, no loading state, no race condition between data fetch and chart mount.
- **No runtime coupling.** The frontend depends on the contents of `evals/runs/`, not on a running backend. The dashboard works if the API is down.
- **Auditable by design.** The committed JSON is the source of truth. Anyone can `git log evals/runs/` to see the accuracy trajectory and verify each rendered number against the artifact it came from.
- **Stale until next rebuild.** A new run that hasn't redeployed yet won't appear on the dashboard. Acceptable: eval runs are rare and explicit, and the same commit that adds the JSON also triggers the deploy.
- **Build needs repo-relative access to `evals/`.** Works in `npm run build` from `frontend/` (walks up one level) and in `npm run dev`. Resolved on Railway by session 10a: the frontend service's build context was widened to the repo root and `evals/runs/` + `evals/datasets/` are copied into the build container alongside `frontend/`, so the loader's walk-up resolves to `/evals/` inside the image. See the [session 10a PR](https://github.com/mpalmer79/LedgerLens/pulls?q=session-10a) for the Dockerfile and root `railway.toml` changes.

## Alternatives considered

- **Backend endpoint `GET /evals/latest`.** Rejected: adds runtime coupling for static data, requires CORS, introduces a loading state, breaks when the backend has any problem.
- **Manual snapshot in a constants file.** Rejected: defeats the auto-commit workflow, introduces drift, removes the audit trail.
- **Separate eval-dashboard microservice.** Rejected: massive overkill for one page that reads JSON files.
