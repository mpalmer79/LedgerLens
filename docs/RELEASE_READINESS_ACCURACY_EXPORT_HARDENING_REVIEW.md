# Release readiness sprint — review

## What shipped

### Vendor normalization foundation (Phase 2)
- `services/vendor_normalization.py` — 45+ vendor families, payment-
  noise stripping, fingerprinting, ambiguous-vendor detection
- 40 tests in `tests/test_vendor_normalization.py`

### Expanded deterministic rule coverage (Phase 4)
- 32 → 50 rules in `category_rules.json`
- 18 new rules: ADP/payroll, Eversource/utilities, Comcast/Verizon/
  AT&T/telecom, Hanover/Concord Group/State Farm/GEICO/insurance,
  Irving/Sunoco/Cumberland Farms/fuel, Waste Management, Stripe/
  Square/merchant fees, Lowe's/Home Depot (ambiguous → review)

### Documentation
- `docs/RELEASE_READINESS_ACCURACY_EXPORT_HARDENING_AUDIT.md`
- `docs/VENDOR_NORMALIZATION_AND_MEMORY_MATCHING.md`
- `docs/EVAL_DRIVEN_CATEGORIZATION_IMPROVEMENT.md`
- This review doc

## What was explicitly deferred

| Item | Reason |
|---|---|
| Split transactions (Phase 7) | Domain model is accounting-adjacent; needs careful design. Documented in audit. |
| QBO/Xero export formats (Phase 8) | Research doc exists; no live integration justified before paying customers |
| Correction memory generalization (Phase 3) | Vendor normalization is the foundation; memory matching changes need separate careful testing |
| Eval confusion-pair reporting (Phase 5) | Eval harness already produces per-category metrics; confusion pairs are incremental |
| Calibration threshold centralization (Phase 6) | Thresholds already work correctly; centralizing is cleanup, not safety |
| README update (Phase 11) | Deferred to keep this PR focused on backend accuracy/rules |
| Smoke script update (Phase 10) | Current smoke script works; improvements are incremental |

## Test counts

- Backend: **388 passed** (was 348; +40 vendor normalization)
- Frontend: unchanged (no frontend changes in this commit)

## Honesty contracts preserved

- No production SaaS claim
- No real-bank-data claim
- No true-ledger claim
- No 100% AI accuracy claim
- Demo-stub mode untouched
- Public demo warnings untouched
- Ambiguous vendors (Amazon, Home Depot, Lowe's) route to review
- No email/phone/mailto/tel links added
