from functools import lru_cache
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str
    anthropic_model_primary: str = "claude-haiku-4-5-20251001"
    anthropic_model_fallback: str = "claude-sonnet-4-6"

    database_url: str

    ledgerlens_auto_queue_threshold: float = 0.90
    ledgerlens_review_queue_threshold: float = 0.60
    ledgerlens_retrieval_top_k: int = 5

    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:3000"]
    app_version: str = "0.1.0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
