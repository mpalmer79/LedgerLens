# Dependency update policy

## What happened

On 2026-05-25, Dependabot opened PRs bumping `tailwindcss` from
3.4.6 to 4.3.0 and `typescript` from 5.5.3 to 6.0.3. Both are
**major version** upgrades with breaking changes. They were merged
before CI ran, which broke the main branch build.

Tailwind CSS v4 moved its PostCSS plugin to a separate
`@tailwindcss/postcss` package, so the existing `postcss.config.js`
stopped working. The fix was reverting both to the versions the
codebase was tested against (PR #90).

## Policy

### Patch and minor updates (e.g. 3.4.6 → 3.4.7, 3.4.6 → 3.5.0)

- Dependabot opens PRs automatically.
- **Wait for CI to pass** before merging.
- If CI is green: merge.
- If CI fails: investigate, fix, or close the PR.

### Major updates (e.g. 3.x → 4.x, 5.x → 6.x)

- Dependabot is configured to **ignore** major bumps for critical
  dependencies (tailwindcss, typescript, react, react-dom).
- If a major upgrade is needed, open a manual PR with:
  1. The version bump
  2. Any migration changes (config files, API changes, type fixes)
  3. Full CI pass (tests, lint, build)
  4. A description of what changed and why

### Dependencies that require migration on major bump

| Package | Current | Migration notes |
|---|---|---|
| tailwindcss | 3.4.6 | v4 requires `@tailwindcss/postcss` + config migration |
| typescript | 5.5.3 | v6 may change type-checking behavior |
| react / react-dom | 19.x | Must match Next.js peer dependency |
| next | 16.x | Major bumps may change App Router behavior |

### Never auto-merge without CI

Even for patch/minor updates:

1. Wait for the CI status check (backend + frontend) to complete.
2. If CI is failing for unrelated reasons, fix CI first, then revisit
   the dependency PR.
3. Do not merge a dependency PR while CI is red.

### Rollback process

If a dependency bump breaks main:

1. Open a PR reverting the version in `package.json`.
2. Delete `package-lock.json` and run `npm install` to regenerate.
3. Verify tests, lint, and build pass.
4. Merge the revert PR.
5. Investigate the breaking change on a feature branch.

## Dependabot configuration

The `.github/dependabot.yml` file:

- Ignores major bumps for tailwindcss, typescript, react, react-dom
- Groups safe minor/patch updates together
- Keeps Next.js, React, and Vitest in separate groups
- Labels frontend PRs with `dependencies` + `frontend`
- Labels backend PRs with `dependencies` + `backend`

## Branch protection (recommended)

To prevent merging PRs before CI completes, enable branch protection
on `main` in GitHub Settings → Branches:

- Require status checks to pass before merging
- Required checks: "Backend (ruff, mypy, pytest)" + "Frontend (lint, test, build)"
- Do not allow bypassing required status checks

This is not currently enabled. Until it is, the policy relies on
human discipline: **always wait for the green check before merging.**
