# LedgerLens frontend.
# Single-stage Node 20 image. Build context = repo root (set in railway.toml
# at the repo root). All COPY directives are relative to the repo root.
#
# Pinned to node:20.19-slim because Vite 8 (pulled in via vitest 4) declares
# `@types/node ^20.19.0 || >=22.12.0` as a peer dependency. The unpinned
# `node:20-slim` tag worked in practice but made the floor invisible.

FROM node:20.19-slim AS runtime

WORKDIR /app

# Copy lockfile and package.json first for layer caching.
COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci

# Build-time public env vars. NEXT_PUBLIC_* vars in Next.js are inlined into
# the static JS bundle at build time, so they must be present in the build
# container's environment when `next build` runs. Railway forwards service
# variables whose names match declared ARGs into the Docker build, so simply
# declaring NEXT_PUBLIC_API_BASE_URL as an ARG and promoting it to ENV is
# sufficient. See ADR-0007.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

# Copy the frontend source into /app.
COPY frontend/ ./

# Copy eval artifacts into a sibling /evals/ directory. The build-time eval
# loader (frontend/src/lib/evals.ts) walks up from process.cwd() = /app
# looking for an "evals" directory at any ancestor, so /evals/ resolves on
# the first iteration. See ADR-0011 for the build-time-loading decision.
COPY evals/runs /evals/runs
COPY evals/datasets /evals/datasets

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
