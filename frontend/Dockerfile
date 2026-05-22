# LedgerLens frontend.
# Single-stage Node 20 image. Standard Next.js build → start.

FROM node:20-slim AS runtime

WORKDIR /app

# Copy lockfile and package.json first for layer caching.
COPY package.json package-lock.json /app/

RUN npm ci

# Build-time public env vars. NEXT_PUBLIC_* vars in Next.js are inlined into
# the static JS bundle at build time, so they must be present in the build
# container's environment when `next build` runs. Railway forwards service
# variables whose names match declared ARGs into the Docker build, so simply
# declaring NEXT_PUBLIC_API_BASE_URL as an ARG and promoting it to ENV is
# sufficient. See ADR-0007.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

# Now copy the rest and build.
COPY . /app
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
