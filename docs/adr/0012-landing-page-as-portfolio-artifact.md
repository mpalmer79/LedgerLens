# ADR-0012: Landing page as portfolio artifact

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

LedgerLens lives at a public Railway URL. Anyone with the link — recruiter, hiring manager, future collaborator — sees whatever is at `/`. Through session 8 that was a debug card: "API base URL: ..." and a "Check API" button. It proved the design tokens were wired but did nothing to communicate what the project is, what it does, or why anyone reading should care.

The landing page is the highest-traffic surface in the project and the only one that converts a click into engagement. Leaving it as scaffolding is portfolio trash. The competing pressure: there's no marketing-team budget here, and the project's value is in its technical substance. A bloated marketing page would dilute that.

## Decision

`/` is rebuilt as a portfolio artifact in its own right, sized to fit the project's actual story:

- **Hero** with the project's tagline (*"Categorization you can trust. Calibration you can prove."*), a one-paragraph subhead naming the concrete differentiators, and two CTAs (eval results, architecture).
- **Live stat row** reading the latest committed eval JSON from `evals/runs/` at build time. Three stats: current baseline accuracy, dataset size, vertical count. Graceful fallback to a hardcoded stub baseline when the JSON isn't readable.
- **Three value pillars** matching the project's actual differentiators: calibrated-not-just-accurate, auditable-by-design, honest-about-failure-modes. Lucide icons keep the cards scannable.
- **Eval teaser callout** linking to `/evals` (the dashboard ships in the next session; the link 404s in the interim).
- **Live API health widget** preserved from the previous landing — the Check API button moves into a `"use client"` component so the rest of the page stays server-rendered.
- **Footer** with attribution to PalmerAI Solutions and quick links to the same destinations the nav covers.

Visual register matches the design system. No stock imagery, no animated marketing flourishes, no "About" boilerplate.

## Consequences

- **The live URL becomes a credible portfolio artifact.** Resume, LinkedIn, applications can link to it without embarrassment.
- **The page reads from `evals/runs/` at build time.** Once Railway redeploys after each merged eval run, the displayed accuracy is current. In the Docker image the `evals/` directory is not present (the frontend Dockerfile copies only `frontend/`), so the page falls back to the stub baseline constant — acceptable until a future PR plumbs eval data through the backend API.
- **`/evals` is referenced but doesn't exist yet.** Session 10 builds it. The CTA 404s in the interim. Worth the small UX cost vs. shipping the eval-dashboard work in the same PR.
- **`lucide-react` is now a runtime dependency.** Adds ~30 KB minified-and-tree-shaken to the bundle for the four icons used.
- **The page is build-time rendered.** Any change to the displayed accuracy requires a redeploy. Eval runs already trigger redeploys, so the lag is bounded by the deploy time, not by content staleness.

## Alternatives considered

- **Keep the debug card.** Rejected: the cost of doing nothing is every recruiter who clicks the live URL and sees scaffolding instead of a product.
- **Separate marketing site under its own domain.** Rejected: doubles the maintenance surface and splits the URL story, for content that fits on one page.
- **Brutalist "this is a portfolio project" meta page.** Rejected: cute but doesn't sell the work. The strongest portfolio move is the project doing what it claims to do.
- **Defer until the eval dashboard ships, then build both as one PR.** Rejected: two distinct surfaces deserve two distinct PRs; landing copy can be reviewed without dashboard work blocking it.
