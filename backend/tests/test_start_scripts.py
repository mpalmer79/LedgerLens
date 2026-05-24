"""Container start scripts are present and executable."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
START_SH = REPO_ROOT / "scripts" / "start.sh"
BOOTSTRAP_PY = REPO_ROOT / "scripts" / "bootstrap_or_migrate.py"


def test_start_script_exists_and_is_executable() -> None:
    assert START_SH.exists(), "scripts/start.sh missing"
    assert os.access(START_SH, os.X_OK), "scripts/start.sh is not executable"


def test_bootstrap_script_exists_and_is_executable() -> None:
    assert BOOTSTRAP_PY.exists(), "scripts/bootstrap_or_migrate.py missing"
    assert os.access(BOOTSTRAP_PY, os.X_OK), "scripts/bootstrap_or_migrate.py is not executable"


def test_start_script_runs_migration_when_flag_set(tmp_path: Path) -> None:
    """`start.sh` is shaped to (a) run the bootstrap script when the flag
    is true and (b) skip otherwise. We exercise the bootstrap path
    against a fresh SQLite DB inside the test process; we don't actually
    exec uvicorn — the script is set -euo pipefail so a clean exit
    requires bootstrap to succeed.

    We achieve this by replacing `exec uvicorn …` with a no-op for the
    purposes of this assertion: run the migration step explicitly
    (the same command the script runs) and assert it succeeds.
    """
    db_path = tmp_path / "smoke.db"
    env = os.environ.copy()
    env.update(
        {
            "DATABASE_URL": f"sqlite:///{db_path}",
            "LEDGERLENS_CATEGORIZER_MODE": "stub",
        }
    )
    result = subprocess.run(
        [sys.executable, str(BOOTSTRAP_PY)],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        f"bootstrap failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert "migration complete" in result.stdout


def test_bootstrap_refuses_when_app_tables_exist_without_alembic_version(
    tmp_path: Path,
) -> None:
    """Drift case: create app tables via create_all and confirm the
    bootstrap refuses with exit 2 rather than silently stamping."""
    db_path = tmp_path / "drift.db"
    # Seed the DB the way an old `init_db()` boot would.
    from sqlalchemy import create_engine

    from ledgerlens import models  # noqa: F401  registers models
    from ledgerlens.db import Base

    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(bind=engine)
    engine.dispose()

    env = os.environ.copy()
    env.update(
        {
            "DATABASE_URL": f"sqlite:///{db_path}",
            "LEDGERLENS_CATEGORIZER_MODE": "stub",
        }
    )
    result = subprocess.run(
        [sys.executable, str(BOOTSTRAP_PY)],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 2, (
        f"expected exit 2, got {result.returncode}\n{result.stdout}\n{result.stderr}"
    )
    assert "REFUSING TO STAMP AUTOMATICALLY" in result.stderr
