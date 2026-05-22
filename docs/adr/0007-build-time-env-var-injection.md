# ADR-0007: Inject NEXT_PUBLIC_* env vars at Docker build time

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

Next.js inlines `NEXT_PUBLIC_*` environment variables into the static client JavaScript bundle at *build* time, not runtime. Any reference to `process.env.NEXT_PUBLIC_FOO` in client code is replaced with the literal string value present at the moment `next build` executes. If the variable is not set during the build, the fallback expression is what ships to users.

After switching to Dockerfile-based deploys ([ADR-0006](0006-switch-to-dockerfile-deploys.md)), the deployed frontend silently rendered `"API base URL: unset"` in production. Root cause: Railway injects service-level env vars into the *running* container, not into the Docker *build* container, unless the Dockerfile declares a matching `ARG`. The previous `frontend/Dockerfile` did not, so `next build` ran with `NEXT_PUBLIC_API_BASE_URL` unset, the `?? "unset"` fallback in `page.tsx` fired, and the literal string `"unset"` was baked into the bundle. Setting the var in the Railway UI had no effect on what was actually shipped.

This is a Docker-build pattern that needs to be made explicit, not a one-time fix.

## Decision

All `NEXT_PUBLIC_*` environment variables consumed by the frontend are declared as `ARG` in `frontend/Dockerfile` and promoted to `ENV` *before* `RUN npm run build`:

```dockerfile
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
```

Railway automatically forwards service variables whose names match declared `ARG`s into the Docker build context, so no Railway-side configuration is needed beyond having the value set as a service variable (which it already is). New `NEXT_PUBLIC_*` vars added in the future follow the same two-line pattern, placed before the build step.

## Consequences

- **Build-time values are explicit and reviewable in the Dockerfile.** A reader can see exactly which variables affect the build by reading the file; no hidden Railway-side magic.
- **Portable to any container platform.** The same Dockerfile builds correctly on any platform that supports Docker build args; only the env-var injection mechanism differs.
- **Adding a new `NEXT_PUBLIC_*` var requires a Dockerfile edit.** Not just a Railway UI change. This is a small friction cost that buys explicitness — a worthwhile trade at v0.
- **Build cache is sensitive to ARG values.** Changing `NEXT_PUBLIC_API_BASE_URL` invalidates the build cache from the ARG declaration onward. That is the correct behavior; a different value should produce a different bundle.
- **The bundle is still build-time baked.** Changing a `NEXT_PUBLIC_*` value still requires a redeploy. This is a Next.js property, not something this ADR changes.

## Alternatives considered

- **Hard-code the URL in source.** Rejected: per-environment values (prod / staging / preview) become impossible to express in a single bundle.
- **Runtime config endpoint the client fetches on load.** Rejected: adds a network round-trip on every initial page load, complicates the static-export story, and trades a one-time build-arg edit for permanent runtime complexity.
- **`next.config.js` `env` block.** Rejected: it still reads from `process.env` at build time, so it solves nothing — the root problem is that the build container has no value to read.
