# LedgerLens eval report

Generated: 2026-05-25T03:10:12+00:00
Dataset: v0 (302 transactions, 3 businesses)
Mode: demo_stub
Total rows: 302

## Accuracy

- Overall accuracy: **0.0%**
- Auto-approved accuracy: **0.0%**

> Raw accuracy reflects predictions vs ground truth on the eval dataset. It is NOT the same as product trust — product trust comes from the procedural verification pipeline (rules + memory + human review), not from raw model accuracy.

## Safety

| Metric | Count |
|---|---:|
| Correct finalized | 0 |
| Incorrect finalized | 0 |
| Review routing saved from mistake | 0 |
| Dangerous auto-approval avoided | 0 |
| Finalized accuracy | 100.0% |

## Coverage by provider

| Provider | Count | % |
|---|---:|---:|
| deterministic_other | 302 | 100.0% |

Zero-cost rows: 302 (100.0%)

## Routing

| Status | Count | Rate |
|---|---:|---:|
| Auto-approved | 0 | 0.0% |
| Needs review | 0 | 0.0% |
| Model called | 0 | 0.0% |

## Top confusion pairs

| Expected | Predicted | Count | Finalized | Review-routed |
|---|---|---:|---:|---:|
| 4010 | UNCATEGORIZABLE | 40 | 0 | 40 |
| 6010 | UNCATEGORIZABLE | 28 | 0 | 28 |
| 6040 | UNCATEGORIZABLE | 28 | 0 | 28 |
| 6110 | UNCATEGORIZABLE | 17 | 0 | 17 |
| 6120 | UNCATEGORIZABLE | 14 | 0 | 14 |
| 1050 | UNCATEGORIZABLE | 13 | 0 | 13 |
| 6020 | UNCATEGORIZABLE | 12 | 0 | 12 |
| 6170 | UNCATEGORIZABLE | 12 | 0 | 12 |
| 6130 | UNCATEGORIZABLE | 9 | 0 | 9 |
| 6210 | UNCATEGORIZABLE | 9 | 0 | 9 |

## Top unmatched vendors (rule/memory gap candidates)

| Vendor | Count | Expected category | Example |
|---|---:|---|---|
| 31 | 31 | 6040 | GUSTO PAYROLL 0707 |
| 21 | 21 | 4010 | SQUARE INC DEPOSIT 7C9F |
| 19 | 19 | 1030 | STRIPE TRANSFER ST-9F8E7D6C |
| 14 | 14 | 6010 | GRANITE COMMERCIAL RE RENT APR |
| 14 | 14 | 4010 | CARDPOINTE DEPOSIT 7A02 |
| 12 | 12 | 6020 | EVERSOURCE NH ELECTRIC |
| 10 | 10 | 1050 | NAPA AUTO PARTS #4471 MANCHESTER NH |
| 10 | 10 | 6010 | REGUS COWORKING APRIL |
| 9 | 9 | 6010 | SEACOAST PROPERTIES LLC RENT APR |
| 7 | 7 | 6210 | CINTAS UNIFORM SVC |

## Limitations

- Eval accuracy is bounded by COA mismatch: rules target the seed COA, but eval businesses have different COAs.
- Rules-only mode scores ~0% on eval businesses by methodology — this is not a rule-layer defect.
- Correction memory is not exercised in eval (no prior corrections exist in the eval dataset).
- Demo-stub mode produces zero-cost predictions at low accuracy.
- This report does not claim production accounting correctness.
