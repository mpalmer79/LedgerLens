from functools import lru_cache
from typing import Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

CategorizerMode = Literal["demo_stub", "anthropic"]
SUPPORTED_CATEGORIZER_MODES: tuple[str, ...] = ("demo_stub", "anthropic")


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

    `categorizer_mode` controls the fallback layer of the categorize pipeline:

    - `demo_stub` (default) — portfolio-safe. Never imports or calls Anthropic.
      Unmatched transactions are routed to human review by a zero-cost stub.
    - `anthropic` — uses the real Anthropic model. Requires
      `ANTHROPIC_API_KEY` to be set; the categorize endpoint returns a
      structured 503 if the key is missing.
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

    # Fallback-layer mode. Demo-safe by default; opt-in to Anthropic.
    categorizer_mode: CategorizerMode = "demo_stub"

    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]
    app_version: str = "0.2.0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("categorizer_mode", mode="before")
    @classmethod
    def _normalize_categorizer_mode(cls, value: Any) -> Any:
        if value is None or value == "":
            return "demo_stub"
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized not in SUPPORTED_CATEGORIZER_MODES:
                raise ValueError(
                    f"CATEGORIZER_MODE must be one of {SUPPORTED_CATEGORIZER_MODES!r}, "
                    f"got {value!r}"
                )
            return normalized
        return value

    @property
    def anthropic_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def is_demo_mode(self) -> bool:
        return self.categorizer_mode == "demo_stub"


@lru_cache
def get_settings() -> Settings:
    return Settings()
