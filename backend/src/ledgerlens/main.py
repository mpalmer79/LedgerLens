from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ledgerlens.config import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title="LedgerLens API", version=settings.app_version)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "ledgerlens-api"}

    return application


app = create_app()
