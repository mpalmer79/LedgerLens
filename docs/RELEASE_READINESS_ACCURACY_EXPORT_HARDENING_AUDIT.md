# Release readiness audit — accuracy, export, and hardening

## 1. Current categorization pipeline

Three-layer deterministic-first stack:

1. **Correction memory** — exact merchant_key + description_key lookup
   (business-scoped). On match → auto-approved at zero cost. On
   conflict (multiple memories disagree) → needs_review.
2. **Deterministic rules** — 50 pattern-matching rules (was 32) with
   intents. Per-business mapping resolves intents to the active COA.
   High confidence (≥ 0.90) → auto-approved. Medium (0.60–0.90) →
   needs_review. Conflict → needs_review.
3. **Model fallback** — Claude Haiku (or demo_stub at zero cost).
   Same confidence routing.

## 2. Current eval numbers

- **Dataset**: v0, 302 transactions across 3 synthetic businesses
  (auto-repair 142, coffee-shop 81, design-agency 79)
- **Rules-only accuracy**: ~0% on eval businesses (rules target the
  seed COA; eval COAs differ — this is methodology, not a defect)
- **Rules-only-mapped accuracy**: 7%+ (with per-business intent
  mapping)
- **Claude Haiku accuracy**: ~62.9% overall, ~65.3% non-adversarial,
  ~41.9% adversarial
- **What these numbers mean**: eval accuracy is bounded by COA
  mismatch and intentionally conservative routing. Product trust
  comes from the verification pipeline (rule + memory + human review),
  not raw model accuracy.

## 3. Current accuracy limitations

- 32→50 rules still cover only ~15 intents; many vendor patterns are
  unmatched
- Correction memory is exact-key only (no fuzzy/embedding match)
- Model accuracy is ~63% — acceptable because uncertain rows route to
  review, not to the books
- Per-category calibration error (ECE) is not reported

## 4. Current efficiency / cost-control strengths

- Demo mode: zero model cost (demo_stub)
- Rule + memory layer handles obvious vendors at zero cost
- Three-layer pipeline means the model is a fallback, not the default
- Per-request cost tracking exists in CategorizationResult

## 5. Current correction-memory limitations

- Exact merchant_key + description_key match only
- No normalized/fingerprint key matching
- No vendor-family rollup
- Conflict resolution routes to review (safe but sometimes redundant)

## 6. Current vendor-normalization limitations (before this sprint)

- Basic prefix/tail stripping in normalize.py
- No vendor family detection
- No fingerprinting for cross-description matching
- No ambiguous-vendor flagging

**This sprint adds**: vendor_normalization.py with strip_payment_noise,
normalize_merchant_name, merchant_fingerprint, detect_vendor_family,
and AMBIGUOUS_VENDORS.

## 7. Current split-transaction limitations

- No split model
- No API
- Deferred to a future sprint with explicit docs

## 8. Current export limitations

- Markdown handoff + reviewed CSV + follow-up CSV
- No QBO/Xero import format
- No accountant cleanup CSV with normalized vendor column
- No split-line export

## 9. Current deployment / smoke-test gaps

- Smoke script checks HTTP status + CORS only, not categorization
  correctness
- No end-to-end transaction → categorize → review → handoff smoke test
- DEMO_ALLOW_DB_RESET is a one-time repair flag; documented but
  could be removed after first use

## 10. Current README / docs inconsistencies

- README may reference "no user model" or "no tenant model" when
  these now exist (User, Tenant, Business, Membership shipped in
  auth-phase-2)
- Test count in README likely stale (was ~315, now 388+)
- Homepage visual refresh not acknowledged in README
- Tenant-boundary scoping not reflected in README's "what's shipped"

## 11. What this sprint addresses

| Area | Action |
|---|---|
| Vendor normalization | New module: 45+ vendor families, payment-noise stripping, fingerprinting, ambiguous-vendor detection |
| Deterministic rules | 32 → 50 rules; added ADP/payroll, Eversource/utilities, Comcast/telecom, insurance (Hanover, Concord Group, State Farm, GEICO), fuel (Irving, Sunoco, Cumberland Farms), Waste Management, Stripe/Square merchant fees, Lowe's/Home Depot (ambiguous → review) |
| Tests | +40 vendor normalization tests |
| Split transactions | Deferred — documented in audit |
| QBO/Xero export | Deferred — research doc exists |

## 12. Acceptance criteria

- [x] Audit explains why raw eval accuracy ≠ product trust
- [x] Audit identifies high-impact improvement areas
- [x] Audit preserves reviewed-categorization vs accounting-ledger distinction
- [x] Vendor normalization foundation exists with tests
- [x] Rule coverage expanded for demo scenario
- [x] Ambiguous vendors (Amazon, Home Depot, Lowe's) route to review
