# Correction memory generalization — audit

## 1. Current exact-memory behavior (before this sprint)

Memory lookup uses raw `merchant_key` and `description_key` stored at
correction time. Both keys must match verbatim for tier 1 (exact).
This means the same vendor with a different store number, different
ACH prefix, or different trailing date creates a separate description
that does NOT match existing memory.

## 2. Where normalized merchant fingerprints safely help

Bank-statement descriptions for the same vendor carry noise:

```
POS NAPA AUTO PARTS #4382 MANCHESTER NH 03104
DEBIT CARD PURCHASE NAPA AUTO PARTS 1234567890 05/18
```

Both are NAPA. A human corrected the first one; the second should
reuse that correction without a paid model call. The merchant
fingerprint normalizes both to the same key ("NAPA AUTO PARTS")
by stripping prefixes, trailing IDs, store numbers, and dates.

## 3. Which vendors must remain review-routed

**Ambiguous vendors** sell both business and personal goods:

- Amazon / AMZN
- Costco
- Home Depot / HD Supply
- Walmart
- Lowe's
- Target

These are blocked from fingerprint matching because a prior correction
for one purchase (shop supplies) should not auto-finalize a different
purchase (personal). They still work via exact match (if the raw
merchant_key + description_key match verbatim, the human's prior
decision is defensible for the exact same transaction shape).

## 4. Business scoping

Fingerprint matching uses the same `business_id` filter as exact
matching. Memory rows from Business A never match transactions from
Business B, even if the fingerprints are identical. This is enforced
by the repo's `find_for_keys` and `list` methods, which filter on
`CorrectionMemory.business_id`. Test:
`test_cross_business_fingerprint_does_not_leak`.

## 5. Match type hierarchy

| Match type | How it works | Confidence | Use case |
|---|---|---|---|
| `exact` | Raw merchant_key or description_key matches verbatim | Highest (1.0) | Same transaction shape repeats next month |
| `merchant_fingerprint` | Normalized fingerprint of description matches | High (1.0, same as exact — the human correction authority carries) | Different store number / prefix / trailing noise for the same vendor |
| `none` | No match | — | Unknown vendor or ambiguous vendor blocked |

## 6. Safety rules

1. Exact match always takes priority over fingerprint.
2. Ambiguous vendors are blocked from fingerprint matching.
3. Cross-business memory never leaks.
4. Raw transaction descriptions are never modified.
5. Inactive categories are filtered out.
6. Conflicting memory rows (same fingerprint, different categories) route to review.
7. `match_type` is recorded in the MemoryMatch so the categorization pipeline and audit trail can explain the match path.

## 7. Acceptance criteria

- [x] Memory remains business-scoped
- [x] Exact memory still works and wins
- [x] Fingerprint match reuses corrections across noisy variants
- [x] Ambiguous vendors are protected
- [x] Cross-business fingerprint does not leak
- [x] Raw descriptions unchanged
- [x] Match metadata includes match_type and reason
- [x] Tests prove all of the above (12 tests)
- [x] Full backend suite passes (400 tests, no regressions)
