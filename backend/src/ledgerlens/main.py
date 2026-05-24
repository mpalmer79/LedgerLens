import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ledgerlens.api import (
    audit,
    categories,
    categorize,
    corrections,
    demo,
    handoff,
    health,
    ledger,
    review,
    rules,
    transactions,
)
from ledgerlens.config import get_settings
from ledgerlens.db import _get_sessionmaker, init_db
from ledgerlens.seed import seed_chart_of_accounts

logger = logging.getLogger("ledgerlens.startup")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create tables and seed the demo chart of accounts on startup.

    `init_db()` is idempotent (uses `CREATE TABLE IF NOT EXISTS`). Seeding is
    also idempotent via upsert. Failures are **logged** (not silently
    swallowed) and the process is allowed to continue starting — `/health`
    still works and `/ready` surfaces the real database state. This pattern
    is intentional for the demo deploy: a transient DB reachability problem
    should not prevent the process from coming up to serve `/health`.
    """
    try:
        init_db()
        with _get_sessionmaker()() as session:
            seed_chart_of_accounts(session)
    except Exception:  # noqa: BLE001 — log-and-continue; /ready surfaces real state
        logger.exception(
            "startup: init_db / seed_chart_of_accounts failed; "
            "process will continue. Inspect /ready for the database error class."
        )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="LedgerLens API",
        version=settings.app_version,
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health.router)
    application.include_router(categories.router)
    application.include_router(transactions.router)
    application.include_router(categorize.router)
    application.include_router(review.router)
    application.include_router(ledger.router)
    application.include_router(audit.router)
    application.include_router(corrections.router)
    application.include_router(corrections.memory_match_router)
    application.include_router(rules.router)
    application.include_router(rules.rule_match_router)
    application.include_router(demo.router)
    application.include_router(handoff.router)

    return application


app = create_app()
