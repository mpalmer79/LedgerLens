# LedgerLens backend.
# Single-stage Python 3.12 image. Source is copied before pip install
# so setuptools can find the src/ledgerlens/ package layout.

FROM python:3.12-slim AS runtime

# System deps: build-essential for any source-built wheels (psycopg, etc.)
# libpq-dev for psycopg's binary build, then aggressive cleanup.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source first, then install. This is the inverse of Nixpacks'
# default order and is the whole reason we switched to a Dockerfile.
COPY pyproject.toml /app/pyproject.toml
COPY src /app/src

RUN pip install --upgrade pip build setuptools \
    && pip install .

# Copy the rest (tests, evals, alembic, scripts) — useful if eval CLI
# is invoked from the running container; required for the start script
# and the Alembic migration baseline.
COPY . /app

RUN chmod +x /app/scripts/start.sh /app/scripts/bootstrap_or_migrate.py

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Railway injects $PORT at runtime. The start script handles optional
# migration via RUN_MIGRATIONS_ON_START before exec'ing uvicorn.
CMD ["/app/scripts/start.sh"]
