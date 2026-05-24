"""Apply the configured categorizer to a stored transaction.

The Categorizer protocol from `ledgerlens.categorizers.base` was built around
the eval-side `Transaction` / `Business` / `Account` Pydantic models. Here we
adapt the persisted models to that shape so the existing ClaudeHaikuCategorizer
works without modification.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from ledgerlens.services.rule_categorizer import Rule

from ledgerlens.categorizers.base import CategorizationResult as PredResult
from ledgerlens.categorizers.base import Categorizer
from ledgerlens.config import get_settings
from ledgerlens.errors import MissingProviderConfig
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.models import (
    AccountCategory,
    CategorizationResult,
    CorrectionMemory,
    ResultStatus,
    Transaction,
)
from ledgerlens.repositories import (
    AuditRepo,
    CategorizationRepo,
    CategoryRepo,
)

UNCATEGORIZABLE_SENTINEL = "UNCATEGORIZABLE"


def get_default_categorizer() -> Categorizer:
    """Construct the configured production fallback categorizer.

    Returns the categorizer selected by `CATEGORIZER_MODE`:

    - `demo_stub` (portfolio-safe default) — `DemoStubCategorizer`. No external
      calls, no API keys, no cost. Unmatched transactions land in review.
    - `anthropic` — `ClaudeHaikuCategorizer`. Requires `ANTHROPIC_API_KEY`; if
      the key is missing this raises `MissingProviderConfig`, which the
      categorize routes convert to a structured 503.
    """
    settings = get_settings()

    if settings.categorizer_mode == "demo_stub":
        # Local import keeps the categorizer module self-contained and skips
        # the import on the (much rarer) Anthropic path.
        from ledgerlens.categorizers.demo_stub import DemoStubCategorizer

        return DemoStubCategorizer()

    # categorizer_mode == "anthropic"
    if not settings.anthropic_configured:
        raise MissingProviderConfig("Anthropic", "ANTHROPIC_API_KEY")

    # Lazy import — keeps the anthropic SDK out of cold-start paths that
    # don't need it (every demo-mode deploy).
    import anthropic

    from ledgerlens.categorizers.claude_haiku import ClaudeHaikuCategorizer

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return ClaudeHaikuCategorizer(client=client, model=settings.anthropic_model_primary)


def _eval_transaction_from_db(tx: Transaction) -> EvalTransaction:
    return EvalTransaction(
        id=tx.id,
        date=tx.transaction_date.isoformat(),
        amount_cents=tx.amount_cents,
        raw_description=tx.raw_description,
        proposed_category_code="",  # not used by the categorizer; required by the schema
        label_confidence="high",
        is_adversarial=False,
        reasoning="",
        labeler_notes=None,
    )


def _eval_business_from_settings() -> Business:
    """A neutral business context for product-side calls.

    The eval-side categorizer prompt requires business name/industry/description.
    For product calls we don't have a per-business context yet (single-tenant
    v0). Use a sensible default until multi-tenancy is added.
    """
    return Business(
        id="default",
        name="Default Business",
        industry="General SMB",
        description="Default single-tenant chart of accounts.",
        fiscal_year_start="01-01",
        typical_monthly_revenue_usd=None,
        notes=None,
    )


def _coa_to_eval_accounts(db: Session) -> list[Account]:
    return [
        Account(
            code=c.code,
            name=c.name,
            description=c.description,
            parent_code=None,
            type=c.type,  # type: ignore[arg-type]
        )
        for c in CategoryRepo(db).list_active()
    ]


def _route_status(
    pred: PredResult,
    category_repo: CategoryRepo,
) -> ResultStatus:
    """Map a model prediction to a stored ResultStatus."""
    settings = get_settings()
    if pred.predicted_category_code == UNCATEGORIZABLE_SENTINEL:
        return ResultStatus.UNCATEGORIZABLE
    if not category_repo.exists(pred.predicted_category_code):
        # The model picked a code not in the active chart of accounts —
        # don't auto-post it; let a human resolve.
        return ResultStatus.NEEDS_REVIEW
    if pred.confidence >= settings.ledgerlens_auto_queue_threshold:
        return ResultStatus.AUTO_APPROVED
    if pred.confidence >= settings.ledgerlens_review_queue_threshold:
        return ResultStatus.NEEDS_REVIEW
    return ResultStatus.NEEDS_REVIEW


CORRECTION_MEMORY_PROVIDER = "correction_memory"
RULE_CATEGORIZER_PROVIDER = "rule_categorizer"


def _persist_memory_result(
    tx: Transaction,
    memory: CorrectionMemory,
    matched: AccountCategory | None,
    db: Session,
    latency_ms: int,
    extra_note: str = "",
) -> CategorizationResult:
    """Persist a CategorizationResult that came from correction memory.

    Zero cost, full confidence, provider = correction_memory, and an
    explanation that names the source review decision. Also increments the
    memory row's `match_count` and `last_used_at`.
    """
    from ledgerlens.repositories.correction_memory import CorrectionMemoryRepo

    CorrectionMemoryRepo(db).mark_used(memory)

    explanation = (
        f"Matched prior human correction for "
        f"{'merchant ' + memory.merchant_key if memory.merchant_key else 'description'}. "
        f"Previous reviewer selected [{memory.selected_category_code}] "
        f"{matched.name if matched else memory.selected_category_code}."
    )
    if extra_note:
        explanation = f"{explanation} {extra_note}"

    result = CategorizationResult(
        transaction_id=tx.id,
        predicted_category_code=memory.selected_category_code,
        predicted_category_name=matched.name if matched else "",
        confidence=1.0,
        explanation=explanation[:2000],
        alternative_category_code=None,
        model_provider=CORRECTION_MEMORY_PROVIDER,
        model_name=None,
        latency_ms=latency_ms,
        estimated_cost_usd=0.0,
        status=ResultStatus.AUTO_APPROVED,
    )
    CategorizationRepo(db).add(result)
    AuditRepo(db).record(
        entity_type="categorization_result",
        action="categorized_from_memory",
        entity_id=result.id,
        details={
            "transaction_id": tx.id,
            "memory_id": memory.id,
            "selected_category_code": memory.selected_category_code,
            "source_review_decision_id": memory.source_review_decision_id,
        },
    )
    return result


def _persist_rule_result(
    tx: Transaction,
    rule: "Rule",
    matched: AccountCategory | None,
    db: Session,
    latency_ms: int,
    status: ResultStatus,
    reason: str = "",
) -> CategorizationResult:
    """Persist a CategorizationResult produced by the deterministic rule layer.

    Zero cost. Provider = rule_categorizer. Model name = rule id (so reviewers
    can trace exactly which rule fired). Explanation cites the rule by id+name.
    """
    explanation = (
        f"Deterministic rule {rule.id} ({rule.name}) matched. "
        f"Category [{rule.category_code}]"
        f"{' ' + matched.name if matched else ''}. "
        f"{rule.explanation}"
    ).strip()
    if reason:
        explanation = f"{explanation} {reason}"

    result = CategorizationResult(
        transaction_id=tx.id,
        predicted_category_code=rule.category_code,
        predicted_category_name=matched.name if matched else "",
        confidence=float(rule.confidence),
        explanation=explanation[:2000],
        alternative_category_code=None,
        model_provider=RULE_CATEGORIZER_PROVIDER,
        model_name=rule.id,
        latency_ms=latency_ms,
        estimated_cost_usd=0.0,
        status=status,
    )
    CategorizationRepo(db).add(result)
    AuditRepo(db).record(
        entity_type="categorization_result",
        action="categorized_from_rules",
        entity_id=result.id,
        details={
            "transaction_id": tx.id,
            "rule_id": rule.id,
            "rule_name": rule.name,
            "predicted": rule.category_code,
            "confidence": float(rule.confidence),
            "status": status.value,
        },
    )
    return result


def _persist_rule_conflict(
    tx: Transaction,
    candidates: list["Rule"],
    db: Session,
    latency_ms: int,
) -> CategorizationResult:
    """Persist a needs-review result for two or more disagreeing rules."""
    conflicting_codes = sorted({c.category_code for c in candidates})
    explanation = (
        "Multiple deterministic rules matched with different categories "
        f"({', '.join(conflicting_codes)}): "
        f"{', '.join(c.id for c in candidates)}. Routed to review."
    )
    result = CategorizationResult(
        transaction_id=tx.id,
        predicted_category_code=conflicting_codes[0] if conflicting_codes else "",
        predicted_category_name="",
        confidence=0.0,
        explanation=explanation[:2000],
        alternative_category_code=conflicting_codes[1] if len(conflicting_codes) > 1 else None,
        model_provider=RULE_CATEGORIZER_PROVIDER,
        model_name=None,
        latency_ms=latency_ms,
        estimated_cost_usd=0.0,
        status=ResultStatus.NEEDS_REVIEW,
    )
    CategorizationRepo(db).add(result)
    AuditRepo(db).record(
        entity_type="categorization_result",
        action="rule_conflict_routed_to_review",
        entity_id=result.id,
        details={
            "transaction_id": tx.id,
            "conflicting_codes": conflicting_codes,
            "rule_ids": [c.id for c in candidates],
        },
    )
    return result


def categorize_transaction(
    tx: Transaction,
    db: Session,
    *,
    categorizer: Categorizer | None = None,
) -> CategorizationResult:
    """Run categorization on a stored transaction and persist the result.

    Order of attempts:
    1. Correction memory exact match. On `apply` → persist with provider
       `correction_memory`, zero cost, status `auto_approved`. On `conflict`
       → persist `needs_review`.
    2. Deterministic rule layer. On strong match (rule confidence ≥ auto
       threshold) → persist with provider `rule_categorizer`, zero cost,
       `auto_approved`. On below-auto rule match → `needs_review`. On
       multiple disagreeing rules → `needs_review` with a rule_conflict
       explanation.
    3. Fall through to the model categorizer (Anthropic). Status is set by
       the existing confidence-routing rules.

    Returns the persisted CategorizationResult. Raises MissingProviderConfig
    if Anthropic isn't configured AND no memory/rule match was found.
    """
    from ledgerlens.services.correction_memory import find_memory_match

    started = datetime.now().timestamp()
    match = find_memory_match(tx, db)
    cat_repo = CategoryRepo(db)

    if match.verdict == "apply" and match.record is not None:
        matched = cat_repo.get(match.record.selected_category_code)
        latency_ms = int((datetime.now().timestamp() - started) * 1000)
        return _persist_memory_result(tx, match.record, matched, db, latency_ms)

    if match.verdict == "conflict":
        conflicting_codes = sorted({c.selected_category_code for c in match.candidates})
        latency_ms = int((datetime.now().timestamp() - started) * 1000)
        result = CategorizationResult(
            transaction_id=tx.id,
            predicted_category_code=conflicting_codes[0] if conflicting_codes else "",
            predicted_category_name="",
            confidence=0.0,
            explanation=(
                "Correction memory has conflicting prior corrections for this "
                f"transaction ({', '.join(conflicting_codes)}). Routed to review "
                "instead of auto-applying."
            )[:2000],
            alternative_category_code=conflicting_codes[1] if len(conflicting_codes) > 1 else None,
            model_provider=CORRECTION_MEMORY_PROVIDER,
            model_name=None,
            latency_ms=latency_ms,
            estimated_cost_usd=0.0,
            status=ResultStatus.NEEDS_REVIEW,
        )
        CategorizationRepo(db).add(result)
        AuditRepo(db).record(
            entity_type="categorization_result",
            action="memory_conflict_routed_to_review",
            entity_id=result.id,
            details={
                "transaction_id": tx.id,
                "conflicting_codes": conflicting_codes,
            },
        )
        return result

    # No memory hit — try the deterministic rule layer next.
    from ledgerlens.services.rule_categorizer import find_rule_match

    settings = get_settings()
    rule_match = find_rule_match(
        tx,
        db,
        auto_threshold=settings.ledgerlens_auto_queue_threshold,
        review_threshold=settings.ledgerlens_review_queue_threshold,
    )

    if rule_match.verdict == "apply" and rule_match.rule is not None:
        from dataclasses import replace as _dc_replace

        from ledgerlens.data.business_rule_maps import resolve_category_for_intent

        rule = rule_match.rule
        # Per-business intent mapping: if the rule carries an intent and the
        # active business has a mapped category code, swap to that code.
        # Falls back to the rule's own category_code when no mapping exists.
        mapped_code = resolve_category_for_intent(rule.intent, fallback_code=rule.category_code)
        # Validate the mapped code resolves to a real, active COA category.
        # If not, drop back to the rule's original code (which the rules
        # loader already validated at load time).
        matched_cat = cat_repo.get(mapped_code)
        if matched_cat is None and mapped_code != rule.category_code:
            mapped_code = rule.category_code
            matched_cat = cat_repo.get(mapped_code)
        if mapped_code != rule.category_code:
            rule = _dc_replace(rule, category_code=mapped_code)
        if rule.confidence >= settings.ledgerlens_auto_queue_threshold:
            status = ResultStatus.AUTO_APPROVED
            reason = ""
        else:
            status = ResultStatus.NEEDS_REVIEW
            reason = "Rule confidence below auto-approve threshold; routed to review."
        latency_ms = int((datetime.now().timestamp() - started) * 1000)
        return _persist_rule_result(tx, rule, matched_cat, db, latency_ms, status, reason)

    if rule_match.verdict == "conflict":
        latency_ms = int((datetime.now().timestamp() - started) * 1000)
        return _persist_rule_conflict(tx, rule_match.candidates, db, latency_ms)

    # No rule hit — fall through to the model categorizer.
    if categorizer is None:
        categorizer = get_default_categorizer()

    business = _eval_business_from_settings()
    coa = _coa_to_eval_accounts(db)
    if not coa:
        raise MissingProviderConfig("Chart of Accounts", "(seed COA)")

    eval_tx = _eval_transaction_from_db(tx)

    started = datetime.now().timestamp()
    pred = categorizer.categorize(eval_tx, business, coa)
    elapsed_ms = int((datetime.now().timestamp() - started) * 1000)

    cat_repo = CategoryRepo(db)
    status = _route_status(pred, cat_repo)
    matched = cat_repo.get(pred.predicted_category_code)

    # If the categorizer's own error path produced UNCATEGORIZABLE with a
    # provider-error reasoning string, count that as a real failure.
    if pred.predicted_category_code == UNCATEGORIZABLE_SENTINEL and "API" in pred.reasoning:
        status = ResultStatus.FAILED

    # Provider attribution: identify the demo stub explicitly so the UI and
    # the audit trail never claim a stub result came from Anthropic.
    from ledgerlens.categorizers.demo_stub import (
        DEMO_STUB_MODEL_NAME,
        DEMO_STUB_PROVIDER,
    )

    if pred.model == DEMO_STUB_MODEL_NAME:
        model_provider = DEMO_STUB_PROVIDER
        audit_action = "categorized_by_demo_stub"
    else:
        model_provider = "anthropic"
        audit_action = "categorized"

    result = CategorizationResult(
        transaction_id=tx.id,
        predicted_category_code=pred.predicted_category_code,
        predicted_category_name=(matched.name if matched else ""),
        confidence=pred.confidence,
        explanation=pred.reasoning[:2000],
        alternative_category_code=pred.alternative_category_code,
        model_provider=model_provider,
        model_name=pred.model,
        latency_ms=max(elapsed_ms, int(pred.latency_ms)),
        estimated_cost_usd=pred.cost_usd,
        status=status,
    )
    CategorizationRepo(db).add(result)
    AuditRepo(db).record(
        entity_type="categorization_result",
        action=audit_action,
        entity_id=result.id,
        details={
            "transaction_id": tx.id,
            "predicted": pred.predicted_category_code,
            "confidence": pred.confidence,
            "status": status.value,
            "cost_usd": pred.cost_usd,
            "model": pred.model,
            "provider": model_provider,
        },
    )
    return result
