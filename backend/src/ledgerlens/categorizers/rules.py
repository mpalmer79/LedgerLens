"""Eval-side rule categorizer.

Adapts the production `services/rule_categorizer.py` to the eval `Categorizer`
protocol so we can measure rules-only and rules+model coverage / accuracy /
cost against the existing dataset.

Two variants:

- `RuleOnlyCategorizer()` — the v1 generic baseline. Uses each rule's own
  hard-coded `category_code`. Filters rules whose code doesn't exist on the
  dataset's COA at load time. This is what's been shipping.
- `RuleOnlyCategorizer(use_business_mapping=True, business_id=...)` — the
  mapped variant. After a rule matches, asks the active business mapping to
  resolve the rule's `intent` to a code that exists on the dataset's COA.
  Records the resolution outcome on the prediction so the eval harness can
  compute mapping-aware metrics without parsing strings.

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
from ledgerlens.data.business_rule_maps import get_business_rule_map
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.services.rule_categorizer import (
    Rule,
    _coerce_rule,
    _rule_applies,
)

# Eval dataset business ids → business_rule_map ids. The eval datasets use
# kebab-case ids ("auto-repair") and the rule-map registry uses snake_case
# scoped ids ("auto_repair_eval"). This is the single translation point.
EVAL_BUSINESS_MAP_IDS: dict[str, str] = {
    "auto-repair": "auto_repair_eval",
    # coffee-shop and design-agency don't yet have curated maps; the resolver
    # falls back to DEFAULT_INTENT_MAP for them, which is still a meaningful
    # signal — a generic SMB COA mapping is exactly what the rules-only-mapped
    # baseline should land on absent a per-business curated map.
}


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


def _resolve_eval_business_id(business: Business) -> str:
    """Look up the rule-map id for an eval dataset business.

    Unknown / unmapped dataset ids fall through to the default map.
    """
    return EVAL_BUSINESS_MAP_IDS.get(business.id, "default")


class RuleOnlyCategorizer:
    """Deterministic eval baseline. Predicts only via the rule layer.

    On no-match the categorizer falls back to `UNCATEGORIZABLE` rather than
    guessing — that's how the eval distinguishes "rules answer this case" from
    "the model has to answer this case".

    When `use_business_mapping=True`, the categorizer additionally resolves a
    matched rule's intent through the active business mapping. The resolved
    code wins over the rule's own `category_code` when it exists on the
    dataset COA. Each prediction carries `matched_rule_intent` and
    `mapping_outcome` so the harness can compute mapping-aware metrics.
    """

    def __init__(
        self,
        rules: list[Rule] | None = None,
        *,
        use_business_mapping: bool = False,
        business_id: str | None = None,
    ) -> None:
        self._rules = rules if rules is not None else _load_bundled_rules()
        self.use_business_mapping = use_business_mapping
        # `business_id` overrides per-dataset lookup. When None and mapping
        # is enabled, the categorizer derives the id from the eval Business
        # object on each call (so a single instance can score multiple
        # datasets — useful for compare.py).
        self._business_id_override = business_id
        self.name = "rule-categorizer-mapped-v1" if use_business_mapping else "rule-categorizer-v1"

    def categorize(
        self,
        transaction: EvalTransaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        coa_codes = {a.code for a in chart_of_accounts}
        # When mapping is disabled we filter rules whose `category_code`
        # doesn't exist on the dataset COA up front (the v1 baseline behavior).
        # When mapping is enabled we keep every rule active because the
        # mapping may produce a different, valid code; we re-validate after
        # the mapping fires.
        if self.use_business_mapping:
            candidate_rules = list(self._rules)
        else:
            candidate_rules = [r for r in self._rules if r.category_code in coa_codes]

        raw = transaction.raw_description or ""
        first_token = raw.strip().split(" ", 1)[0] if raw else ""
        adapter = _TxLike(
            merchant=first_token.upper() or None,
            normalized_description=raw.upper(),
        )

        started = time.monotonic()
        matched = [
            r
            for r in candidate_rules
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

        # Conflict detection happens on the *resolved* codes when mapping is
        # enabled — two rules with different intents that both map to the
        # same code aren't a conflict; only true label disagreement is.
        if self.use_business_mapping:
            resolved_codes = {self._resolve_code(r, business, coa_codes) for r in matched}
            distinct = {code for code in resolved_codes if code is not None}
            unresolved = any(code is None for code in resolved_codes)
            if unresolved and not distinct:
                # Every matched rule has an unmappable intent for this COA.
                rule_intents = sorted({r.intent or "(no intent)" for r in matched})
                strongest = matched[0]
                return CategorizationResult(
                    transaction_id=transaction.id,
                    predicted_category_code="UNCATEGORIZABLE",
                    confidence=0.0,
                    reasoning=(
                        f"rule_categorizer: matched {strongest.id} but no mapping "
                        f"for intent(s) {rule_intents}; routed to review"
                    ),
                    alternative_category_code=None,
                    cost_usd=0.0,
                    latency_ms=elapsed_ms,
                    model=strongest.id,
                    matched_rule_intent=strongest.intent,
                    mapping_outcome="routed_to_review",
                )
        else:
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
        if self.use_business_mapping:
            resolved_code = self._resolve_code(strongest, business, coa_codes)
            if resolved_code is None:
                rule_intent = strongest.intent or "(no intent)"
                return CategorizationResult(
                    transaction_id=transaction.id,
                    predicted_category_code="UNCATEGORIZABLE",
                    confidence=0.0,
                    reasoning=(
                        f"rule_categorizer: matched {strongest.id} (intent={rule_intent}) "
                        "but neither mapping nor rule default exists on dataset COA; "
                        "routed to review"
                    ),
                    alternative_category_code=None,
                    cost_usd=0.0,
                    latency_ms=elapsed_ms,
                    model=strongest.id,
                    matched_rule_intent=strongest.intent,
                    mapping_outcome="routed_to_review",
                )
            # Decide outcome label.
            if strongest.intent and resolved_code != strongest.category_code:
                outcome = "mapped"
            else:
                outcome = "fallback_to_default"
            return CategorizationResult(
                transaction_id=transaction.id,
                predicted_category_code=resolved_code,
                confidence=float(strongest.confidence),
                reasoning=(
                    f"rule_categorizer: matched {strongest.id} ({strongest.match_type})"
                    + (f"; intent={strongest.intent} → {resolved_code}" if strongest.intent else "")
                ),
                alternative_category_code=None,
                cost_usd=0.0,
                latency_ms=elapsed_ms,
                model=strongest.id,
                matched_rule_intent=strongest.intent,
                mapping_outcome=outcome,
            )

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

    def _resolve_code(self, rule: Rule, business: Business, coa_codes: set[str]) -> str | None:
        """Apply the business mapping to a matched rule and return the COA
        code to use. Returns None when neither the mapping nor the rule's
        own code resolves to a valid COA category for this dataset.

        Order of precedence:

        1. Active business mapping → mapped code (must exist on dataset COA).
        2. Rule's own `category_code` (must exist on dataset COA).
        3. None — caller routes the row to review.
        """
        bid = self._business_id_override or _resolve_eval_business_id(business)
        mapped = get_business_rule_map(bid).resolve(rule.intent)
        if mapped and mapped in coa_codes:
            return mapped
        if rule.category_code in coa_codes:
            return rule.category_code
        return None
