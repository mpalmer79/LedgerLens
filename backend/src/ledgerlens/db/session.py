"""SQLAlchemy engine, session, and base.

The engine is lazily created on first use so settings can be read once and
the app can still start without a database when only `/health` is needed.
"""

from collections.abc import Iterator
from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from ledgerlens.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    connect_args: dict[str, Any] = {}
    if settings.database_url.startswith("sqlite"):
        # check_same_thread=False so a session created on a worker thread can
        # be closed on the main thread; safe because we manage sessions per
        # request rather than sharing them.
        connect_args["check_same_thread"] = False
    return create_engine(settings.database_url, connect_args=connect_args, future=True)


@lru_cache
def _get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a session and closes it on exit."""
    session = _get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create all tables on the bound engine.

    For SQLite (the demo default) this is the equivalent of a migration —
    `Base.metadata.create_all` is good enough at v0 scale. For Postgres we'd
    move to Alembic migrations; the structure is ready for that without
    restructuring the models.
    """
    # Importing the models registers them with Base.metadata. This import is
    # local to avoid a circular dependency at module load.
    from ledgerlens import models  # noqa: F401

    Base.metadata.create_all(bind=get_engine())
