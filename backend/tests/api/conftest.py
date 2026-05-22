"""Per-test isolated SQLite database via the FastAPI dependency override."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from ledgerlens.db import Base, get_db
from ledgerlens.main import app
from ledgerlens.seed import seed_chart_of_accounts


@pytest.fixture
def db_session() -> Iterator[Session]:
    # StaticPool shares a single connection so :memory: SQLite is the same
    # database across sessions. Without it, the QueuePool hands out fresh
    # connections, each with its own (empty) in-memory database.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    session = SessionLocal()
    seed_chart_of_accounts(session)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    def _override() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.pop(get_db, None)
