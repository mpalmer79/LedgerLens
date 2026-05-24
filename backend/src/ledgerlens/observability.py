"""Structured logging + request-ID + redaction.

These utilities give the backend two foundations the production
roadmap needs:

1. A `request_id` we can plumb through every log line so a single
   request is traceable end-to-end. The middleware accepts an inbound
   `X-Request-ID` header (so a proxy or browser can supply one) and
   falls back to a generated UUID.
2. A small, opinionated redaction helper used by error paths that
   touch transaction text. The rule of thumb: never log a raw bank
   description.

This is deliberately not OpenTelemetry, not a logging vendor, not a
PII pipeline. It is the minimum viable foundation a future production
deploy can build on without re-architecting.
"""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# A request-scoped context var — log records can pull request_id from
# here when the formatter or the call site asks for it.
_request_id_ctx: ContextVar[str | None] = ContextVar("ledgerlens_request_id", default=None)


def get_request_id() -> str | None:
    """Return the request_id bound to the current request, if any."""
    return _request_id_ctx.get()


def set_request_id(value: str | None) -> None:
    """Bind a request_id to the current request context."""
    _request_id_ctx.set(value)


_REQUEST_ID_HEADER = "x-request-id"
# Bound to keep the field defensible if a client supplies one.
_REQUEST_ID_MAX_LEN = 128
_REQUEST_ID_SAFE_RE = re.compile(r"^[A-Za-z0-9._\-]{1,128}$")


def _normalize_request_id(raw: str | None) -> str:
    """Return a safe request_id.

    Inbound IDs must be short (<=128 chars) and made of `[A-Za-z0-9._-]`.
    Anything else is dropped and we generate a new one. This keeps a
    misbehaving client from injecting newlines or shell metacharacters
    into our logs.
    """
    if raw is not None:
        candidate = raw.strip()
        if candidate and _REQUEST_ID_SAFE_RE.match(candidate):
            return candidate
    return uuid.uuid4().hex


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a request_id to every request and echo it in the response.

    The id is also bound to a context var so other code (loggers,
    redaction helpers) can pick it up without threading it through
    every function signature.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Any,
    ) -> Response:
        rid = _normalize_request_id(request.headers.get(_REQUEST_ID_HEADER))
        token = _request_id_ctx.set(rid)
        request.state.request_id = rid
        try:
            response: Response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)
        response.headers["X-Request-ID"] = rid
        return response


# ── Redaction helpers ───────────────────────────────────────────────────
# These now delegate to ledgerlens.services.sensitive_data, the single
# source of truth for "do not store/log this verbatim." The names are
# kept here for back-compat with the many call sites that import from
# observability.

from ledgerlens.services.sensitive_data import (  # noqa: E402
    redact_account_number_like,
    redact_card_like,
    redact_email,
    redact_phone,
    redact_pii_text as sanitize_for_log,
)

__all_redactors__ = (
    "redact_account_number_like",
    "redact_card_like",
    "redact_email",
    "redact_phone",
    "sanitize_for_log",
)


# ── Structured logging foundation ───────────────────────────────────────


class RequestIdFilter(logging.Filter):
    """Inject `request_id` into every LogRecord.

    The default value is `-` so format strings can include `%(request_id)s`
    safely even when there is no bound request (startup logs, scripts).
    """

    def filter(self, record: logging.LogRecord) -> bool:  # noqa: D401
        record.request_id = get_request_id() or "-"
        return True


_DEFAULT_FORMAT = "%(asctime)s %(levelname)s %(name)s [request_id=%(request_id)s] %(message)s"


def configure_logging(level: int = logging.INFO) -> None:
    """Apply a small structured-logging baseline to the root logger.

    Idempotent — safe to call from app startup and from tests."""
    root = logging.getLogger()
    root.setLevel(level)
    # Only configure once; further calls are no-ops.
    if any(getattr(h, "_ledgerlens_request_id_handler", False) for h in root.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(_DEFAULT_FORMAT))
    handler.addFilter(RequestIdFilter())
    # Mark so the idempotency check above can find it.
    handler._ledgerlens_request_id_handler = True  # type: ignore[attr-defined]
    root.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    """Get a logger that emits the structured baseline."""
    return logging.getLogger(name)
