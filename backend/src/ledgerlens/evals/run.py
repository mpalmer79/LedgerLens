import argparse
from collections.abc import Callable

from ledgerlens.categorizers.base import Categorizer
from ledgerlens.categorizers.stub import StubCategorizer
from ledgerlens.evals.harness import run_eval
from ledgerlens.evals.loader import load_dataset
from ledgerlens.evals.writer import write_run

CATEGORIZERS: dict[str, Callable[[], Categorizer]] = {
    "stub": StubCategorizer,
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
    args = parser.parse_args(argv)

    dataset = load_dataset(args.dataset)
    categorizer = CATEGORIZERS[args.categorizer]()
    result = run_eval(dataset, categorizer)
    path = write_run(result)

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
