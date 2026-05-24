"""Read-only endpoints exposing the deterministic rule layer."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import (
    BusinessRuleMapEntry,
    BusinessRuleMapOut,
    RuleListOut,
    RuleMatchOut,
    RuleOut,
)
from ledgerlens.data.business_rule_maps import (
    active_business_id,
    get_business_rule_map,
    resolve_category_for_intent,
)
from ledgerlens.data.sample_scenario import SAMPLE_SCENARIO
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound
from ledgerlens.repositories import CategoryRepo, TransactionRepo
from ledgerlens.services.rule_categorizer import Rule, find_rule_match, load_rules

router = APIRouter(prefix="/rules", tags=["rules"])
rule_match_router = APIRouter(tags=["rules"])


def _to_rule_out(rule: Rule, db: Session) -> RuleOut:
    cat_repo = CategoryRepo(db)
    cat = cat_repo.get(rule.category_code)
    mapped_code: str | None = None
    mapped_name: str | None = None
    if rule.intent:
        candidate = resolve_category_for_intent(rule.intent, fallback_code=rule.category_code)
        mapped_code = candidate
        mapped_cat = cat_repo.get(candidate)
        mapped_name = mapped_cat.name if mapped_cat else None
    return RuleOut(
        id=rule.id,
        name=rule.name,
        active=rule.active,
        priority=rule.priority,
        match_type=rule.match_type,
        merchant_patterns=list(rule.merchant_patterns),
        description_patterns=list(rule.description_patterns),
        category_code=rule.category_code,
        category_name=cat.name if cat else "",
        confidence=float(rule.confidence),
        explanation=rule.explanation,
        intent=rule.intent,
        mapped_category_code=mapped_code,
        mapped_category_name=mapped_name,
    )


def _build_mapping_snapshot(db: Session) -> BusinessRuleMapOut:
    cat_repo = CategoryRepo(db)
    bid = active_business_id()
    rule_map = get_business_rule_map(bid)
    entries: list[BusinessRuleMapEntry] = []
    for intent, code in sorted(rule_map.intent_to_code.items()):
        cat = cat_repo.get(code)
        entries.append(
            BusinessRuleMapEntry(
                intent=intent,
                category_code=code,
                category_name=cat.name if cat else None,
            )
        )
    # All intents that appear on rules; intents not in the active map are
    # surfaced so the mapping explorer can warn the owner.
    rules = load_rules(db)
    rule_intents = sorted({r.intent for r in rules if r.intent})
    mapped_keys = set(rule_map.intent_to_code.keys())
    unmapped = [i for i in rule_intents if i not in mapped_keys]

    return BusinessRuleMapOut(
        business_id=bid,
        business_name=SAMPLE_SCENARIO["business_name"]
        if bid == "granite_state_auto_repair"
        else None,
        entries=entries,
        block_fallback_intents=sorted(rule_map.block_fallback_intents),
        unmapped_intents=unmapped,
    )


@router.get("", response_model=RuleListOut)
def list_rules(db: Session = Depends(get_db)) -> RuleListOut:
    """Return the active, COA-validated rule set in priority order, with the
    active business's intent → category mapping snapshot attached."""
    rules = load_rules(db)
    items = [_to_rule_out(r, db) for r in rules]
    return RuleListOut(total=len(items), items=items, mapping=_build_mapping_snapshot(db))


@rule_match_router.get(
    "/transactions/{transaction_id}/rule-matches",
    response_model=RuleMatchOut,
)
def rule_matches(transaction_id: str, db: Session = Depends(get_db)) -> RuleMatchOut:
    """Show what the rule layer would predict for a transaction, without persisting."""
    tx = TransactionRepo(db).get(transaction_id)
    if tx is None:
        raise NotFound("transaction", transaction_id)
    match = find_rule_match(tx, db)
    return RuleMatchOut(
        verdict=match.verdict,
        reason=match.reason,
        merchant_text=match.merchant_text,
        description_text=match.description_text,
        rule=_to_rule_out(match.rule, db) if match.rule else None,
        candidates=[_to_rule_out(r, db) for r in match.candidates],
    )
