#!/usr/bin/env bash
# LedgerLens backend container entrypoint.
#
# When RUN_MIGRATIONS_ON_START=true, runs the safe bootstrap/migrate
# script before exec'ing uvicorn. Migration failure is treated as a
# fatal startup error (the script exits non-zero, the container
# crashes, Railway surfaces the failure rather than serving a stale /
# broken process).
set -euo pipefail

echo "[start] LedgerLens backend container starting"
echo "[start] PORT=${PORT:-8000}"
echo "[start] RUN_MIGRATIONS_ON_START=${RUN_MIGRATIONS_ON_START:-false}"
echo "[start] CATEGORIZER_MODE=${CATEGORIZER_MODE:-demo_stub}"

if [[ "${RUN_MIGRATIONS_ON_START:-false}" == "true" ]]; then
    echo "[start] running migration / bootstrap"
    python "$(dirname "$0")/bootstrap_or_migrate.py"
    echo "[start] migration / bootstrap finished"
else
    echo "[start] RUN_MIGRATIONS_ON_START is not 'true' — skipping migration"
    echo "[start]   (set RUN_MIGRATIONS_ON_START=true on Railway to enable)"
fi

echo "[start] exec uvicorn"
exec uvicorn ledgerlens.main:app --host 0.0.0.0 --port "${PORT:-8000}"
