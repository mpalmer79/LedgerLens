"""Request and response schemas for the HTTP API."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Categories ──────────────────────────────────────────────────────────────


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    description: str
    type: str
    active: bool


# ── Transactions ────────────────────────────────────────────────────────────


class TransactionIn(BaseModel):
    transaction_date: date
    description: str = Field(min_length=1, max_length=512)
    amount_cents: int
    currency: str = "USD"
    merchant: str | None = None
    source: str = "api"

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, v: str) -> str:
        return v.upper()[:8]


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_date: date
    description: str
    raw_description: str
    normalized_description: str
    merchant: str | None
    amount_cents: int
    currency: str
    source: str
    created_at: datetime
    updated_at: datetime


class TransactionListOut(BaseModel):
    total: int
    items: list[TransactionOut]


class TransactionBatchIn(BaseModel):
    transactions: list[TransactionIn] = Field(min_length=1, max_length=500)


class TransactionBatchOut(BaseModel):
    created: list[TransactionOut]
    errors: list[dict[str, object]]


class CsvImportSummary(BaseModel):
    received_rows: int
    created: int
    errors: list[dict[str, object]]
    transactions: list[TransactionOut]


# ── Categorization ──────────────────────────────────────────────────────────


CategorizationStatus = Literal[
    "auto_approved", "needs_review", "uncategorizable", "corrected", "rejected", "failed"
]


class CategorizeRequest(BaseModel):
    """Categorize a stored transaction by id."""

    transaction_id: str


class CategorizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    predicted_category_code: str
    predicted_category_name: str
    confidence: float
    explanation: str
    alternative_category_code: str | None
    model_provider: str
    model_name: str | None
    latency_ms: int
    estimated_cost_usd: float
    status: CategorizationStatus
    created_at: datetime


class CategorizeBatchRequest(BaseModel):
    transaction_ids: list[str] = Field(min_length=1, max_length=100)


class CategorizeBatchOut(BaseModel):
    total: int
    auto_approved: int
    needs_review: int
    uncategorizable: int
    failed: int
    zero_cost: int = 0
    total_cost_usd: float
    results: list[CategorizationOut]


# ── Review queue ────────────────────────────────────────────────────────────


class ReviewQueueItem(BaseModel):
    transaction: TransactionOut
    latest_result: CategorizationOut


class ReviewQueueOut(BaseModel):
    total: int
    items: list[ReviewQueueItem]


class ApproveReview(BaseModel):
    reviewer_note: str | None = None


class CorrectReview(BaseModel):
    selected_category_code: str
    reviewer_note: str | None = None


class UncategorizableReview(BaseModel):
    reviewer_note: str | None = None


class ReviewDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    transaction_id: str
    categorization_result_id: str
    reviewer_action: str
    selected_category_code: str | None
    reviewer_note: str | None
    created_at: datetime


# ── Ledger ──────────────────────────────────────────────────────────────────


class LedgerRow(BaseModel):
    transaction_id: str
    transaction_date: date
    description: str
    amount_cents: int
    currency: str
    category_code: str | None
    category_name: str | None
    categorization_status: str
    confidence: float | None
    reviewed: bool
    reviewer_note: str | None
    source: str
    # Which layer produced the latest result. None when the transaction has
    # never been categorized. Used by the trust-metric panel to distinguish
    # deterministic (memory / rule) decisions from model fallback.
    model_provider: str | None = None


class LedgerTrust(BaseModel):
    """Trust-boundary view of a ledger.

    A row counts as `verified` when its final category was decided through a
    path a bookkeeper can defend:

    - The row was reviewed (approved or corrected) by a human, OR
    - The row was categorized from `correction_memory` (every memory row was
      seeded by a real human correction), OR
    - The row was auto-approved by `rule_categorizer` (a curated rule at or
      above the configured auto-threshold).

    `unverified_finalized` counts rows that ended in `auto_approved` /
    `corrected` without one of those guarantees — for example, an
    `anthropic`-mode model auto-approval that nobody reviewed. The product
    goal is to keep this number at zero on a finalized demo ledger.
    """

    finalized_count: int
    verified_count: int
    unverified_finalized_count: int
    review_required_count: int
    deterministic_count: int
    human_reviewed_count: int
    verification_rate: float


class LedgerOut(BaseModel):
    total: int
    unresolved: int
    rows: list[LedgerRow]
    trust: LedgerTrust


# ── Handoff (small-business cleanup report) ────────────────────────────────


class CleanupImpact(BaseModel):
    """Conservative cleanup-impact estimate, surfaced to the owner.

    The "minutes saved" figure is *not* a financial number. It uses two
    deliberately conservative per-transaction estimates (1.5 minutes for
    a deterministic-layer hit, 2.0 for a memory replay) and labels the
    result as an estimate in the UI.
    """

    transactions_imported: int
    handled_by_rules_or_memory: int
    handled_by_correction_memory: int
    routed_to_review: int
    corrections_learned: int
    estimated_minutes_saved: float


class HandoffOwnerAnswer(BaseModel):
    """An owner's plain-English answer captured during the review flow."""

    transaction_id: str
    transaction_description: str
    answer: str  # reviewer_note text
    selected_category_code: str | None
    selected_category_name: str | None
    reviewer_action: str  # "approve" | "correct" | "mark_uncategorizable"


class HandoffScenario(BaseModel):
    """Sample-business-scenario context attached to the handoff package.

    Populated when the handoff includes any demo-sourced rows so the UI
    can render the fictional business name and the demo disclaimer.
    `None` when the handoff is built from non-demo data.
    """

    business_name: str
    business_type: str
    location: str
    cleanup_month: str
    handoff_filename: str
    demo_disclaimer: str


class HandoffOut(BaseModel):
    generated_at: datetime
    cleanup_period_label: str
    trust: LedgerTrust
    impact: CleanupImpact

    ready_for_accountant: list[LedgerRow]
    needs_review: list[LedgerRow]
    owner_answers: list[HandoffOwnerAnswer]
    corrections_learned: list["CorrectionMemoryOut"]
    scenario: HandoffScenario | None = None


# ── Audit ───────────────────────────────────────────────────────────────────


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entity_type: str
    entity_id: str | None
    action: str
    details: dict[str, object]
    created_at: datetime


# ── Correction memory ──────────────────────────────────────────────────────


class CorrectionMemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    merchant_key: str
    description_key: str
    selected_category_code: str
    source_transaction_id: str
    source_review_decision_id: str
    match_count: int
    last_used_at: datetime | None
    active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class CorrectionMemoryListOut(BaseModel):
    total: int
    items: list[CorrectionMemoryOut]


class CorrectionMemoryPatch(BaseModel):
    active: bool | None = None
    selected_category_code: str | None = None
    notes: str | None = None


class MemoryMatchOut(BaseModel):
    verdict: str  # "apply" | "conflict" | "none"
    reason: str
    merchant_key: str
    description_key: str
    record: CorrectionMemoryOut | None = None
    candidates: list[CorrectionMemoryOut] = []


# ── Rule categorizer ───────────────────────────────────────────────────────


class RuleOut(BaseModel):
    id: str
    name: str
    active: bool
    priority: int
    match_type: str
    merchant_patterns: list[str]
    description_patterns: list[str]
    category_code: str
    category_name: str
    confidence: float
    explanation: str


class RuleListOut(BaseModel):
    total: int
    items: list[RuleOut]


class RuleMatchOut(BaseModel):
    verdict: str  # "apply" | "conflict" | "none"
    reason: str
    merchant_text: str
    description_text: str
    rule: RuleOut | None = None
    candidates: list[RuleOut] = []
