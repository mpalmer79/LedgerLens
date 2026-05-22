"""Transaction description normalization.

Deterministic and testable — no model calls. Produces a `normalized_description`
suitable as a lookup key for correction memory in a future iteration and a
best-effort `merchant` extraction.
"""

import re

# Common bank-statement prefixes and noise.
_PREFIX_PATTERNS = [
    r"^TST\*\s*",
    r"^SQ\s*\*\s*",
    r"^SP\s+",
    r"^POS\s+",
    r"^PURCHASE\s+",
    r"^DEBIT\s+CARD\s+PURCHASE\s+",
    r"^CHECKCARD\s+",
    r"^ACH\s+",
    r"^WEB\s+",
    r"^TRANSFER\s+",
    r"^WIRE\s+",
    r"^DIRECT\s+DEP\s+",
]

# Tail noise — store IDs, location codes, transaction references.
_TAIL_PATTERNS = [
    r"\s+\d{5,}\s*$",
    r"\s+#\d+\s*$",
    r"\s+[A-Z]{2}\s+\d{5}\s*$",  # state + zip
    r"\s+REF\s*:?\s*\S+\s*$",
    r"\s+ID\s*:?\s*\S+\s*$",
]

_WHITESPACE = re.compile(r"\s+")


def normalize_description(raw: str) -> str:
    """Strip common bank-statement noise from a description.

    Idempotent: `normalize(normalize(s)) == normalize(s)`.
    Conservative: only strips patterns whose removal is unambiguous.
    """
    s = raw.strip().upper()
    for pat in _PREFIX_PATTERNS:
        s = re.sub(pat, "", s, count=1)
    for pat in _TAIL_PATTERNS:
        s = re.sub(pat, "", s, count=1)
    s = _WHITESPACE.sub(" ", s).strip()
    return s


def extract_merchant(normalized: str) -> str | None:
    """Best-effort merchant extraction from a normalized description.

    Returns up to the first significant noun-like token cluster, capped at
    a reasonable length. Returns None if nothing meaningful remains.
    """
    if not normalized:
        return None
    # Drop trailing words that look like states or all-caps city codes.
    tokens = normalized.split(" ")
    while tokens and len(tokens[-1]) <= 2:
        tokens.pop()
    if not tokens:
        return None
    candidate = " ".join(tokens[:3]).strip()
    return candidate[:64] or None
