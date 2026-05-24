"""Tests for the consolidated sensitive-data redactor."""

from __future__ import annotations

from ledgerlens.services.sensitive_data import (
    FORBIDDEN_KEYS,
    redact_account_number_like,
    redact_card_like,
    redact_ein,
    redact_email,
    redact_forbidden_keys,
    redact_phone,
    redact_pii_text,
    redact_ssn,
)


def test_redact_email_basic() -> None:
    out = redact_email("contact alice@example.com for details")
    assert "alice@example.com" not in out
    assert "[redacted-email]" in out


def test_redact_phone_with_separators_only() -> None:
    # 3-3-4 with dashes should redact.
    out = redact_phone("call 415-555-0102")
    assert "[redacted-phone]" in out
    # A bare 10-digit account number should NOT match phone (the
    # account scrubber handles it).
    out2 = redact_phone("acct 1234567890")
    assert "[redacted-phone]" not in out2


def test_redact_card_like() -> None:
    out = redact_card_like("card 4111-1111-1111-1111 charged")
    assert "4111" not in out
    assert "[redacted-card]" in out


def test_redact_account_number_like_long_digits() -> None:
    out = redact_account_number_like("routing 021000021 acct 1234567890")
    assert "1234567890" not in out
    assert "[redacted-account]" in out


def test_redact_ssn_dashed_form() -> None:
    out = redact_ssn("ssn 123-45-6789 on file")
    assert "123-45-6789" not in out
    assert "[redacted-ssn]" in out


def test_redact_ein_dashed_form() -> None:
    out = redact_ein("EIN 12-3456789 for the business")
    assert "12-3456789" not in out
    assert "[redacted-ein]" in out


def test_redact_pii_text_truncates() -> None:
    s = "x" * 200
    out = redact_pii_text(s, max_len=50)
    assert len(out) == 50
    assert out.endswith("…")


def test_redact_pii_text_handles_none() -> None:
    assert redact_pii_text(None) == "None"


def test_redact_pii_text_collapses_control_chars() -> None:
    out = redact_pii_text("line1\nline2\tline3\x00", max_len=80)
    assert "\n" not in out
    assert "\t" not in out
    assert "\x00" not in out


def test_redact_pii_text_combines_scrubs() -> None:
    raw = "ach debit alice@bank.com (415) 555-0102 acct 1234567890 ssn 123-45-6789"
    out = redact_pii_text(raw, max_len=200)
    assert "alice@bank.com" not in out
    assert "415" not in out  # phone scrubbed
    assert "1234567890" not in out  # account scrubbed
    assert "123-45-6789" not in out  # ssn scrubbed


def test_forbidden_keys_includes_known_high_risk_keys() -> None:
    for key in (
        "raw_csv",
        "raw_row",
        "account_number",
        "routing_number",
        "card_number",
        "password",
        "api_key",
        "ssn",
        "tax_id",
    ):
        assert key in FORBIDDEN_KEYS


def test_redact_forbidden_keys_drops_dict_keys() -> None:
    before = {"keep": "ok", "api_key": "sk-XXXX", "raw_csv": "header,row"}
    after = redact_forbidden_keys(before)
    assert after == {"keep": "ok"}


def test_redact_forbidden_keys_walks_nested_dicts() -> None:
    before = {
        "outer": {"inner": "ok", "password": "hunter2"},
        "list": [{"row_data": "secret", "keep": True}],
    }
    after = redact_forbidden_keys(before)
    assert after == {"outer": {"inner": "ok"}, "list": [{"keep": True}]}


def test_redact_forbidden_keys_does_not_mutate_input() -> None:
    before: dict[str, object] = {"api_key": "abc", "keep": 1}
    snapshot = dict(before)
    redact_forbidden_keys(before)
    assert before == snapshot
