# LedgerLens — Evals

Eval harness for LedgerLens categorization. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) §7 for the methodology and gating rules. The harness lives under [`backend/src/ledgerlens/evals/`](../backend/src/ledgerlens/evals/). Test sets live in [`datasets/`](datasets/) (one directory per version), run outputs land in [`runs/`](runs/) and are committed for the accuracy trajectory (per [ADR-0004](../docs/adr/0004-eval-harness-architecture.md)).

## Running evals

Evals run via the [Run eval](../../actions/workflows/eval.yml) GitHub Actions workflow. The workflow commits the resulting JSON artifact to `evals/runs/` and uploads it as a downloadable artifact (90-day retention). See [ADR-0009](../docs/adr/0009-evals-run-in-ci.md) for the rationale on running evals in CI rather than from the production backend.

To trigger a run: GitHub → **Actions** tab → **Run eval** → **Run workflow** → select dataset and categorizer → click the green **Run workflow** button. Each `claude-haiku-v1` run on `v0` costs approximately **$0.68** in Anthropic API charges and takes 5-10 minutes wall clock.

Prerequisite (one-time): `ANTHROPIC_API_KEY` must be set as a GitHub repository secret under Settings → Secrets and variables → Actions.

## Layout

```
evals/
├── README.md       (this file)
├── datasets/       versioned ground-truth datasets (v0, v1, ...)
└── runs/           committed run artifacts (one JSON per run)
```
