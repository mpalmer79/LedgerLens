import argparse
from collections.abc import Callable
from pathlib import Path

from ledgerlens.categorizers.base import Categorizer
from ledgerlens.categorizers.claude_haiku import (
    ClaudeHaikuCategorizer,
    build_client_from_settings,
)
from ledgerlens.categorizers.hybrid import HybridRulesModelCategorizer
from ledgerlens.categorizers.rules import RuleOnlyCategorizer
from ledgerlens.categorizers.stub import StubCategorizer
from ledgerlens.evals.harness import run_eval
from ledgerlens.evals.loader import load_dataset
from ledgerlens.evals.writer import write_run


def _build_haiku() -> Categorizer:
    return ClaudeHaikuCategorizer(client=build_client_from_settings())


def _build_hybrid() -> Categorizer:
    return HybridRulesModelCategorizer(model=_build_haiku())


def _build_rules_only_mapped() -> Categorizer:
    """rules-only with per-business intent mapping enabled. The active
    business mapping is resolved per-dataset from
    `categorizers.rules.EVAL_BUSINESS_MAP_IDS`."""
    return RuleOnlyCategorizer(use_business_mapping=True)


def _build_hybrid_mapped() -> Categorizer:
    """Hybrid (rules → model) with per-business intent mapping enabled on
    the rule layer."""
    return HybridRulesModelCategorizer(model=_build_haiku(), use_business_mapping=True)


CATEGORIZERS: dict[str, Callable[[], Categorizer]] = {
    "stub": StubCategorizer,
    "rules-only": RuleOnlyCategorizer,  # generic baseline (rules' own codes)
    "rules-only-mapped": _build_rules_only_mapped,
    "claude-haiku-v1": _build_haiku,
    "hybrid-rules-model": _build_hybrid,  # generic baseline (rules' own codes)
    "hybrid-rules-model-mapped": _build_hybrid_mapped,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ledgerlens.evals.run")
    parser.add_argument("--dataset", default="v0", help="Dataset version (default: v0)")
    parser.add_argument(
        "--categorizer",
        default="stub",
        choices=sorted(CATEGORIZERS),
        help="Categorizer to run (default: stub)",
    )
    parser.add_argument(
        "--datasets-root",
        type=Path,
        default=None,
        help="Path to evals/datasets directory (default: ./evals/datasets relative to CWD)",
    )
    parser.add_argument(
        "--runs-dir",
        type=Path,
        default=None,
        help="Path to evals/runs directory (default: ./evals/runs relative to CWD)",
    )
    args = parser.parse_args(argv)

    dataset = load_dataset(args.dataset, datasets_root=args.datasets_root)
    categorizer = CATEGORIZERS[args.categorizer]()
    result = run_eval(dataset, categorizer)
    path = write_run(result, runs_dir=args.runs_dir)

    m = result.metrics
    print(f"Dataset:           {args.dataset}")
    print(f"Categorizer:       {result.run_metadata.categorizer_name}")
    print(f"Transactions:      {m.overall.transaction_count}")
    print(f"Overall accuracy:  {m.overall.accuracy:.4f}")
    print(f"Non-adv accuracy:  {m.non_adversarial.accuracy:.4f}")
    print(f"Adversarial accuracy: {m.adversarial.accuracy:.4f}")
    print(f"Cost per 100:      ${m.overall.cost_per_100:.4f}")
    print(f"Latency p95 (ms):  {m.overall.latency_stats['p95_ms']:.2f}")
    print(f"Written:           {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
