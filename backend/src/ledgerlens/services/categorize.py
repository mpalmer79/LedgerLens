"""Apply the configured categorizer to a stored transaction.

The Categorizer protocol from `ledgerlens.categorizers.base` was built around
the eval-side `Transaction` / `Business` / `Account` Pydantic models. Here we
adapt the persisted models to that shape so the existing ClaudeHaikuCategorizer
works without modification.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from ledgerlens.categorizers.base import CategorizationResult as PredResult
from ledgerlens.categorizers.base import Categorizer
from ledgerlens.config import get_settings
from ledgerlens.errors import MissingProviderConfig
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.models import CategorizationResult, ResultStatus, Transaction
from ledgerlens.repositories import (
    AuditRepo,
    CategorizationRepo,
    CategoryRepo,
)

UNCATEGORIZABLE_SENTINEL = "UNCATEGORIZABLE"


def get_default_categorizer() -> Categorizer:
    """Construct the configured production categorizer.

    Raises MissingProviderConfig if Anthropic isn't set up. Callers should
    catch and convert to a 503 — this is the boundary where missing config
    becomes a user-facing error.
    """
    settings = get_settings()
    if not settings.anthropic_configured:
        raise MissingProviderConfig("Anthropic", "ANTHROPIC_API_KEY")

    # Lazy import — keeps the anthropic SDK out of cold-start paths that
    # don't need it.
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


def categorize_transaction(
    tx: Transaction,
    db: Session,
    *,
    categorizer: Categorizer | None = None,
) -> CategorizationResult:
    """Run categorization on a stored transaction and persist the result.

    Returns the persisted CategorizationResult. Raises MissingProviderConfig
    if Anthropic isn't configured. Other exceptions from the categorizer are
    surfaced; the harness catches API errors internally and returns an
    UNCATEGORIZABLE PredResult, which is then persisted with status FAILED.
    """
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

    result = CategorizationResult(
        transaction_id=tx.id,
        predicted_category_code=pred.predicted_category_code,
        predicted_category_name=(matched.name if matched else ""),
        confidence=pred.confidence,
        explanation=pred.reasoning[:2000],
        alternative_category_code=pred.alternative_category_code,
        model_provider="anthropic",
        model_name=pred.model,
        latency_ms=max(elapsed_ms, int(pred.latency_ms)),
        estimated_cost_usd=pred.cost_usd,
        status=status,
    )
    CategorizationRepo(db).add(result)
    AuditRepo(db).record(
        entity_type="categorization_result",
        action="categorized",
        entity_id=result.id,
        details={
            "transaction_id": tx.id,
            "predicted": pred.predicted_category_code,
            "confidence": pred.confidence,
            "status": status.value,
            "cost_usd": pred.cost_usd,
            "model": pred.model,
        },
    )
    return result
