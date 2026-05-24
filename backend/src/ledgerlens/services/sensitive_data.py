"""Sensitive-data redaction utilities (single source of truth).

LedgerLens already shipped two redactors in earlier sprints:

- ``observability.sanitize_for_log`` — free-text scrubbing for log lines
  (emails, phones, card-like runs, long digit groups, control chars).
- ``services.audit_log._redact`` — JSON-tree key denylist that drops
  keys (``raw_csv``, ``api_key``, etc.) before they hit the audit table.

This module consolidates them into one home so the rest of the codebase
has a single import path for "do not store this verbatim." The legacy
modules now re-export from here for backwards compatibility.

Scope of the v1 redactor:

- Emails (RFC-5322-ish)
- Phone numbers (NANP + a few international variants)
- Card-like digit groups (13–19 digits, optional dashes/spaces)
- Long contiguous digit runs (≥9 digits — bank/account numbers)
- US Social Security Numbers (``###-##-####`` / ``#########``)
- ITIN (US individual taxpayer id, ``9##-##-####``)
- EIN (US employer id, ``##-#######``)
- Control characters (collapsed to spaces)

Out of scope (deliberately): names, addresses, vendor strings. Those
are user-visible content the demo intentionally surfaces in the UI; the
right place to redact those is at the **input boundary** (CSV import
rejection) when real-bank-data support lands, not here.

This redactor is **not** a regulatory-grade PII scrubber. It is the
honest, deterministic floor below which we never log or persist data.
The README and docs say so explicitly.
"""

from __future__ import annotations

import re
from typing import Any

# ── Free-text scrubbing patterns ────────────────────────────────────────

# RFC 5322-ish; intentionally loose. We bias toward catching emails over
# rejecting valid ones.
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# US-ish phones — require explicit 3-3-4 grouping with separators or parens
# so a 10-digit account number doesn't accidentally redact as a phone.
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d{1,2}[\s\-.])?\(?\d{3}\)?[\s\-.]\d{3}[\s\-.]\d{4}(?!\d)")
# Card numbers: 13–19 digits, optional dash/space separators.
_CARDISH_RE = re.compile(r"(?<!\d)(?:\d[ \-]?){13,19}(?!\d)")
# Generic long digit runs (account / routing / claim numbers).
_LONG_DIGITS_RE = re.compile(r"(?<!\d)\d{9,}(?!\d)")
# US SSN: ###-##-#### (with or without dashes). Match dashed form first
# so the all-digits scrubber doesn't see the inner digits.
_SSN_DASHED_RE = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
# US ITIN starts with 9 and has the same ###-##-#### shape; the dashed
# pattern above catches both. The all-digits form is caught by the
# generic long-digit scrubber.
# US EIN: ##-#######.
_EIN_RE = re.compile(r"(?<!\d)\d{2}-\d{7}(?!\d)")


def redact_email(s: str) -> str:
    return _EMAIL_RE.sub("[redacted-email]", s)


def redact_phone(s: str) -> str:
    return _PHONE_RE.sub("[redacted-phone]", s)


def redact_card_like(s: str) -> str:
    return _CARDISH_RE.sub("[redacted-card]", s)


def redact_account_number_like(s: str) -> str:
    return _LONG_DIGITS_RE.sub("[redacted-account]", s)


def redact_ssn(s: str) -> str:
    return _SSN_DASHED_RE.sub("[redacted-ssn]", s)


def redact_ein(s: str) -> str:
    return _EIN_RE.sub("[redacted-ein]", s)


def redact_pii_text(value: object, *, max_len: int = 80) -> str:
    """Render ``value`` as a single log-/storage-safe line.

    Applied scrubs (in order, since some patterns overlap):

    1. Emails
    2. SSN / EIN (dashed forms — exact patterns)
    3. Card-like digit groups
    4. Phone numbers
    5. Long digit runs (account / routing — catches all-digits SSN too)
    6. Control chars / newlines collapsed to a single space
    7. Truncate to ``max_len`` with a trailing ellipsis if needed

    Use this anywhere you would otherwise log a raw transaction
    description, owner-supplied note, vendor name, or other free-text
    field that came from outside the trust boundary.
    """
    if value is None:
        return "None"
    s = str(value)
    s = redact_email(s)
    s = redact_ssn(s)
    s = redact_ein(s)
    s = redact_card_like(s)
    s = redact_phone(s)
    s = redact_account_number_like(s)
    s = re.sub(r"[\r\n\t]+", " ", s)
    s = re.sub(r"[\x00-\x1f]+", " ", s)
    if len(s) > max_len:
        s = s[: max_len - 1] + "…"
    return s


# ── JSON-tree key denylist ─────────────────────────────────────────────

# Keys we never want to see end up in the audit JSON, even by accident.
# Each key is dropped before persistence; nested structures are walked
# recursively. Add an entry here when a new sensitive shape appears.
FORBIDDEN_KEYS: frozenset[str] = frozenset(
    {
        # Raw upload bodies and per-row CSV snapshots.
        "raw_csv",
        "raw_row",
        "raw_rows",
        "row_data",
        "csv_text",
        "transaction_description",
        # Banking identifiers.
        "account_number",
        "routing_number",
        "card_number",
        # Credentials and tokens.
        "credentials",
        "password",
        "secret",
        "api_key",
        "anthropic_api_key",
        "database_url",
        # PII we never need to retain in the audit trail.
        "ssn",
        "social_security_number",
        "ein",
        "tax_id",
    }
)


def redact_forbidden_keys(value: Any) -> Any:
    """Strip ``FORBIDDEN_KEYS`` from a JSON-shaped value.

    Dicts have matching keys removed; lists are walked element-wise;
    primitive values pass through unchanged. The transform is pure: it
    returns a new structure rather than mutating the input.
    """
    if isinstance(value, dict):
        return {k: redact_forbidden_keys(v) for k, v in value.items() if k not in FORBIDDEN_KEYS}
    if isinstance(value, list):
        return [redact_forbidden_keys(item) for item in value]
    return value


__all__ = [
    "FORBIDDEN_KEYS",
    "redact_account_number_like",
    "redact_card_like",
    "redact_ein",
    "redact_email",
    "redact_forbidden_keys",
    "redact_phone",
    "redact_pii_text",
    "redact_ssn",
]
