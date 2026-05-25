"""Vendor normalization and merchant fingerprinting.

Deterministic, zero-cost utilities for reducing noisy bank-statement
descriptions to stable vendor identifiers. These identifiers feed
correction-memory lookups and deterministic rule matching — they never
overwrite the raw transaction description stored in the database.

Design rules:

1. **Normalize for matching, not display.** The output is a lookup key,
   not a human-readable label. The raw description is always preserved.
2. **Conservative by default.** When in doubt, return the cleaned
   description rather than guessing a vendor identity.
3. **No model calls.** Everything is regex + dict lookup. Zero cost,
   deterministic, testable.
4. **Ambiguous vendors stay ambiguous.** Amazon, Costco, Home Depot
   sell both business and personal goods — the normalizer identifies
   the vendor but does NOT resolve the category.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ── Payment-noise prefixes ────────────────────────────────────────────
# These appear on bank statements before the actual merchant name.
# Order matters: longer patterns first so they match before shorter ones.

_PAYMENT_NOISE_PREFIXES: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"^DEBIT\s+CARD\s+PURCHASE\s+",
        r"^ELECTRONIC\s+PAYMENT\s+",
        r"^ONLINE\s+PAYMENT\s+",
        r"^DIRECT\s+DEBIT\s+",
        r"^DIRECT\s+DEP(?:OSIT)?\s+",
        r"^RECURRING\s+PAYMENT\s+",
        r"^AUTO\s+PAY\s+",
        r"^AUTOPAY\s+",
        r"^BILL\s+PAYMENT\s+",
        r"^CHECKCARD\s+",
        r"^PURCHASE\s+",
        r"^POS\s+(?:PURCHASE\s+)?",
        r"^ACH\s+(?:DEBIT|CREDIT|PAYMENT|PMT)?\s*",
        r"^WIRE\s+(?:TRANSFER\s+)?",
        r"^TRANSFER\s+(?:TO|FROM)\s+",
        r"^TRANSFER\s+",
        r"^WEB\s+",
        r"^TST\s*\*\s*",
        r"^SQ\s*\*\s*",
        r"^SP\s+",
    ]
]

# ── Tail noise (transaction IDs, store numbers, auth codes, dates) ────

_TAIL_NOISE: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\s+AUTH(?:ORIZATION)?\s*(?:CODE)?\s*#?\s*\w+\s*$",
        r"\s+TRACE\s*#?\s*\d+\s*$",
        r"\s+REF\s*:?\s*\S+\s*$",
        r"\s+ID\s*:?\s*\S+\s*$",
        r"\s+CONF(?:IRMATION)?\s*#?\s*\S+\s*$",
        r"\s+\d{2}/\d{2}(?:/\d{2,4})?\s*$",
        r"\s+\d{4}-\d{2}-\d{2}\s*$",
        r"\s+STORE\s*#?\s*\d+\s*$",
        r"\s+STR\s*#?\s*\d+\s*$",
        r"\s+LOC(?:ATION)?\s*#?\s*\d+\s*$",
        r"\s+#\d+\s*$",
        r"\s+\d{6,}\s*$",
        r"\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$",
    ]
]

# ── Vendor family patterns ────────────────────────────────────────────
# Maps a regex to a canonical vendor family name. Used by
# `detect_vendor_family` to roll up noisy variants into a stable key.

_VENDOR_FAMILIES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(p, re.IGNORECASE), name)
    for p, name in [
        (r"AMAZON|AMZN|AMZ\b", "AMAZON"),
        (r"HOME\s*DEPOT|HD\s+SUPPLY", "HOME_DEPOT"),
        (r"COSTCO", "COSTCO"),
        (r"WAL\s*MART|WM\s+SUPERCENTER", "WALMART"),
        (r"NAPA\s*(?:AUTO)?\s*(?:PARTS)?", "NAPA"),
        (r"AUTOZONE", "AUTOZONE"),
        (r"O'?REILLY\s+AUTO", "OREILLY_AUTO"),
        (r"ADVANCE\s+AUTO", "ADVANCE_AUTO"),
        (r"LKQ\b", "LKQ"),
        (r"CARQUEST", "CARQUEST"),
        (r"TIRE\s*RACK", "TIRERACK"),
        (r"ADP\b|AUTOMATIC\s+DATA", "ADP"),
        (r"INTUIT|QUICKBOOKS|QB\s", "INTUIT"),
        (r"ADOBE", "ADOBE"),
        (r"MICROSOFT|MSFT\b", "MICROSOFT"),
        (r"GOOGLE\b", "GOOGLE"),
        (r"STRIPE", "STRIPE"),
        (r"SQUARE|SQ\s*\*|GOSQ\b", "SQUARE"),
        (r"PAYPAL", "PAYPAL"),
        (r"SHELL\s+(?:OIL|GAS|STATION)", "SHELL"),
        (r"EXXON|EXXONMOBIL|MOBIL\b", "EXXON"),
        (r"CHEVRON", "CHEVRON"),
        (r"\bBP\b(?:\s+(?:GAS|STATION))?", "BP"),
        (r"SUNOCO", "SUNOCO"),
        (r"CUMBERLAND\s+FARMS", "CUMBERLAND_FARMS"),
        (r"IRVING\b", "IRVING"),
        (r"UBER\s+EATS", "UBER_EATS"),
        (r"UBER\b", "UBER"),
        (r"LYFT", "LYFT"),
        (r"STARBUCKS", "STARBUCKS"),
        (r"DUNKIN", "DUNKIN"),
        (r"DELTA\s+AIR", "DELTA_AIRLINES"),
        (r"UNITED\s+AIR", "UNITED_AIRLINES"),
        (r"SOUTHWEST\s+AIR", "SOUTHWEST_AIRLINES"),
        (r"EVERSOURCE", "EVERSOURCE"),
        (r"COMCAST|XFINITY", "COMCAST"),
        (r"VERIZON", "VERIZON"),
        (r"AT\s*&\s*T\b", "ATT"),
        (r"T-?MOBILE", "TMOBILE"),
        (r"WASTE\s+MANAGEMENT", "WASTE_MANAGEMENT"),
        (r"STATE\s+FARM", "STATE_FARM"),
        (r"GEICO", "GEICO"),
        (r"PROGRESSIVE\s+INS", "PROGRESSIVE"),
        (r"HANOVER\s+INS", "HANOVER_INSURANCE"),
        (r"CONCORD\s+GROUP", "CONCORD_GROUP_INS"),
        (r"STAPLES", "STAPLES"),
        (r"OFFICE\s+DEPOT|OFFICEMAX", "OFFICE_DEPOT"),
        (r"LOWES|LOWE'?S", "LOWES"),
        (r"MENARDS", "MENARDS"),
    ]
]

_WHITESPACE_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^A-Z0-9 ]")


# ── Public API ────────────────────────────────────────────────────────


def strip_payment_noise(text: str) -> str:
    """Remove payment-method prefixes and trailing transaction IDs."""
    s = text.strip()
    for pat in _PAYMENT_NOISE_PREFIXES:
        s = pat.sub("", s, count=1).lstrip()
    for pat in _TAIL_NOISE:
        s = pat.sub("", s).rstrip()
    s = _WHITESPACE_RE.sub(" ", s).strip()
    return s


def normalize_merchant_name(raw: str) -> str:
    """Normalize a merchant name or description to a stable lookup key.

    Steps:
    1. Uppercase
    2. Strip payment-method noise
    3. Remove non-alphanumeric chars (except spaces)
    4. Collapse whitespace

    The result is suitable for correction-memory and rule-matching
    lookups. It is NOT stored over the raw description.
    """
    s = raw.strip().upper()
    s = strip_payment_noise(s)
    s = _NON_ALNUM_RE.sub(" ", s)
    s = _WHITESPACE_RE.sub(" ", s).strip()
    return s


def merchant_fingerprint(description: str, merchant: str | None = None) -> str:
    """Produce a short, stable fingerprint for vendor matching.

    If a merchant is supplied, normalize it. Otherwise normalize the
    full description. Either way, the result is uppercased, noise-
    stripped, and safe for use as a dict key or DB lookup.
    """
    source = merchant if merchant else description
    return normalize_merchant_name(source)


@dataclass(frozen=True)
class VendorMatch:
    """Result of a vendor-family detection."""

    family: str
    confidence: float
    raw_match: str


def detect_vendor_family(text: str) -> VendorMatch | None:
    """Identify which vendor family a description belongs to, if any.

    Returns the first matching family with a confidence score. Families
    are ordered so that more-specific patterns (e.g. UBER_EATS) match
    before less-specific ones (UBER).

    Returns None when no known family matches — the caller should treat
    the vendor as unrecognized rather than guessing.
    """
    upper = text.upper()
    for pat, family in _VENDOR_FAMILIES:
        m = pat.search(upper)
        if m:
            return VendorMatch(
                family=family,
                confidence=0.9,
                raw_match=m.group(),
            )
    return None


# ── Ambiguous vendors ─────────────────────────────────────────────────
# Vendors whose category depends on what was purchased, not who the
# vendor is. These should route to review unless the owner has already
# answered the question for a specific purchase.

AMBIGUOUS_VENDORS: frozenset[str] = frozenset(
    {
        "AMAZON",
        "COSTCO",
        "WALMART",
        "HOME_DEPOT",
        "LOWES",
        "TARGET",
    }
)


def is_ambiguous_vendor(family: str | None) -> bool:
    """True if this vendor family requires owner context to categorize."""
    return family is not None and family in AMBIGUOUS_VENDORS
