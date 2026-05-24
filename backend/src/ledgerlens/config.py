from functools import lru_cache
from json import JSONDecodeError, loads
from typing import Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

CategorizerMode = Literal["demo_stub", "anthropic"]
SUPPORTED_CATEGORIZER_MODES: tuple[str, ...] = ("demo_stub", "anthropic")


def _parse_cors_origins(value: str) -> list[str]:
    """Parse a `CORS_ORIGINS` env value into a list of origins.

    Accepts three shapes — in order of how a Railway operator is most
    likely to set the variable:

    1. Single origin: `https://example.com`
    2. Comma-separated: `https://example.com,http://localhost:3000`
    3. JSON array: `["https://example.com"]`

    Whitespace is stripped, empty entries are dropped. Malformed JSON
    arrays raise `ValueError` with a clear message so a typo doesn't
    silently pass through as a one-element list.
    """
    raw = value.strip()
    if not raw:
        return []
    if raw.startswith("["):
        try:
            parsed = loads(raw)
        except JSONDecodeError as exc:
            raise ValueError(
                f"CORS_ORIGINS looks like a JSON array but does not parse: {exc.msg}"
            ) from exc
        if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
            raise ValueError(
                "CORS_ORIGINS must be a single origin, a comma-separated list, "
                "or a JSON array of strings."
            )
        return [item.strip() for item in parsed if item.strip()]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


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
    # Stored as the raw env string. `cors_origins_list` parses it.
    # Typing this as a plain `str` (not `list[str]`) avoids
    # pydantic-settings' built-in `json.loads()` coercion that would
    # reject anything that isn't a JSON array — including the
    # one-origin string Railway operators reach for first.
    cors_origins: str = "http://localhost:3000"
    app_version: str = "0.2.0"

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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _coerce_cors_origins_input(cls, value: Any) -> Any:
        """Accept a list (legacy callers) or a string. Always store a string.

        A `Settings(cors_origins=["a", "b"])` call coming from a test or
        a Python caller is preserved by re-joining with commas; anything
        else passes through and gets validated by `_parse_cors_origins`
        at read time.
        """
        if isinstance(value, list):
            return ",".join(str(v).strip() for v in value if str(v).strip())
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        """Parsed list of CORS origins. Validates the raw env string."""
        return _parse_cors_origins(self.cors_origins)

    @property
    def anthropic_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def is_demo_mode(self) -> bool:
        return self.categorizer_mode == "demo_stub"


@lru_cache
def get_settings() -> Settings:
    return Settings()
