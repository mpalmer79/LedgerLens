"""CORS_ORIGINS parsing — Railway-survivable shapes only.

The incident: pydantic-settings coerced `cors_origins: list[str]` via
`json.loads()` before any validator ran, so the single-origin string
`CORS_ORIGINS=https://x` crashed startup. The hotfix stores the raw
env value as a string and parses it lazily via `cors_origins_list`.

These tests pin every shape an operator might reach for.
"""

from __future__ import annotations

import pytest

from ledgerlens.config import Settings, _parse_cors_origins

# ── _parse_cors_origins pure helper ──────────────────────────────────


def test_parses_single_origin_string() -> None:
    assert _parse_cors_origins("https://ledgerlens.up.railway.app") == [
        "https://ledgerlens.up.railway.app"
    ]


def test_parses_comma_separated_string_with_whitespace() -> None:
    out = _parse_cors_origins("https://ledgerlens.up.railway.app, http://localhost:3000 , ")
    assert out == ["https://ledgerlens.up.railway.app", "http://localhost:3000"]


def test_parses_json_array_string() -> None:
    assert _parse_cors_origins('["https://x.com", "http://y.com"]') == [
        "https://x.com",
        "http://y.com",
    ]


def test_parses_empty_string_to_empty_list() -> None:
    assert _parse_cors_origins("") == []
    assert _parse_cors_origins("   ") == []


def test_malformed_json_array_raises_clear_value_error() -> None:
    with pytest.raises(ValueError, match="JSON array"):
        _parse_cors_origins("[not json")
    with pytest.raises(ValueError, match="JSON array"):
        _parse_cors_origins("[123, 456]")


# ── Settings end-to-end (env-shape regression) ───────────────────────


def test_settings_boots_with_raw_single_origin_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The exact env value Railway operators reach for first."""
    monkeypatch.setenv("CORS_ORIGINS", "https://ledgerlens.up.railway.app")
    settings = Settings()
    assert settings.cors_origins_list == ["https://ledgerlens.up.railway.app"]


def test_settings_boots_with_json_array_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The shape we documented before the hotfix — still has to work."""
    monkeypatch.setenv("CORS_ORIGINS", '["https://x.com"]')
    settings = Settings()
    assert settings.cors_origins_list == ["https://x.com"]


def test_settings_boots_with_comma_separated_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://x.com,http://localhost:3000")
    settings = Settings()
    assert settings.cors_origins_list == [
        "https://x.com",
        "http://localhost:3000",
    ]


def test_settings_with_list_argument_still_parses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Programmatic callers (tests, scripts) sometimes pass a list directly."""
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    settings = Settings(cors_origins=["https://a", "https://b"])
    assert settings.cors_origins_list == ["https://a", "https://b"]


def test_settings_malformed_cors_array_surfaces_at_read_time(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Malformed JSON in CORS_ORIGINS shouldn't crash startup; it
    surfaces when the property is read. This gives `/health` and
    `/ready` a chance to come up so the operator can see what's
    wrong."""
    monkeypatch.setenv("CORS_ORIGINS", "[bogus")
    settings = Settings()
    with pytest.raises(ValueError, match="JSON array"):
        _ = settings.cors_origins_list
