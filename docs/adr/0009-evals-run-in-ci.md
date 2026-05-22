# ADR-0009: Run evals in CI, not in the production API

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

LedgerLens evals have three properties that make them awkward to run from the production backend:

1. **They are slow.** A full v0 run is 5-10 minutes wall clock (302 transactions × ~1-2 seconds per Anthropic call). Future datasets will be larger.
2. **They produce committed artifacts.** Per [ADR-0004](0004-eval-harness-architecture.md), each run writes a JSON file to `evals/runs/` that must be committed for the accuracy trajectory.
3. **They consume budget.** Approximately $0.68 per v0 run on Haiku.

Running them inside the production FastAPI backend would mix concerns: eval workload competing with serving traffic, eval secrets alongside production secrets, JSON artifacts landing in ephemeral Railway storage rather than git.

Railway's Hobby plan also provides no container-shell access, so an interactive trigger from inside the backend container is not possible without building a custom admin HTTP endpoint — which itself would be bounded by Railway/Cloudflare HTTP timeouts well under the eval duration.

A separate, intentional execution surface is needed.

## Decision

Evals run as a manually-triggered GitHub Actions workflow at `.github/workflows/eval.yml`. The workflow:

1. Checks out the repo, sets up Python 3.12, installs the backend package.
2. Executes `python -m ledgerlens.evals.run` with `dataset` and `categorizer` chosen from workflow inputs.
3. Commits the resulting JSON file from `evals/runs/` back to `main` via a `github-actions[bot]` commit.
4. Uploads the artifact as a downloadable workflow artifact (90-day retention) for cases where the user wants the file without pulling.

`ANTHROPIC_API_KEY` is stored as a GitHub repository secret and injected into the workflow at run time only. Triggering is manual (`workflow_dispatch`) for three reasons: cost control, baseline gate-keeping, and avoiding bot-commit loops that automatic triggers would create.

## Consequences

- **Clean separation between production and CI.** Railway hosts the API; GitHub Actions hosts the evaluation infrastructure. Neither leaks into the other.
- **No Railway shell required.** The user, who has no local terminal access, can trigger and monitor runs entirely from the GitHub UI.
- **Auditable and reproducible.** Every run has a GitHub Actions run ID, a commit SHA, and a JSON artifact. Three diffable artifacts per run.
- **Manual triggering only, for now.** No scheduled cadence yet. Easy to add later by appending a `schedule:` trigger to the workflow.
- **Requires a secret to be configured.** The user has to add `ANTHROPIC_API_KEY` once via GitHub Settings; documented in the PR introducing the workflow.

## Alternatives considered

- **Add a `POST /admin/evals/run` endpoint to the backend.** Rejected: Railway / Cloudflare HTTP timeouts run under one minute, well below the eval duration. Would require fire-and-forget background execution with status polling — a lot of moving parts for what GitHub Actions provides built-in.
- **Use a Railway cron job.** Rejected: artifact persistence requires escaping ephemeral container storage, then a separate path back to git. More moving parts than the CI approach.
- **Upgrade Railway plan to get shell access.** Rejected: cost not justified, and shell-driven runs would not produce the auditable history that workflow-driven runs do.
- **Run evals from a local developer terminal.** Rejected: the user has no local terminal access.
