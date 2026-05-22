from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings.

    Provider-specific credentials (Anthropic) and the database URL default to
    empty strings so the app can start without them. Routes that need a real
    value are responsible for raising a clear configuration error (see
    `ledgerlens.errors.MissingProviderConfig`) rather than crashing the process.

    This is a deliberate trade — process-startup robustness is more valuable
    than fail-fast crashes on missing config, because the health and readiness
    endpoints need to work in environments where credentials are partial or
    not yet provisioned.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str = ""
    anthropic_model_primary: str = "claude-haiku-4-5-20251001"
    anthropic_model_fallback: str = "claude-sonnet-4-6"

    # Empty default → an in-memory SQLite database. Use `sqlite:///./ledgerlens.db`
    # for a local file, or a `postgresql+psycopg://...` URL for Postgres.
    database_url: str = "sqlite:///:memory:"

    ledgerlens_auto_queue_threshold: float = 0.90
    ledgerlens_review_queue_threshold: float = 0.60
    ledgerlens_retrieval_top_k: int = 5

    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]
    app_version: str = "0.2.0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def anthropic_configured(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
