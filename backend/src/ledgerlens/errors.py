"""Application-level errors with structured HTTP responses."""

from fastapi import HTTPException


class MissingProviderConfig(HTTPException):
    """Raised when a route needs a provider credential that isn't configured.

    Returns a 503 with a user-readable explanation rather than letting the
    underlying SDK raise an opaque authentication error.
    """

    def __init__(self, provider: str, env_var: str) -> None:
        super().__init__(
            status_code=503,
            detail={
                "error": "missing_provider_config",
                "provider": provider,
                "env_var": env_var,
                "message": (
                    f"{provider} credential is not configured. "
                    f"Set {env_var} to enable this endpoint."
                ),
            },
        )


class NotFound(HTTPException):
    def __init__(self, resource: str, identifier: str) -> None:
        super().__init__(
            status_code=404,
            detail={
                "error": "not_found",
                "resource": resource,
                "identifier": identifier,
            },
        )


class ValidationFailed(HTTPException):
    def __init__(self, message: str, **extra: object) -> None:
        super().__init__(
            status_code=422,
            detail={"error": "validation_failed", "message": message, **extra},
        )
