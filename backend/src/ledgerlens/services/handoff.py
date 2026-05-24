"""Accountant handoff report.

Derives the small-business cleanup summary entirely from existing tables:
Transaction, CategorizationResult, ReviewDecision, CorrectionMemory,
LedgerTrust. No new persistence — the handoff is a *view*, not state.

Three honesty rules baked in here:

1. Time-saved is an *estimate*, not a financial claim. The per-row
   minutes assigned are deliberately conservative (1.5 for a
   deterministic auto-approval, 2.0 for a correction-memory replay).
   The frontend labels the result as an estimate.
2. A row is "ready for accountant" only when it passes the same
   `_is_verified` test the trust panel uses on `/ledger`.
3. Owner answers are read out of the existing `reviewer_note` field;
   the questions workflow captures the owner's plain-English answer
   there and the handoff surfaces it untouched.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from ledgerlens.api.ledger import _build_rows, _compute_trust, _is_verified
from ledgerlens.api.schemas import (
    CleanupImpact,
    CorrectionMemoryOut,
    HandoffOut,
    HandoffOwnerAnswer,
    LedgerRow,
)
from ledgerlens.models import CorrectionMemory, ReviewDecision
from ledgerlens.repositories import CategoryRepo, TransactionRepo

# Conservative cleanup-time estimates. Surfaced as estimates in the UI.
MINUTES_SAVED_PER_DETERMINISTIC = 1.5
MINUTES_SAVED_PER_MEMORY_REPLAY = 2.0


def _cleanup_period_label(rows: list[LedgerRow]) -> str:
    """A short human label for the date range the handoff covers.

    Falls back to "this month" when the database has no transactions
    yet (typical empty-DB demo case)."""
    if not rows:
        today = date.today()
        return today.strftime("%B %Y")
    dates = [r.transaction_date for r in rows]
    first, last = min(dates), max(dates)
    if first.year == last.year and first.month == last.month:
        return first.strftime("%B %Y")
    return f"{first.isoformat()} – {last.isoformat()}"


def _impact(rows: list[LedgerRow], corrections_learned_count: int) -> CleanupImpact:
    handled_by_rules_or_memory = sum(
        1 for r in rows if (r.model_provider or "") in {"correction_memory", "rule_categorizer"}
    )
    handled_by_memory = sum(1 for r in rows if (r.model_provider or "") == "correction_memory")
    routed_to_review = sum(1 for r in rows if r.categorization_status == "needs_review")
    minutes = (
        handled_by_rules_or_memory - handled_by_memory
    ) * MINUTES_SAVED_PER_DETERMINISTIC + handled_by_memory * MINUTES_SAVED_PER_MEMORY_REPLAY
    return CleanupImpact(
        transactions_imported=len(rows),
        handled_by_rules_or_memory=handled_by_rules_or_memory,
        handled_by_correction_memory=handled_by_memory,
        routed_to_review=routed_to_review,
        corrections_learned=corrections_learned_count,
        estimated_minutes_saved=round(minutes, 1),
    )


def _owner_answers(db: Session) -> list[HandoffOwnerAnswer]:
    """Surface review decisions that carry a reviewer note.

    The `/questions` flow stores the owner's plain-English answer as the
    `reviewer_note` text on the resulting ReviewDecision row. Anything
    without a note is omitted — accountants only need the explanations.
    """
    tx_repo = TransactionRepo(db)
    cat_repo = CategoryRepo(db)
    decisions: list[ReviewDecision] = (
        db.query(ReviewDecision)
        .filter(ReviewDecision.reviewer_note.isnot(None))
        .order_by(ReviewDecision.created_at.desc())
        .limit(200)
        .all()
    )
    answers: list[HandoffOwnerAnswer] = []
    for d in decisions:
        if not d.reviewer_note or not d.reviewer_note.strip():
            continue
        tx = tx_repo.get(d.transaction_id)
        if tx is None:
            continue
        cat_name: str | None = None
        if d.selected_category_code:
            cat = cat_repo.get(d.selected_category_code)
            cat_name = cat.name if cat else None
        answers.append(
            HandoffOwnerAnswer(
                transaction_id=d.transaction_id,
                transaction_description=tx.description,
                answer=d.reviewer_note,
                selected_category_code=d.selected_category_code,
                selected_category_name=cat_name,
                reviewer_action=str(d.reviewer_action.value)
                if hasattr(d.reviewer_action, "value")
                else str(d.reviewer_action),
            )
        )
    return answers


def _recent_corrections(db: Session, limit: int = 100) -> list[CorrectionMemory]:
    return (
        db.query(CorrectionMemory)
        .filter(CorrectionMemory.active.is_(True))
        .order_by(CorrectionMemory.created_at.desc())
        .limit(limit)
        .all()
    )


def build_handoff(db: Session) -> HandoffOut:
    """Assemble the handoff report from current persisted state."""
    rows = _build_rows(db)
    trust = _compute_trust(rows)

    ready = [r for r in rows if _is_verified(r)]
    needs_review = [r for r in rows if r.categorization_status == "needs_review"]

    answers = _owner_answers(db)
    corrections = _recent_corrections(db)
    corrections_out = [CorrectionMemoryOut.model_validate(c) for c in corrections]

    return HandoffOut(
        generated_at=datetime.now(UTC),
        cleanup_period_label=_cleanup_period_label(rows),
        trust=trust,
        impact=_impact(rows, corrections_learned_count=len(corrections_out)),
        ready_for_accountant=ready,
        needs_review=needs_review,
        owner_answers=answers,
        corrections_learned=corrections_out,
    )


def render_markdown(handoff: HandoffOut) -> str:
    """Render the handoff as a single markdown document an owner can paste."""
    out: list[str] = []
    out.append("# LedgerLens — accountant handoff package")
    out.append("")
    out.append(f"**Period:** {handoff.cleanup_period_label}")
    out.append(f"**Generated:** {handoff.generated_at.isoformat(timespec='seconds')}")
    out.append("")
    out.append("## Cleanup summary")
    out.append("")
    t, i = handoff.trust, handoff.impact
    out.append(f"- Transactions imported: **{i.transactions_imported}**")
    out.append(f"- Finalized rows: **{t.finalized_count}**")
    out.append(
        f"- Verified rows: **{t.verified_count}** "
        f"({t.verification_rate * 100:.0f}%) — *workflow-level, not raw model accuracy*"
    )
    out.append(
        f"- Unverified finalized rows: **{t.unverified_finalized_count}** "
        "— review before treating as final"
    )
    out.append(f"- Review-required: **{t.review_required_count}**")
    out.append(f"- Handled deterministically (rules / memory): **{t.deterministic_count}**")
    out.append(f"- Human-reviewed: **{t.human_reviewed_count}**")
    out.append(f"- Corrections learned this month: **{i.corrections_learned}**")
    out.append(
        f"- Estimated owner time saved: **~{int(round(i.estimated_minutes_saved))} min** "
        "_(estimate; see methodology in `docs/SMALL_BUSINESS_VALUE_AUDIT.md`)_"
    )
    out.append("")

    out.append("## Ready for accountant")
    out.append("")
    if not handoff.ready_for_accountant:
        out.append("_No finalized verified rows yet._")
    else:
        out.append("| Date | Description | Amount | Category | Source |")
        out.append("|---|---|---:|---|---|")
        for r in handoff.ready_for_accountant:
            cat = f"[{r.category_code}] {r.category_name}" if r.category_code else "—"
            amount = f"{r.amount_cents / 100:.2f} {r.currency}"
            source = r.model_provider or "—"
            out.append(f"| {r.transaction_date} | {r.description} | {amount} | {cat} | {source} |")
    out.append("")

    out.append("## Needs owner / accountant review")
    out.append("")
    if not handoff.needs_review:
        out.append("_No outstanding review items. Nothing blocking finalization._")
    else:
        out.append("| Date | Description | Amount | Predicted | Reason |")
        out.append("|---|---|---:|---|---|")
        for r in handoff.needs_review:
            cat = f"[{r.category_code}] {r.category_name}" if r.category_code else "—"
            amount = f"{r.amount_cents / 100:.2f} {r.currency}"
            status = r.categorization_status
            out.append(f"| {r.transaction_date} | {r.description} | {amount} | {cat} | {status} |")
    out.append("")

    out.append("## Questions answered by owner")
    out.append("")
    if not handoff.owner_answers:
        out.append("_No owner notes captured this period._")
    else:
        for a in handoff.owner_answers:
            cat = (
                f" → [{a.selected_category_code}] {a.selected_category_name}"
                if a.selected_category_code
                else ""
            )
            out.append(f"- **{a.transaction_description}** ({a.reviewer_action}{cat}): {a.answer}")
    out.append("")

    out.append("## Corrections learned this month")
    out.append("")
    if not handoff.corrections_learned:
        out.append("_No new correction-memory rules saved this period._")
    else:
        for c in handoff.corrections_learned:
            out.append(
                f"- `{c.merchant_key or '—'}` → **[{c.selected_category_code}]** "
                f"({c.match_count} matches so far)"
            )
    out.append("")

    out.append("## Notes for the accountant")
    out.append("")
    out.append(
        "- Trust metric is workflow-level: a row is counted as verified only when "
        "it came through a rule auto-approval, a correction-memory replay, or an "
        "explicit human review. Raw model accuracy is reported separately on "
        "`/evals`; it is not the trust boundary for the handoff."
    )
    out.append(
        "- Estimated owner time saved is a conservative figure (1.5 min per "
        "deterministic auto-approval, 2.0 min per memory replay). It is not a "
        "financial guarantee."
    )
    out.append("")
    return "\n".join(out)
