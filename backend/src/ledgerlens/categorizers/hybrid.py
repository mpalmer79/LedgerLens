"""Hybrid categorizers for the eval harness.

Two flavours, both implement the eval-side `Categorizer` protocol:

- `HybridRulesModelCategorizer` — apply the deterministic rule layer first.
  On strong rule match (confidence >= auto threshold AND no rule conflict),
  return the rule result at zero cost. Otherwise fall through to the model.
- `HybridMemoryRulesModelCategorizer` — same as above, plus a simulated
  correction-memory layer seeded from a *training* subset of the dataset.
  The eval is then run on the held-out test subset. The memory is keyed by
  the same `(merchant, normalized_description)` rules as production, with
  the same generic-merchant blocklist, but the "human correction" labels
  are the training set's ground-truth labels. This avoids label leakage
  *into* the test set while still measuring how much of the categorisation
  load correction memory would carry on a realistic stream of transactions.

These categorizers are eval-only. The production pipeline is in
`services/categorize.py` and uses the database-backed memory + rule layers
directly.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from ledgerlens.categorizers.base import CategorizationResult, Categorizer
from ledgerlens.categorizers.rules import RuleOnlyCategorizer
from ledgerlens.evals.schemas import Account, Business
from ledgerlens.evals.schemas import Transaction as EvalTransaction
from ledgerlens.services.correction_memory import (
    GENERIC_MERCHANT_TOKENS,
    MIN_DESCRIPTION_KEY_LEN,
    MIN_MERCHANT_KEY_LEN,
)

# ── Hybrid: rules → model ─────────────────────────────────────────────────


class HybridRulesModelCategorizer:
    """Deterministic rules first, then the model.

    A rule prediction is used (and the model is NOT called) iff the rule's
    confidence is at least `auto_threshold`. Anything else falls through to
    the model — that mirrors the production behaviour where a below-auto
    rule routes to review and we don't auto-apply.

    `use_business_mapping=True` swaps the inner rules categorizer for one
    that resolves rule intents through the active business's rule map. The
    hybrid name flips to `hybrid-rules-model-mapped-v1` so eval artifacts
    are labelled distinctly.
    """

    def __init__(
        self,
        model: Categorizer,
        *,
        rules: RuleOnlyCategorizer | None = None,
        auto_threshold: float = 0.9,
        use_business_mapping: bool = False,
    ) -> None:
        self._model = model
        if rules is not None:
            self._rules = rules
        else:
            self._rules = RuleOnlyCategorizer(use_business_mapping=use_business_mapping)
        self._auto_threshold = auto_threshold
        self.use_business_mapping = use_business_mapping
        self.name = (
            "hybrid-rules-model-mapped-v1" if use_business_mapping else "hybrid-rules-model-v1"
        )

    def categorize(
        self,
        transaction: EvalTransaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        rule_pred = self._rules.categorize(transaction, business, chart_of_accounts)
        if (
            rule_pred.predicted_category_code != "UNCATEGORIZABLE"
            and rule_pred.confidence >= self._auto_threshold
        ):
            return rule_pred
        return self._model.categorize(transaction, business, chart_of_accounts)


# ── Hybrid: memory + rules → model ────────────────────────────────────────


def _merchant_key(raw_description: str) -> str:
    """Best-effort merchant token mirroring `services/correction_memory.build_merchant_key`."""
    first = (raw_description or "").strip().split(" ", 1)[0]
    return first.upper()


def _description_key(raw_description: str) -> str:
    return (raw_description or "").strip().upper()


def _is_safe_anchor(merchant: str, description: str) -> bool:
    if merchant:
        if len(merchant) < MIN_MERCHANT_KEY_LEN:
            return False
        if merchant in GENERIC_MERCHANT_TOKENS:
            return False
        tokens = set(merchant.split())
        if tokens and tokens.issubset(GENERIC_MERCHANT_TOKENS):
            return False
        return True
    return len(description) >= MIN_DESCRIPTION_KEY_LEN


@dataclass
class _MemoryEntry:
    code: str
    source_tx_id: str


def _build_simulated_memory(
    training: list[EvalTransaction],
) -> tuple[dict[tuple[str, str], set[str]], dict[tuple[str, str], _MemoryEntry]]:
    """Synthesise a CorrectionMemory-like table from a training partition.

    Returns `(conflicts, memory)`:
      * `memory[(merchant_key, description_key)]` → most recent training entry
        for that key. The key matches if at least one component is non-empty
        and safe.
      * `conflicts[(merchant_key, description_key)]` → set of distinct codes
        we've seen for that key. When |conflicts| > 1 the production system
        would route to review; the simulator does the same by leaving the
        memory unused on lookup.
    """
    memory: dict[tuple[str, str], _MemoryEntry] = {}
    conflicts: dict[tuple[str, str], set[str]] = {}
    for tx in training:
        m = _merchant_key(tx.raw_description)
        d = _description_key(tx.raw_description)
        if not _is_safe_anchor(m, d):
            continue
        key = (m, d)
        memory[key] = _MemoryEntry(code=tx.proposed_category_code, source_tx_id=tx.id)
        conflicts.setdefault(key, set()).add(tx.proposed_category_code)
    return conflicts, memory


def _lookup_simulated_memory(
    tx: EvalTransaction,
    conflicts: dict[tuple[str, str], set[str]],
    memory: dict[tuple[str, str], _MemoryEntry],
) -> _MemoryEntry | None:
    m = _merchant_key(tx.raw_description)
    d = _description_key(tx.raw_description)
    if not _is_safe_anchor(m, d):
        return None
    # Try merchant-key match first (covers any description with the same merchant).
    for (mk, _dk), entry in memory.items():
        if mk == m and len(conflicts.get((mk, _dk), set())) == 1:
            return entry
    # Fall back to description-key match.
    for (_mk, dk), entry in memory.items():
        if dk == d and len(conflicts.get((_mk, dk), set())) == 1:
            return entry
    return None


class HybridMemoryRulesModelCategorizer:
    """memory → rules → model, with simulated memory.

    Build the simulated memory once from `training_transactions`; categorise
    on a separate test-time stream. The simulator deliberately ignores any
    transaction id present in the training set's id list (to make label
    leakage detectable in tests) — callers should make sure the training and
    test partitions are disjoint by id.
    """

    name = "hybrid-memory-rules-model-v1"

    def __init__(
        self,
        model: Categorizer,
        training_transactions: list[EvalTransaction],
        *,
        rules: RuleOnlyCategorizer | None = None,
        auto_threshold: float = 0.9,
    ) -> None:
        self._rules_model = HybridRulesModelCategorizer(
            model, rules=rules, auto_threshold=auto_threshold
        )
        self._training_ids = {tx.id for tx in training_transactions}
        self._conflicts, self._memory = _build_simulated_memory(training_transactions)

    @property
    def training_ids(self) -> set[str]:
        return self._training_ids

    def categorize(
        self,
        transaction: EvalTransaction,
        business: Business,
        chart_of_accounts: list[Account],
    ) -> CategorizationResult:
        # Label-leakage guard: if the same id appears in training, refuse to
        # categorise — the caller is mixing the partitions and getting a free
        # answer.
        if transaction.id in self._training_ids:
            raise ValueError(
                f"label leakage: transaction {transaction.id!r} is in the training set"
            )

        entry = _lookup_simulated_memory(transaction, self._conflicts, self._memory)
        if entry is not None:
            return CategorizationResult(
                transaction_id=transaction.id,
                predicted_category_code=entry.code,
                confidence=1.0,
                reasoning=(
                    f"correction_memory (simulated): matched prior correction "
                    f"keyed by merchant/description, source {entry.source_tx_id}"
                ),
                alternative_category_code=None,
                cost_usd=0.0,
                latency_ms=0.0,
                # Marker the metric layer recognises as deterministic memory.
                model=f"mem_{entry.source_tx_id}",
            )
        return self._rules_model.categorize(transaction, business, chart_of_accounts)


def deterministic_train_test_split(
    transactions: list[EvalTransaction],
    *,
    test_fraction: float = 0.2,
    seed: int = 1234,
) -> tuple[list[EvalTransaction], list[EvalTransaction]]:
    """Deterministic train/test split keyed by transaction id.

    The same dataset + seed will always produce the same partition, so eval
    runs are reproducible. Order within each partition is preserved from the
    input list.
    """
    if not 0 < test_fraction < 1:
        raise ValueError("test_fraction must be in (0, 1)")
    rng = random.Random(seed)
    indices = list(range(len(transactions)))
    rng.shuffle(indices)
    cut = int(len(indices) * test_fraction)
    test_indices = set(indices[:cut])
    train = [tx for i, tx in enumerate(transactions) if i not in test_indices]
    test = [tx for i, tx in enumerate(transactions) if i in test_indices]
    return train, test
