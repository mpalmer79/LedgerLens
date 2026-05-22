import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from ledgerlens.evals.loader import load_dataset

# Path to the v0 dataset, computed from this test file's location so the test
# works regardless of pytest's CWD and survives the package being installed
# into site-packages.
REPO_DATASETS_ROOT = Path(__file__).resolve().parents[3] / "evals" / "datasets"


def test_load_v0_dataset_succeeds() -> None:
    dataset = load_dataset("v0", datasets_root=REPO_DATASETS_ROOT)
    assert dataset.version == "v0"
    assert set(dataset.businesses) == {"coffee-shop", "design-agency", "auto-repair"}
    assert dataset.total_transactions == 302


def test_load_dataset_uses_explicit_datasets_root(tmp_path: Path) -> None:
    """Demonstrates the fix: loader resolves from the passed root, not from
    the package install location."""
    root = tmp_path / "datasets"
    v0 = root / "v0"
    v0.mkdir(parents=True)
    (v0 / "index.json").write_text(json.dumps({"version": "v0", "businesses": []}))

    dataset = load_dataset("v0", datasets_root=root)
    assert dataset.version == "v0"
    assert dataset.businesses == {}


def test_load_missing_version_raises_filenotfound(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_dataset("v999", datasets_root=tmp_path)


def test_invalid_category_code_raises_validation_error(tmp_path: Path) -> None:
    version_dir = tmp_path / "vbad"
    biz_dir = version_dir / "broken"
    biz_dir.mkdir(parents=True)

    index = {
        "version": "vbad",
        "businesses": [{"id": "broken"}],
    }
    business = {
        "id": "broken",
        "name": "Broken Co",
        "industry": "test",
        "description": "test fixture",
        "fiscal_year_start": "01-01",
    }
    chart = [
        {
            "code": "6010",
            "name": "Rent",
            "description": "Rent",
            "parent_code": None,
            "type": "expense",
        }
    ]
    txs = [
        {
            "id": "broken-tx-001",
            "date": "2025-07-01",
            "amount_cents": -1000,
            "raw_description": "TEST",
            "proposed_category_code": "9999",
            "label_confidence": "high",
            "is_adversarial": False,
            "reasoning": "test",
            "labeler_notes": None,
        }
    ]

    (version_dir / "index.json").write_text(json.dumps(index))
    (biz_dir / "business.json").write_text(json.dumps(business))
    (biz_dir / "chart_of_accounts.json").write_text(json.dumps(chart))
    (biz_dir / "transactions.json").write_text(json.dumps(txs))

    with pytest.raises(ValidationError) as exc:
        load_dataset("vbad", datasets_root=tmp_path)
    assert "9999" in str(exc.value) or "unknown account codes" in str(exc.value)
