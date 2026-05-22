import json
from datetime import UTC, datetime
from pathlib import Path

from ledgerlens.evals.harness import RunResult


def _default_runs_dir() -> Path:
    return Path(__file__).resolve().parents[4] / "evals" / "runs"


def _today_utc() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def write_run(run_result: RunResult, runs_dir: Path | None = None) -> Path:
    """Serialize a RunResult to a timestamped JSON file under `runs_dir`.

    Filename pattern: `YYYY-MM-DD-<categorizer_name>.json`. If a file with that
    name already exists, suffixes `-2`, `-3`, ... are appended until a free name
    is found. Returns the path written.
    """
    target_dir = runs_dir or _default_runs_dir()
    target_dir.mkdir(parents=True, exist_ok=True)

    base = f"{_today_utc()}-{run_result.run_metadata.categorizer_name}"
    candidate = target_dir / f"{base}.json"
    counter = 2
    while candidate.exists():
        candidate = target_dir / f"{base}-{counter}.json"
        counter += 1

    with candidate.open("w") as f:
        json.dump(run_result.model_dump(mode="json"), f, indent=2)
        f.write("\n")
    return candidate
