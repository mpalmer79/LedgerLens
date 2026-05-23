"""Deterministic rule-based categorizer.

A second deterministic layer in the categorization pipeline, sitting *after*
correction memory and *before* the model. Rules are loaded once from a JSON
file and validated against the active chart of accounts. A transaction is
categorized by the strongest matching rule, or routed to review if multiple
rules disagree.

This is rule lookup, not AI. Provider name is `rule_categorizer`; model
name is the matched rule id. Cost is always zero.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from importlib import resources
from typing import Literal

from sqlalchemy.orm import Session

from ledgerlens.models import Transaction
from ledgerlens.repositories import CategoryRepo

RuleVerdict = Literal["apply", "conflict", "none"]

MatchType = Literal[
    "exact_merchant",
    "merchant_contains",
    "description_contains",
    "keyword_any",
    "keyword_all",
]

VALID_MATCH_TYPES: frozenset[str] = frozenset(
    {
        "exact_merchant",
        "merchant_contains",
        "description_contains",
        "keyword_any",
        "keyword_all",
    }
)

# Patterns shorter than this are stripped at load — they overmatch on bank text.
MIN_PATTERN_LEN = 3

# Generic tokens that should never be used as the sole anchor for a rule —
# borrowed from the correction-memory blocklist so the two layers agree on
# what "too generic" means.
GENERIC_TOKENS: frozenset[str] = frozenset(
    {
        "PAYMENT",
        "ACH",
        "DEBIT",
        "CREDIT",
        "TRANSFER",
        "CHECK",
        "POS",
        "ONLINE",
        "WEB",
        "PURCHASE",
        "WIRE",
        "BANK",
        "DEPOSIT",
        "WITHDRAWAL",
        "FEE",
        "INTEREST",
        "REFUND",
        "ATM",
    }
)


@dataclass(frozen=True)
class Rule:
    id: str
    name: str
    active: bool
    priority: int
    match_type: MatchType
    merchant_patterns: tuple[str, ...]
    description_patterns: tuple[str, ...]
    category_code: str
    confidence: float
    explanation: str
    notes: str


@dataclass
class RuleMatch:
    """Outcome of running the rule layer over a transaction."""

    verdict: RuleVerdict
    rule: Rule | None
    candidates: list[Rule]
    merchant_text: str
    description_text: str
    reason: str


# ── Loading ───────────────────────────────────────────────────────────────


def _load_rules_from_resource() -> list[dict[str, object]]:
    """Read the bundled rule JSON. Returns the raw `rules` list."""
    data = (
        resources.files("ledgerlens.data")
        .joinpath("category_rules.json")
        .read_text(encoding="utf-8")
    )
    parsed = json.loads(data)
    rules = parsed.get("rules")
    if not isinstance(rules, list):
        raise ValueError("category_rules.json: expected a top-level `rules` array")
    return rules


def _clean_patterns(patterns: object) -> tuple[str, ...]:
    """Uppercase, strip, deduplicate, drop too-short or generic-only tokens."""
    if not isinstance(patterns, list):
        return ()
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in patterns:
        if not isinstance(raw, str):
            continue
        token = raw.strip().upper()
        if len(token) < MIN_PATTERN_LEN:
            continue
        # Tokens that are *just* one generic word are dangerous; drop them.
        if token in GENERIC_TOKENS:
            continue
        if token in seen:
            continue
        seen.add(token)
        cleaned.append(token)
    return tuple(cleaned)


def _coerce_rule(raw: dict[str, object]) -> Rule | None:
    """Coerce one JSON dict into a `Rule`. Returns None if structurally invalid."""
    try:
        rule_id = str(raw["id"])
        name = str(raw["name"])
        active = bool(raw.get("active", True))
        priority_raw = raw.get("priority", 0)
        priority = int(priority_raw) if isinstance(priority_raw, (int, float, str)) else 0
        match_type = str(raw["match_type"])
        category_code = str(raw["category_code"])
        confidence_raw = raw["confidence"]
        if not isinstance(confidence_raw, (int, float, str)):
            return None
        confidence = float(confidence_raw)
    except (KeyError, TypeError, ValueError):
        return None

    if match_type not in VALID_MATCH_TYPES:
        return None
    if not (0.0 <= confidence <= 1.0):
        return None

    merchant_patterns = _clean_patterns(raw.get("merchant_patterns"))
    description_patterns = _clean_patterns(raw.get("description_patterns"))

    if not merchant_patterns and not description_patterns:
        return None

    return Rule(
        id=rule_id,
        name=name,
        active=active,
        priority=priority,
        match_type=match_type,  # type: ignore[arg-type]
        merchant_patterns=merchant_patterns,
        description_patterns=description_patterns,
        category_code=category_code,
        confidence=confidence,
        explanation=str(raw.get("explanation", "")),
        notes=str(raw.get("notes", "")),
    )


def load_rules(
    db: Session,
    *,
    raw_rules: list[dict[str, object]] | None = None,
) -> list[Rule]:
    """Load and validate the bundled rule set against the active COA.

    Drops rules pointing at inactive / missing categories. Drops rules whose
    patterns are all too short or generic. The remaining rules are sorted by
    descending `(priority, confidence)` so the first match in a list is the
    strongest one.

    `raw_rules` lets tests inject a custom rule set without touching disk.
    """
    cat_repo = CategoryRepo(db)
    raw = raw_rules if raw_rules is not None else _load_rules_from_resource()
    rules: list[Rule] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        rule = _coerce_rule(entry)
        if rule is None:
            continue
        if not rule.active:
            continue
        category = cat_repo.get(rule.category_code)
        if category is None or not category.active:
            continue
        rules.append(rule)
    rules.sort(key=lambda r: (r.priority, r.confidence), reverse=True)
    return rules


# ── Matching ──────────────────────────────────────────────────────────────


def _merchant_text(tx: Transaction) -> str:
    return (tx.merchant or "").strip().upper()


def _description_text(tx: Transaction) -> str:
    return (tx.normalized_description or "").strip().upper()


def _rule_applies(rule: Rule, merchant: str, description: str) -> bool:
    if rule.match_type == "exact_merchant":
        return bool(merchant) and merchant in rule.merchant_patterns

    if rule.match_type == "merchant_contains":
        if not merchant or not rule.merchant_patterns:
            return False
        return any(token in merchant for token in rule.merchant_patterns)

    if rule.match_type == "description_contains":
        if not description or not rule.description_patterns:
            return False
        return any(token in description for token in rule.description_patterns)

    if rule.match_type == "keyword_any":
        for token in rule.merchant_patterns:
            if merchant and token in merchant:
                return True
        for token in rule.description_patterns:
            if description and token in description:
                return True
        return False

    if rule.match_type == "keyword_all":
        # Every pattern must appear in either merchant or description.
        haystacks: list[str] = [s for s in (merchant, description) if s]
        if not haystacks:
            return False
        tokens = list(rule.merchant_patterns) + list(rule.description_patterns)
        if not tokens:
            return False
        return all(any(t in h for h in haystacks) for t in tokens)

    return False


def find_rule_match(
    tx: Transaction,
    db: Session,
    *,
    rules: list[Rule] | None = None,
    auto_threshold: float = 0.9,
    review_threshold: float = 0.6,
) -> RuleMatch:
    """Apply the rule set to a transaction.

    Returns a `RuleMatch` with one of three verdicts:

    - `apply` — a single category code wins among the matched rules; the
      strongest rule is selected. The categorize service decides on auto-approve
      vs needs-review based on the matched rule's confidence relative to the
      configured thresholds (not done here).
    - `conflict` — two or more matched rules disagree on the category code.
      The categorize service routes the transaction to review.
    - `none` — no rule matches.
    """
    merchant = _merchant_text(tx)
    description = _description_text(tx)

    if not merchant and not description:
        return RuleMatch(
            verdict="none",
            rule=None,
            candidates=[],
            merchant_text=merchant,
            description_text=description,
            reason="empty merchant and description",
        )

    if rules is None:
        rules = load_rules(db)

    matched: list[Rule] = [r for r in rules if _rule_applies(r, merchant, description)]
    if not matched:
        return RuleMatch(
            verdict="none",
            rule=None,
            candidates=[],
            merchant_text=merchant,
            description_text=description,
            reason="no active rule matched",
        )

    distinct_categories = {r.category_code for r in matched}
    if len(distinct_categories) > 1:
        return RuleMatch(
            verdict="conflict",
            rule=None,
            candidates=matched,
            merchant_text=merchant,
            description_text=description,
            reason=(f"matching rules disagree on category: {sorted(distinct_categories)}"),
        )

    # All matched rules agree. Pick the strongest by (priority, confidence).
    strongest = matched[0]  # rules list is already sorted descending
    reason = (
        f"matched rule {strongest.id} ({strongest.match_type}); category {strongest.category_code}"
    )
    if strongest.confidence < review_threshold:
        reason = f"{reason}; confidence below review threshold → review"
    elif strongest.confidence < auto_threshold:
        reason = f"{reason}; confidence below auto threshold → review"
    return RuleMatch(
        verdict="apply",
        rule=strongest,
        candidates=matched,
        merchant_text=merchant,
        description_text=description,
        reason=reason,
    )
