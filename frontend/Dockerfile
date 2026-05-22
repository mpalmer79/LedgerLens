# LedgerLens frontend.
# Single-stage Node 20 image. Standard Next.js build → start.

FROM node:20-slim AS runtime

WORKDIR /app

# Copy lockfile and package.json first for layer caching.
COPY package.json package-lock.json /app/

RUN npm ci

# Now copy the rest and build.
COPY . /app
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "npm start -- -p ${PORT:-3000}"]
