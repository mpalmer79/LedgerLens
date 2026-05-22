import json
from pathlib import Path

from ledgerlens.evals.schemas import Account, Business, BusinessData, Dataset, Transaction


def _default_datasets_root() -> Path:
    """Default datasets root, resolved from the current working directory.

    Returns `<cwd>/evals/datasets`. This is correct when running from the repo
    root and incorrect when running from anywhere else; callers that need a
    different location must pass `datasets_root` explicitly. Resolving from
    `__file__` was attempted previously but broke once the package was
    installed via `pip install .` into site-packages, where the walk-up no
    longer reaches the repo root.
    """
    return Path.cwd() / "evals" / "datasets"


def load_dataset(version: str, datasets_root: Path | None = None) -> Dataset:
    """Load a versioned eval dataset from disk.

    Reads `<datasets_root>/<version>/index.json`, iterates each business directory,
    loads `business.json`, `chart_of_accounts.json`, and `transactions.json`, and
    constructs a validated `Dataset`. Raises FileNotFoundError if the version
    directory does not exist. Pydantic raises ValidationError if any file fails
    schema validation, including the referential-integrity check that every
    transaction's proposed_category_code maps to a real account.
    """
    root = datasets_root or _default_datasets_root()
    version_dir = root / version
    if not version_dir.is_dir():
        raise FileNotFoundError(f"Dataset version not found: {version_dir}")

    index_path = version_dir / "index.json"
    if not index_path.is_file():
        raise FileNotFoundError(f"Dataset index missing: {index_path}")

    with index_path.open() as f:
        index = json.load(f)

    businesses: dict[str, BusinessData] = {}
    for entry in index["businesses"]:
        biz_id = entry["id"]
        biz_dir = version_dir / biz_id
        with (biz_dir / "business.json").open() as f:
            business = Business.model_validate(json.load(f))
        with (biz_dir / "chart_of_accounts.json").open() as f:
            chart = [Account.model_validate(a) for a in json.load(f)]
        with (biz_dir / "transactions.json").open() as f:
            txs = [Transaction.model_validate(t) for t in json.load(f)]
        businesses[biz_id] = BusinessData(
            business=business,
            chart_of_accounts=chart,
            transactions=txs,
        )

    return Dataset(version=index["version"], businesses=businesses)
