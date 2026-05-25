"""Human-readable eval report generator.

Produces a markdown report summarizing categorization accuracy, safety,
coverage, confusion pairs, unmatched vendors, and cost efficiency.
Designed to be committed as `docs/EVAL_REPORT_CURRENT.md` after each
eval run so the improvement story is visible in git history.
"""

from __future__ import annotations

from datetime import UTC, datetime

from ledgerlens.categorizers.base import CategorizationResult
from ledgerlens.evals.metrics import (
    coverage_by_provider,
    enriched_confusion_pairs,
    overall_accuracy,
    routing_metrics,
    safety_metrics,
    unmatched_vendor_report,
)
from ledgerlens.evals.schemas import Transaction


def generate_eval_report(
    predictions: list[CategorizationResult],
    ground_truth: dict[str, str],
    transactions: list[Transaction],
    *,
    dataset_name: str = "v0",
    mode: str = "unknown",
    valid_codes: set[str] | None = None,
) -> str:
    """Generate a human-readable markdown eval report."""
    now = datetime.now(UTC).isoformat(timespec="seconds")
    accuracy = overall_accuracy(predictions, ground_truth)
    routing = routing_metrics(predictions, ground_truth, valid_codes=valid_codes)
    safety = safety_metrics(predictions, ground_truth, valid_codes=valid_codes)
    coverage = coverage_by_provider(predictions)
    top_confusions = enriched_confusion_pairs(
        predictions, ground_truth, valid_codes=valid_codes, top_n=10
    )
    top_unmatched = unmatched_vendor_report(predictions, ground_truth, transactions, top_n=10)

    lines: list[str] = []
    lines.append("# LedgerLens eval report")
    lines.append("")
    lines.append(f"Generated: {now}")
    lines.append(f"Dataset: {dataset_name}")
    lines.append(f"Mode: {mode}")
    lines.append(f"Total rows: {len(predictions)}")
    lines.append("")

    # ── Accuracy
    lines.append("## Accuracy")
    lines.append("")
    lines.append(f"- Overall accuracy: **{accuracy:.1%}**")
    lines.append(f"- Auto-approved accuracy: **{routing.get('auto_approved_accuracy', 0):.1%}**")
    lines.append("")
    lines.append(
        "> Raw accuracy reflects predictions vs ground truth on the eval "
        "dataset. It is NOT the same as product trust — product trust comes "
        "from the procedural verification pipeline (rules + memory + human "
        "review), not from raw model accuracy."
    )
    lines.append("")

    # ── Safety
    lines.append("## Safety")
    lines.append("")
    lines.append("| Metric | Count |")
    lines.append("|---|---:|")
    lines.append(f"| Correct finalized | {safety.get('correct_finalized', 0)} |")
    lines.append(f"| Incorrect finalized | {safety.get('incorrect_finalized', 0)} |")
    saved = safety.get("review_routing_saved_from_mistake", 0)
    lines.append(f"| Review routing saved from mistake | {saved} |")
    lines.append(
        f"| Dangerous auto-approval avoided | {safety.get('dangerous_auto_approval_avoided', 0)} |"
    )
    lines.append(f"| Finalized accuracy | {safety.get('finalized_accuracy', 0):.1%} |")
    lines.append("")

    # ── Coverage
    lines.append("## Coverage by provider")
    lines.append("")
    lines.append("| Provider | Count | % |")
    lines.append("|---|---:|---:|")
    by_provider = coverage.get("by_provider", {})
    if isinstance(by_provider, dict):
        for kind, data in by_provider.items():
            if isinstance(data, dict):
                count = data.get("count", 0)
                pct = data.get("percentage", 0)
                lines.append(f"| {kind} | {count} | {pct:.1%} |")
    lines.append("")
    lines.append(
        f"Zero-cost rows: {coverage.get('zero_cost_count', 0)} "
        f"({coverage.get('zero_cost_percentage', 0):.1%})"
    )
    lines.append("")

    # ── Routing
    lines.append("## Routing")
    lines.append("")
    lines.append("| Status | Count | Rate |")
    lines.append("|---|---:|---:|")
    lines.append(
        f"| Auto-approved | {routing.get('auto_approved', 0)} | "
        f"{routing.get('auto_approved_rate', 0):.1%} |"
    )
    lines.append(
        f"| Needs review | {routing.get('needs_review', 0)} | {routing.get('review_rate', 0):.1%} |"
    )
    lines.append(
        f"| Model called | {routing.get('model_called', 0)} | "
        f"{routing.get('model_called_rate', 0):.1%} |"
    )
    lines.append("")

    # ── Top confusion pairs
    if top_confusions:
        lines.append("## Top confusion pairs")
        lines.append("")
        lines.append("| Expected | Predicted | Count | Finalized | Review-routed |")
        lines.append("|---|---|---:|---:|---:|")
        for c in top_confusions:
            lines.append(
                f"| {c.get('actual', '?')} | {c.get('predicted', '?')} | "
                f"{c.get('count', 0)} | {c.get('finalized_count', 0)} | "
                f"{c.get('review_routed_count', 0)} |"
            )
        lines.append("")

    # ── Top unmatched vendors
    if top_unmatched:
        lines.append("## Top unmatched vendors (rule/memory gap candidates)")
        lines.append("")
        lines.append("| Vendor | Count | Expected category | Example |")
        lines.append("|---|---:|---|---|")
        for v in top_unmatched:
            lines.append(
                f"| {v.get('count', '?')} | {v.get('count', 0)} | "
                f"{v.get('expected_category', '?')} | "
                f"{str(v.get('example_description', ''))[:40]} |"
            )
        lines.append("")

    # ── Limitations
    lines.append("## Limitations")
    lines.append("")
    lines.append(
        "- Eval accuracy is bounded by COA mismatch: rules target the seed "
        "COA, but eval businesses have different COAs."
    )
    lines.append(
        "- Rules-only mode scores ~0% on eval businesses by methodology — "
        "this is not a rule-layer defect."
    )
    lines.append(
        "- Correction memory is not exercised in eval (no prior corrections "
        "exist in the eval dataset)."
    )
    lines.append("- Demo-stub mode produces zero-cost predictions at low accuracy.")
    lines.append("- This report does not claim production accounting correctness.")
    lines.append("")

    return "\n".join(lines)
