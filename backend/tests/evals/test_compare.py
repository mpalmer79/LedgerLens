"""Smoke + correctness tests for the eval comparison report generator."""

from __future__ import annotations

import json
from pathlib import Path

from ledgerlens.evals import compare


def _write_run(
    dir_: Path,
    *,
    filename: str,
    categorizer: str,
    timestamp: str,
    accuracy: float,
    cost_per_100: float = 0.0,
    routing: dict[str, object] | None = None,
    calibration: dict[str, object] | None = None,
) -> None:
    payload = {
        "run_metadata": {
            "dataset_version": "v0",
            "categorizer_name": categorizer,
            "model": None,
            "timestamp_utc": timestamp,
            "git_sha": None,
        },
        "metrics": {
            "overall": {
                "accuracy": accuracy,
                "per_category": {},
                "reliability_diagram": [],
                "latency_stats": {"p50_ms": 0.0, "p95_ms": 12.0, "mean_ms": 0.0},
                "total_cost": 0.0,
                "cost_per_100": cost_per_100,
                "transaction_count": 100,
                "routing": routing or {},
                "calibration": calibration or {},
            },
            "non_adversarial": {
                "accuracy": accuracy,
                "per_category": {},
                "reliability_diagram": [],
                "latency_stats": {"p50_ms": 0.0, "p95_ms": 0.0, "mean_ms": 0.0},
                "total_cost": 0.0,
                "cost_per_100": cost_per_100,
                "transaction_count": 90,
            },
            "adversarial": {
                "accuracy": accuracy,
                "per_category": {},
                "reliability_diagram": [],
                "latency_stats": {"p50_ms": 0.0, "p95_ms": 0.0, "mean_ms": 0.0},
                "total_cost": 0.0,
                "cost_per_100": cost_per_100,
                "transaction_count": 10,
            },
        },
        "predictions": [],
    }
    (dir_ / filename).write_text(json.dumps(payload), encoding="utf-8")


def test_collect_latest_picks_newest_per_categorizer(tmp_path: Path) -> None:
    _write_run(
        tmp_path,
        filename="2026-05-22-claude-haiku-v1.json",
        categorizer="claude-haiku-v1",
        timestamp="2026-05-22T12:00:00+00:00",
        accuracy=0.6,
    )
    _write_run(
        tmp_path,
        filename="2026-05-23-claude-haiku-v1.json",
        categorizer="claude-haiku-v1",
        timestamp="2026-05-23T12:00:00+00:00",
        accuracy=0.7,
    )
    _write_run(
        tmp_path,
        filename="2026-05-23-stub-v1.json",
        categorizer="stub-v1",
        timestamp="2026-05-23T12:00:00+00:00",
        accuracy=0.1,
    )
    summaries = compare.collect_latest(tmp_path)
    by_name = {s.categorizer: s for s in summaries}
    assert set(by_name) == {"claude-haiku-v1", "stub-v1"}
    # Newest haiku run wins.
    assert by_name["claude-haiku-v1"].overall_accuracy == 0.7


def test_render_markdown_includes_honesty_section(tmp_path: Path) -> None:
    _write_run(
        tmp_path,
        filename="2026-05-23-rule-categorizer-v1.json",
        categorizer="rule-categorizer-v1",
        timestamp="2026-05-23T12:00:00+00:00",
        accuracy=0.0,
        routing={
            "auto_approved_rate": 0.1,
            "auto_approved_accuracy": 0.0,
            "review_rate": 0.2,
        },
    )
    _write_run(
        tmp_path,
        filename="2026-05-23-claude-haiku-v1.json",
        categorizer="claude-haiku-v1",
        timestamp="2026-05-23T12:00:00+00:00",
        accuracy=0.63,
        cost_per_100=0.34,
        calibration={
            "model_only": {"count": 200, "ece": 0.07, "mce": 0.18, "warning": None},
        },
    )
    summaries = compare.collect_latest(tmp_path)
    md = compare.render_markdown(summaries)
    # Headers and honesty sections present.
    assert "# LedgerLens eval comparison" in md
    assert "Honest framing" in md
    assert "tenant-specific" in md.lower()
    # Each mode appears.
    assert "rule-categorizer-v1" in md
    assert "claude-haiku-v1" in md
    # Routing column rendered when present.
    assert "auto 10.0%" in md
    # Model calibration cell rendered.
    assert "ECE 0.070" in md


def test_main_writes_both_artifacts(tmp_path: Path, capsys) -> None:  # type: ignore[no-untyped-def]
    _write_run(
        tmp_path,
        filename="2026-05-23-stub-v1.json",
        categorizer="stub-v1",
        timestamp="2026-05-23T12:00:00+00:00",
        accuracy=0.1,
    )
    rc = compare.main(["--runs-dir", str(tmp_path), "--out-prefix", "report"])
    assert rc == 0
    assert (tmp_path / "report.json").is_file()
    assert (tmp_path / "report.md").is_file()
    payload = json.loads((tmp_path / "report.json").read_text())
    assert "runs" in payload and payload["runs"][0]["categorizer"] == "stub-v1"
