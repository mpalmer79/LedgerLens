from ledgerlens.categorizers.stub import StubCategorizer
from ledgerlens.evals.harness import run_eval
from ledgerlens.evals.loader import load_dataset


def test_stub_harness_runs_end_to_end() -> None:
    dataset = load_dataset("v0")
    result = run_eval(dataset, StubCategorizer())

    assert len(result.predictions) == dataset.total_transactions == 302

    expected_count = result.metrics.overall.transaction_count
    assert expected_count == 302
    assert (
        result.metrics.non_adversarial.transaction_count
        + result.metrics.adversarial.transaction_count
        == expected_count
    )

    for slice_name in ("overall", "non_adversarial", "adversarial"):
        slice_obj = getattr(result.metrics, slice_name)
        assert 0.0 <= slice_obj.accuracy <= 1.0
        assert isinstance(slice_obj.reliability_diagram, list)
        assert "p50_ms" in slice_obj.latency_stats


def test_stub_accuracy_is_low_but_nonzero() -> None:
    dataset = load_dataset("v0")
    result = run_eval(dataset, StubCategorizer())
    # The stub always returns each business's first expense account (6010 in all
    # three businesses' charts of accounts). That happens to be rent in all
    # three, so accuracy is bounded by the share of rent transactions — well
    # under 20% across the full dataset.
    assert 0.0 <= result.metrics.overall.accuracy <= 0.20
    assert result.metrics.overall.accuracy > 0.0
