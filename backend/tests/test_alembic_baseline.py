"""Alembic baseline integrity tests.

The migration baseline must:
1. Exist (alembic.ini + alembic/env.py + one revision).
2. Apply cleanly to an empty SQLite database.
3. Produce the same schema `Base.metadata.create_all` would.

`create_all` remains the demo-mode bootstrap, but the migration is
the production path; keeping the two in sync is the contract this
file enforces.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from ledgerlens import models  # noqa: F401  registers models with Base.metadata
from ledgerlens.db import Base

REPO_ROOT = Path(__file__).resolve().parent.parent
ALEMBIC_INI = REPO_ROOT / "alembic.ini"
VERSIONS_DIR = REPO_ROOT / "alembic" / "versions"


def test_alembic_config_files_exist() -> None:
    assert ALEMBIC_INI.exists(), "alembic.ini missing"
    assert (REPO_ROOT / "alembic" / "env.py").exists(), "alembic/env.py missing"
    assert (REPO_ROOT / "alembic" / "script.py.mako").exists(), "script template missing"


def test_at_least_one_baseline_migration_exists() -> None:
    revisions = [p for p in VERSIONS_DIR.glob("*.py") if not p.name.startswith("__")]
    assert revisions, "no alembic revisions present"


def test_alembic_upgrade_head_applies_cleanly(tmp_path: Path) -> None:
    """Running `alembic upgrade head` against a fresh SQLite DB succeeds
    and yields the same tables `create_all` would."""
    db_path = tmp_path / "alembic_test.db"
    env = {
        "PATH": "/usr/bin:/bin",
        "DATABASE_URL": f"sqlite:///{db_path}",
        # Settings doesn't need an Anthropic key in stub mode; pin it
        # explicitly so the lru_cache in get_settings() resolves.
        "LEDGERLENS_CATEGORIZER_MODE": "stub",
    }
    # Inherit the test interpreter's prefix so alembic + ledgerlens resolve.
    env["PATH"] = f"{Path(sys.executable).parent}:{env['PATH']}"

    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        pytest.fail(
            f"alembic upgrade head failed:\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )

    # The migration-built DB has every table create_all would have.
    engine = create_engine(f"sqlite:///{db_path}")
    inspector = inspect(engine)
    migrated_tables = set(inspector.get_table_names()) - {"alembic_version"}
    expected_tables = set(Base.metadata.tables.keys())
    missing = expected_tables - migrated_tables
    extra = migrated_tables - expected_tables
    assert not missing, f"migration missed tables: {sorted(missing)}"
    assert not extra, f"migration created extra tables: {sorted(extra)}"
