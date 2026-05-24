import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ledgerlens.api import (
    admin,
    audit,
    categories,
    categorize,
    corrections,
    demo,
    handoff,
    health,
    ledger,
    mapping,
    review,
    rules,
    transactions,
)
from ledgerlens.config import get_settings
from ledgerlens.db import _get_sessionmaker, init_db
from ledgerlens.observability import RequestIdMiddleware, configure_logging
from ledgerlens.seed import seed_chart_of_accounts, seed_demo_tenant

configure_logging()
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
            seed_demo_tenant(session)
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

    # Request-ID middleware first so request_id is bound for the CORS
    # preflight responses too.
    application.add_middleware(RequestIdMiddleware)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
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
    application.include_router(admin.router)
    application.include_router(mapping.router)

    return application


app = create_app()
