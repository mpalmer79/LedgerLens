"""Read-only endpoints exposing the deterministic rule layer."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ledgerlens.api.schemas import (
    RuleListOut,
    RuleMatchOut,
    RuleOut,
)
from ledgerlens.db import get_db
from ledgerlens.errors import NotFound
from ledgerlens.repositories import CategoryRepo, TransactionRepo
from ledgerlens.services.rule_categorizer import Rule, find_rule_match, load_rules

router = APIRouter(prefix="/rules", tags=["rules"])
rule_match_router = APIRouter(tags=["rules"])


def _to_rule_out(rule: Rule, db: Session) -> RuleOut:
    cat = CategoryRepo(db).get(rule.category_code)
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
    )


@router.get("", response_model=RuleListOut)
def list_rules(db: Session = Depends(get_db)) -> RuleListOut:
    """Return the active, COA-validated rule set in priority order."""
    rules = load_rules(db)
    items = [_to_rule_out(r, db) for r in rules]
    return RuleListOut(total=len(items), items=items)


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
