"""Safe Alembic bootstrap / migrate entry point.

Called from `scripts/start.sh` when `RUN_MIGRATIONS_ON_START=true`.
The decision tree is:

1. `alembic_version` table exists  →  run `alembic upgrade head`.
   Already-stamped DB; standard forward-migration path.

2. `alembic_version` missing AND no app tables  →  run `alembic upgrade head`.
   Fresh database; the baseline migration creates everything from scratch.

3. `alembic_version` missing AND app tables present  →  EXIT 2 with a
   clear message. The DB was populated by an earlier
   `Base.metadata.create_all()` boot and is now drifting from the
   migration history. Refuse to guess; require manual repair.

In case (3) the operator chooses between:

- **Stamp**: `alembic stamp head` — declare the live schema matches
  the head revision. Safe only if every column / enum / index in the
  live schema actually matches HEAD. **Use only if you have
  verified column-by-column compatibility.**

- **Reset**: drop the database and let migrations run from scratch.
  Safe for the public demo because demo data is fictional. Documented
  in `docs/PUBLIC_DEMO_RELIABILITY.md`.

This script never stamps automatically. Silent stamping has bitten
every team that's tried it.
"""

from __future__ import annotations

import sys
from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command
from ledgerlens import models  # noqa: F401  registers models with Base.metadata
from ledgerlens.config import get_settings
from ledgerlens.db import Base

# Tables that are part of the application schema. Excludes
# `alembic_version` and any future audit/log tables we'd treat
# specially.
_APP_TABLE_NAMES: frozenset[str] = frozenset(Base.metadata.tables.keys())


def _alembic_config() -> Config:
    ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    if not ini_path.exists():
        print(f"[bootstrap] alembic.ini not found at {ini_path}", file=sys.stderr)
        sys.exit(2)
    cfg = Config(str(ini_path))
    # env.py reads the URL from get_settings(); keep alembic.ini's
    # placeholder in place.
    return cfg


def _existing_table_names(database_url: str) -> set[str]:
    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        return set(inspector.get_table_names())
    finally:
        engine.dispose()


def main() -> int:
    settings = get_settings()
    url = settings.database_url
    if not url:
        print(
            "[bootstrap] DATABASE_URL is empty; nothing to bootstrap. "
            "The app will start with the in-memory SQLite default.",
            file=sys.stderr,
        )
        return 0

    print(f"[bootstrap] inspecting database (driver={url.split('://', 1)[0]})")
    try:
        existing = _existing_table_names(url)
    except Exception as exc:  # noqa: BLE001 — bail loudly with the class
        print(
            f"[bootstrap] could not inspect database: {type(exc).__name__}",
            file=sys.stderr,
        )
        return 2

    has_alembic_version = "alembic_version" in existing
    app_tables_present = bool(_APP_TABLE_NAMES & existing)

    print(
        "[bootstrap] alembic_version="
        f"{'present' if has_alembic_version else 'missing'}; "
        f"app_tables={'present' if app_tables_present else 'absent'}"
    )

    if has_alembic_version:
        print("[bootstrap] running: alembic upgrade head")
        command.upgrade(_alembic_config(), "head")
        print("[bootstrap] migration complete")
        return 0

    if not app_tables_present:
        print(
            "[bootstrap] fresh database — running: alembic upgrade head (baseline + every revision)"
        )
        command.upgrade(_alembic_config(), "head")
        print("[bootstrap] migration complete")
        return 0

    # Case 3: app tables exist but alembic_version is missing.
    print(
        "[bootstrap] REFUSING TO STAMP AUTOMATICALLY.\n"
        "[bootstrap] App tables exist but the alembic_version table is missing.\n"
        "[bootstrap] This usually means the DB was created by an older boot that\n"
        "[bootstrap] used Base.metadata.create_all() instead of Alembic.\n"
        "[bootstrap]\n"
        "[bootstrap] Choose one (operator decision — never silent):\n"
        "[bootstrap]\n"
        "[bootstrap]   A. RESET (recommended for the public demo, data is fictional):\n"
        "[bootstrap]      Drop the Postgres DB on Railway, redeploy. The next boot\n"
        "[bootstrap]      will hit the 'fresh database' path above.\n"
        "[bootstrap]\n"
        "[bootstrap]   B. STAMP (only if you have verified column-by-column that\n"
        "[bootstrap]      the live schema matches the head revision):\n"
        "[bootstrap]      Run `alembic stamp head` once against the live DB, then\n"
        "[bootstrap]      redeploy. Subsequent boots will hit the upgrade path.\n"
        "[bootstrap]\n"
        "[bootstrap] See docs/PUBLIC_DEMO_RELIABILITY.md for the full procedure.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
