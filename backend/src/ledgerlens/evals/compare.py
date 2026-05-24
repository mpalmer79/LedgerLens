"""Compare eval modes against the same dataset and emit a side-by-side report.

Reads existing committed run artifacts in `evals/runs/` (or whatever path is
passed as `--runs-dir`), picks the latest run per categorizer name, and writes
two output files at `evals/runs/YYYY-MM-DD-comparison.{json,md}`:

  * `*.json` — a machine-readable summary keyed by categorizer name.
  * `*.md`   — a reviewer-readable Markdown report with the same data plus
               honest framing for the rules-only / hybrid-vs-tenant-COA story.

This script does *not* run categorizers. It assumes you've already produced
the per-mode runs via `python -m ledgerlens.evals.run --categorizer <name>`.
That keeps the comparison cheap and reproducible — re-running it never costs
model dollars.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RunSummary:
    filename: str
    categorizer: str
    timestamp_utc: str
    transactions: int
    overall_accuracy: float
    non_adversarial_accuracy: float
    adversarial_accuracy: float
    cost_per_100: float
    p95_latency_ms: float
    routing: dict[str, Any]
    calibration: dict[str, Any]
    mapping: dict[str, Any]


def _coerce_run(path: Path) -> RunSummary | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    try:
        meta = data["run_metadata"]
        m = data["metrics"]
        overall = m["overall"]
        non_adv = m["non_adversarial"]
        adv = m["adversarial"]
        return RunSummary(
            filename=path.name,
            categorizer=meta["categorizer_name"],
            timestamp_utc=meta["timestamp_utc"],
            transactions=int(overall["transaction_count"]),
            overall_accuracy=float(overall["accuracy"]),
            non_adversarial_accuracy=float(non_adv["accuracy"]),
            adversarial_accuracy=float(adv["accuracy"]),
            cost_per_100=float(overall["cost_per_100"]),
            p95_latency_ms=float(overall.get("latency_stats", {}).get("p95_ms", 0.0)),
            routing=overall.get("routing", {}),
            calibration=overall.get("calibration", {}),
            mapping=overall.get("mapping", {}),
        )
    except (KeyError, ValueError, TypeError):
        return None


def collect_latest(runs_dir: Path) -> list[RunSummary]:
    """Return one summary per distinct categorizer, picking the newest run for each."""
    best: dict[str, RunSummary] = {}
    for path in sorted(runs_dir.glob("*.json")):
        summary = _coerce_run(path)
        if summary is None:
            continue
        existing = best.get(summary.categorizer)
        if existing is None or summary.timestamp_utc > existing.timestamp_utc:
            best[summary.categorizer] = summary
    return sorted(best.values(), key=lambda s: s.categorizer)


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def _money(value: float) -> str:
    return f"${value:.4f}"


def _format_routing_cell(routing: dict[str, Any]) -> str:
    if not routing:
        return "—"
    auto = routing.get("auto_approved_rate", 0.0)
    auto_acc = routing.get("auto_approved_accuracy", 0.0)
    review = routing.get("review_rate", 0.0)
    return f"auto {_pct(float(auto))} @ {_pct(float(auto_acc))} acc · review {_pct(float(review))}"


def _format_calibration_cell(calibration: dict[str, Any]) -> str:
    if not calibration:
        return "—"
    model = calibration.get("model_only") or {}
    if not model or int(model.get("count", 0)) == 0:
        return "no model calls"
    return f"ECE {float(model.get('ece', 0.0)):.3f} · MCE {float(model.get('mce', 0.0)):.3f}"


def _format_mapping_cell(mapping: dict[str, Any]) -> str:
    """Compact mapping-outcome cell for the comparison markdown table."""
    if not mapping or not mapping.get("enabled"):
        return "—"
    mapped = int(mapping.get("mapped_intent_count", 0))
    fallback = int(mapping.get("fallback_to_default_count", 0))
    review = int(mapping.get("routed_to_review_count", 0))
    return f"mapped {mapped} · fallback {fallback} · review {review}"


COA_CAVEAT = (
    "Rules are tenant-specific. The `rules-only` (generic) baseline targets "
    "the default seed chart of accounts, while the three synthetic eval "
    "businesses each use their own COA numbering. The `rules-only-mapped` "
    "mode resolves each rule's intent through a per-business map "
    "(see `ledgerlens.data.business_rule_maps`) and produces non-zero "
    "accuracy on the auto-repair eval slice where a curated map exists. "
    "Coffee-shop and design-agency still fall back to the generic "
    "intent map and show modest improvement. The deeper value of the rule "
    "layer in production is cost reduction (zero model spend on matched "
    "rows), not raw accuracy on this synthetic benchmark."
)


def render_json(summaries: Iterable[RunSummary]) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "runs": [
            {
                "categorizer": s.categorizer,
                "filename": s.filename,
                "timestamp_utc": s.timestamp_utc,
                "transactions": s.transactions,
                "overall_accuracy": s.overall_accuracy,
                "non_adversarial_accuracy": s.non_adversarial_accuracy,
                "adversarial_accuracy": s.adversarial_accuracy,
                "cost_per_100": s.cost_per_100,
                "p95_latency_ms": s.p95_latency_ms,
                "routing": s.routing,
                "calibration": s.calibration,
                "mapping": s.mapping,
            }
            for s in summaries
        ],
        "notes": [COA_CAVEAT],
    }


def render_markdown(summaries: list[RunSummary]) -> str:
    lines = [
        "# LedgerLens eval comparison",
        "",
        f"Generated {datetime.now(UTC).isoformat(timespec='seconds')}.",
        "",
        "Pipeline order in production: **correction memory → deterministic rules → "
        "model fallback → confidence routing → human review → audit.** Each row "
        "below is a single eval mode; the hybrid mode mirrors the layered pipeline "
        "minus correction memory (memory simulation is a separate run).",
        "",
        (
            "| Categorizer | Tx | Overall | Non-adv | Adversarial | Cost / 100 "
            "| p95 (ms) | Routing | Model calibration | Mapping |"
        ),
        "|---|---:|---:|---:|---:|---:|---:|---|---|---|",
    ]
    for s in summaries:
        lines.append(
            "| "
            + " | ".join(
                [
                    s.categorizer,
                    str(s.transactions),
                    _pct(s.overall_accuracy),
                    _pct(s.non_adversarial_accuracy),
                    _pct(s.adversarial_accuracy),
                    _money(s.cost_per_100),
                    f"{s.p95_latency_ms:.0f}",
                    _format_routing_cell(s.routing),
                    _format_calibration_cell(s.calibration),
                    _format_mapping_cell(s.mapping),
                ]
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "## Honest framing",
            "",
            f"- {COA_CAVEAT}",
            "- **Auto-approved accuracy matters more than overall accuracy.** That's "
            "the column reviewers should optimise — predictions that would be "
            "posted to the books without a human looking.",
            "- **Review rate is a cost lever, not a quality lever.** A 100% "
            "auto-approve rate at 50% accuracy is worse than a 50% auto-approve "
            "rate at 95% accuracy.",
            "- **Deterministic confidence is not a probability.** Rule "
            "predictions report the rule's curated confidence (e.g. 0.95 for "
            "Adobe), not a model probability. Calibration is reported "
            "separately for model-only and deterministic predictions.",
            "",
            "## What this report does NOT show",
            "",
            "- Per-tenant intent maps for every eval business. Only the "
            "auto-repair business has a curated map today; coffee-shop and "
            "design-agency mapped runs fall back to the generic seed-COA map.",
            "- Confidence calibration after temperature scaling / Platt scaling. "
            "Raw model probabilities only.",
            "- Real correction-memory hit rates from a production stream. The "
            "memory hybrid mode uses a simulated train/test split (deterministic "
            "seed, no leakage), which is a lower bound on real-world coverage.",
            "",
        ]
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ledgerlens.evals.compare")
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=Path("evals/runs"),
        help="Directory containing per-mode run artifacts (default: ./evals/runs)",
    )
    parser.add_argument(
        "--out-prefix",
        type=str,
        default=None,
        help="Output filename stem (default: YYYY-MM-DD-comparison)",
    )
    args = parser.parse_args(argv)

    runs_dir: Path = args.runs_dir
    if not runs_dir.exists():
        parser.error(f"runs directory not found: {runs_dir}")

    summaries = collect_latest(runs_dir)
    if not summaries:
        parser.error(f"no readable run artifacts in {runs_dir}")

    stem = args.out_prefix or f"{date.today().isoformat()}-comparison"
    json_path = runs_dir / f"{stem}.json"
    md_path = runs_dir / f"{stem}.md"
    json_path.write_text(json.dumps(render_json(summaries), indent=2), encoding="utf-8")
    md_path.write_text(render_markdown(summaries), encoding="utf-8")

    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Modes compared: {', '.join(s.categorizer for s in summaries)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
