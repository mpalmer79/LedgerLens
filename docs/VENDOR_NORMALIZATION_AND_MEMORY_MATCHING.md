# Vendor normalization and memory matching

## What shipped

`backend/src/ledgerlens/services/vendor_normalization.py` — a
deterministic, zero-cost module for reducing noisy bank-statement
descriptions to stable vendor identifiers.

### Functions

| Function | Purpose |
|---|---|
| `strip_payment_noise(text)` | Remove ACH/POS/debit/wire prefixes and trailing store numbers, auth codes, dates, zip codes |
| `normalize_merchant_name(raw)` | Uppercase + noise strip + remove special chars + collapse whitespace → stable lookup key |
| `merchant_fingerprint(description, merchant)` | Short stable fingerprint for dict/DB lookups |
| `detect_vendor_family(text)` | Identify which of 45+ known vendor families a description belongs to |
| `is_ambiguous_vendor(family)` | True for vendors (Amazon, Costco, etc.) that need owner context to categorize |

### Vendor families (45+)

Auto parts, fuel, software, telecom, insurance, payroll, utilities,
waste, travel, meals, office supplies, payment processors, and
ambiguous big-box retailers.

### Design rules

1. **Normalize for matching, not display.** Output is a lookup key.
2. **Conservative.** Unknown vendors return the cleaned description.
3. **No model calls.** Pure regex + dict. Zero cost.
4. **Ambiguous vendors stay ambiguous.** Amazon, Costco, Home Depot
   are identified but NOT auto-categorized.
5. **Raw description preserved.** The normalizer never overwrites
   what's stored in the database.

## What this enables (future work)

- Correction memory could match on normalized merchant fingerprint
  instead of exact raw key → more reuse across similar descriptions
- Rule categorizer could use vendor family as a pre-filter
- Handoff/export could show a "normalized vendor" column
- Eval harness could report top unmatched vendor families

## What this does NOT do

- Does not replace the existing `normalize.py` (that module is used
  at CSV import time; this module is for downstream matching)
- Does not add embeddings or fuzzy matching
- Does not auto-categorize ambiguous vendors
- Does not store vendor family on the Transaction model (yet)
