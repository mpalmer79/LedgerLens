"""Eval-side rule categorizer.

Adapts the production `services/rule_categorizer.py` to the eval `Categorizer`
protocol so we can measure rules-only and rules+model coverage / accuracy /
cost against the existing dataset.

The eval-side schemas (`Account`, `Business`, `Transaction`) are not the
database models — there's no SQLAlchemy session here. To reuse the matching
logic, we build a tiny `_RuleAdapter` that produces a transaction-shaped
object with the two fields `_rule_applies` reads (`merchant`, `normalized_description`).
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from importlib import resources

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.services.rule_categorizer import (
    Rule,
    _coerce_rule,
    _rule_applies,
)


@dataclass
class _TxLike:
    """Quacks like the production `Transaction` ORM model for matching."""

    merchant: str | None
    normalized_description: str


def _load_bundled_rules() -> list[Rule]:
    data = (
        resources.files("ledgerlens.data")
        .joinpath("category_rules.json")
        .read_text(encoding="utf-8")
    )
    parsed = json.loads(data)
    raw_rules = parsed.get("rules", [])
    rules: list[Rule] = []
    for entry in raw_rules:
        if not isinstance(entry, dict):
            continue
        rule = _coerce_rule(entry)
        if rule is None or not rule.active:
            continue
        rules.append(rule)
    rules.sort(key=lambda r: (r.priority, r.confidence), reverse=True)
    return rules


class RuleOnlyCategorizer:
    """Deterministic eval baseline. Predicts only via the rule layer.

    On no-match the categorizer falls back to `UNCATEGORIZABLE` rather than
    guessing — that's how the eval distinguishes "rules answer this case" from
    "the model has to answer this case".
    """

    name = "rule-categorizer-v1"

    def __init__(self, rules: list[Rule] | None = None) -> None:
        self._rules = rules if rules is not None else _load_bundled_rules()

    def categorize(
        self,
        transaction: EvalTransaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        coa_codes = {a.code for a in chart_of_accounts}
        # Restrict to rules pointing at categories that actually exist in
        # this business's COA — same safety property as the production loader.
        rules = [r for r in self._rules if r.category_code in coa_codes]

        # The eval schema has no separate merchant field; derive a best-effort
        # one from the first token of `raw_description`.
        raw = transaction.raw_description or ""
        first_token = raw.strip().split(" ", 1)[0] if raw else ""
        adapter = _TxLike(
            merchant=first_token.upper() or None,
            normalized_description=raw.upper(),
        )

        started = time.monotonic()
        matched = [
            r
            for r in rules
            if _rule_applies(r, adapter.merchant or "", adapter.normalized_description)
        ]
        elapsed_ms = (time.monotonic() - started) * 1000

        if not matched:
            return CategorizationResult(
                transaction_id=transaction.id,
                predicted_category_code="UNCATEGORIZABLE",
                confidence=0.0,
                reasoning="rule_categorizer: no rule matched",
                alternative_category_code=None,
                cost_usd=0.0,
                latency_ms=elapsed_ms,
                model="deterministic_rules_v1",
            )

        distinct = {r.category_code for r in matched}
        if len(distinct) > 1:
            sorted_codes = sorted(distinct)
            return CategorizationResult(
                transaction_id=transaction.id,
                predicted_category_code="UNCATEGORIZABLE",
                confidence=0.0,
                reasoning=(
                    f"rule_categorizer: conflicting rules matched ({', '.join(sorted_codes)})"
                ),
                alternative_category_code=sorted_codes[0],
                cost_usd=0.0,
                latency_ms=elapsed_ms,
                model="deterministic_rules_v1",
            )

        strongest = matched[0]
        return CategorizationResult(
            transaction_id=transaction.id,
            predicted_category_code=strongest.category_code,
            confidence=float(strongest.confidence),
            reasoning=(f"rule_categorizer: matched {strongest.id} ({strongest.match_type})"),
            alternative_category_code=None,
            cost_usd=0.0,
            latency_ms=elapsed_ms,
            model=strongest.id,
        )
