"""Request ID middleware + redaction utility."""

from __future__ import annotations

from fastapi.testclient import TestClient

from ledgerlens.observability import (
    redact_account_number_like,
    redact_card_like,
    redact_email,
    redact_phone,
    sanitize_for_log,
)

# ── Request-ID middleware ─────────────────────────────────────────────


def test_response_carries_request_id_header(client: TestClient) -> None:
    """Every API response carries an X-Request-ID header."""
    res = client.get("/health")
    assert res.status_code == 200
    rid = res.headers.get("X-Request-ID")
    assert rid is not None
    assert len(rid) >= 8


def test_request_id_is_unique_across_requests(client: TestClient) -> None:
    a = client.get("/health").headers["X-Request-ID"]
    b = client.get("/health").headers["X-Request-ID"]
    assert a != b


def test_supplied_request_id_is_preserved(client: TestClient) -> None:
    res = client.get("/health", headers={"X-Request-ID": "test-trace-001"})
    assert res.headers["X-Request-ID"] == "test-trace-001"


def test_malformed_request_id_is_replaced(client: TestClient) -> None:
    """A request ID with shell metacharacters / newlines is dropped."""
    res = client.get("/health", headers={"X-Request-ID": "bad\ninjected"})
    assert res.headers["X-Request-ID"] != "bad\ninjected"
    assert "\n" not in res.headers["X-Request-ID"]


# ── Redaction helpers ─────────────────────────────────────────────────


def test_redact_email_strips_common_addresses() -> None:
    assert redact_email("contact alice@example.com today").startswith("contact [redacted-email]")
    # Multiple addresses are all replaced.
    out = redact_email("a@b.co and c@d.io")
    assert "@" not in out


def test_redact_phone_strips_us_formats() -> None:
    assert "[redacted-phone]" in redact_phone("call (415) 555-0102 now")
    assert "[redacted-phone]" in redact_phone("415-555-0102")
    assert "[redacted-phone]" in redact_phone("+1 415.555.0102")


def test_redact_account_number_like_handles_long_runs() -> None:
    assert "[redacted-account]" in redact_account_number_like("acct 123456789")
    assert "[redacted-account]" in redact_account_number_like("acct 1234567890123")
    # A short id is left alone.
    assert "12345" in redact_account_number_like("ref 12345")


def test_redact_card_like_handles_grouped_digits() -> None:
    assert "[redacted-card]" in redact_card_like("card 4111 1111 1111 1111")
    assert "[redacted-card]" in redact_card_like("card 4111-1111-1111-1111")


def test_sanitize_for_log_combines_helpers_and_truncates() -> None:
    raw = (
        "ACH DEBIT alice@bank.com (415) 555-0102 acct 1234567890 "
        "extra extra extra extra extra extra extra extra extra extra"
    )
    out = sanitize_for_log(raw, max_len=80)
    assert len(out) <= 80
    assert "@" not in out
    assert "[redacted-email]" in out
    assert "[redacted-phone]" in out
    assert "[redacted-account]" in out


def test_sanitize_for_log_strips_newlines_and_control_chars() -> None:
    out = sanitize_for_log("first\nsecond\ttab\x00null", max_len=80)
    assert "\n" not in out
    assert "\t" not in out
    assert "\x00" not in out


def test_sanitize_for_log_handles_none() -> None:
    assert sanitize_for_log(None) == "None"
