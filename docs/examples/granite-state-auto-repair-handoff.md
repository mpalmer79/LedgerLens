# Granite State Auto Repair — March 2026 accountant handoff

_Independent auto repair shop · New Hampshire · fictional sample scenario for demonstration only._

**Period:** March 2026
**Generated:** 2026-04-02T09:14:00-04:00

## Cleanup summary

- Transactions imported: **42**
- Finalized rows: **28** (illustrative)
- Verified rows: **28** (100%) — *workflow-level, not raw model accuracy*
- Unverified finalized rows: **0** — review before treating as final
- Review-required: **14** (10 answered as owner questions, 4 sent to accountant for follow-up)
- Handled deterministically (rules / memory): **9**
- Human-reviewed: **19**
- Corrections learned this month: **5**
- Estimated owner time saved: **~32 min** _(estimate; see methodology in `docs/SMALL_BUSINESS_VALUE_AUDIT.md`)_

## Ready for accountant

| Date | Description | Amount | Category | Source |
|---|---|---:|---|---|
| 2026-03-01 | NH PROPERTY MGMT MAR RENT - SHOP | -3850.00 USD | [6010] Rent | review |
| 2026-03-01 | EVERSOURCE ELECTRIC NH | -684.20 USD | [6020] Utilities | review |
| 2026-03-01 | COMCAST BUSINESS INTERNET MAR | -299.00 USD | [6150] Telephone & Internet | review |
| 2026-03-02 | QUICKBOOKS ONLINE PLUS | -80.00 USD | [6070] Software Subscriptions | rule_categorizer |
| 2026-03-02 | NAPA AUTO PARTS INV 88421 | -342.50 USD | [5010] Cost of Goods Sold | review |
| 2026-03-03 | SHELL FUEL 03801 NASHUA | -87.21 USD | [6130] Fuel & Vehicle | rule_categorizer |
| 2026-03-04 | MITCHELL1 PRODEMAND SUB | -169.00 USD | [6070] Software Subscriptions | review |
| 2026-03-04 | AUTOZONE COMMERCIAL #4471 | -187.60 USD | [5010] Cost of Goods Sold | review |
| 2026-03-04 | STRIPE DEPOSIT PAYOUT | +4284.00 USD | [4010] Sales Revenue | review |
| 2026-03-05 | WASTE MANAGEMENT COMMERCIAL | -385.00 USD | [6020] Utilities | review |
| 2026-03-06 | ADP PAYROLL BI-WEEKLY | -7842.30 USD | [6030] Wages & Salaries | review |
| 2026-03-06 | ADP PAYROLL TAX WITHDRAW | -1674.20 USD | [6040] Payroll Taxes | review |
| 2026-03-06 | O'REILLY AUTO PARTS 4712 | -892.30 USD | [5010] Cost of Goods Sold | correction_memory |
| 2026-03-08 | SQUARE DEPOSIT TRANSFER | +2126.00 USD | [4010] Sales Revenue | review |
| 2026-03-09 | IRVING OIL 4218 MERRIMACK | -78.42 USD | [6130] Fuel & Vehicle | review |
| 2026-03-09 | ADVANCE AUTO PARTS PO 33812 | -149.20 USD | [5010] Cost of Goods Sold | correction_memory |
| 2026-03-10 | MANCHESTER WATER WORKS | -123.40 USD | [6020] Utilities | review |
| 2026-03-11 | GOOGLE WORKSPACE BUSINESS | -18.00 USD | [6070] Software Subscriptions | rule_categorizer |
| 2026-03-11 | CUSTOMER CHECK DEPOSIT 1098 | +1850.00 USD | [4010] Sales Revenue | review |
| 2026-03-12 | HANOVER GARAGE LIABILITY POL 49KF | -985.00 USD | [6050] Insurance | review |
| 2026-03-13 | NAPA AUTO PARTS INV 88503 | -673.40 USD | [5010] Cost of Goods Sold | correction_memory |
| 2026-03-15 | CONCORD GROUP HEALTH INS | -1324.00 USD | [6050] Insurance | review |
| 2026-03-15 | STRIPE PROCESSING FEE | -84.20 USD | [6100] Bank & Merchant Fees | rule_categorizer |
| 2026-03-15 | STRIPE DEPOSIT PAYOUT | +3692.00 USD | [4010] Sales Revenue | correction_memory |
| 2026-03-17 | GRANITE STATE TIRE DIST | -1845.00 USD | [5010] Cost of Goods Sold | review |
| 2026-03-20 | ADP PAYROLL BI-WEEKLY | -8121.50 USD | [6030] Wages & Salaries | correction_memory |
| 2026-03-22 | MOBIL MART STATION 117 | -91.20 USD | [6130] Fuel & Vehicle | rule_categorizer |
| 2026-03-22 | CUSTOMER CHECK DEPOSIT 1112 | +2475.00 USD | [4010] Sales Revenue | review |

## Needs owner / accountant review

| Date | Description | Amount | Predicted | Reason |
|---|---|---:|---|---|
| 2026-03-07 | ACH TRANSFER VENDOR REF 41281 | -675.00 USD | — | owner answered: needs accountant review |
| 2026-03-11 | CHECK #1042 | -450.00 USD | — | owner answered: not sure — flagged for review |
| 2026-03-19 | ATM WITHDRAWAL TD BANK | -200.00 USD | — | owner answered: needs accountant review |
| 2026-03-23 | VENMO PAYMENT - JON | -250.00 USD | — | owner answered: reimbursement — confirm receipt with accountant |

## Questions answered by owner

- **NAPA AUTO PARTS INV 88421** (correct → [5010] Cost of Goods Sold): Owner: parts for a customer job.
- **AUTOZONE COMMERCIAL #4471** (correct → [5010] Cost of Goods Sold): Owner: shop parts inventory.
- **ADP PAYROLL BI-WEEKLY** (correct → [6030] Wages & Salaries): Owner: bi-weekly payroll.
- **HOME DEPOT #2841 CONCORD** (correct → [6180] Supplies - General): Owner: shop supplies.
- **LOWE'S COMMERCIAL #1142** (correct → [6140] Repairs & Maintenance): Owner: building repair.
- **COSTCO WHOLESALE #341** (correct → [6120] Meals & Entertainment): Owner: meals / staff expense.
- **AMAZON MARKETPLACE ORDER 113-44** (correct → [6060] Office Supplies): Owner: office supplies.
- **OWNER TRANSFER TO PERSONAL** (correct → [3030] Owner Distributions): Owner: owner draw / distribution.
- **CUSTOMER CHECK DEPOSIT 1098** (correct → [4010] Sales Revenue): Owner: customer payment.
- **STRIPE DEPOSIT PAYOUT** (correct → [4010] Sales Revenue): Owner: customer payment.

## Corrections learned this month

- `NAPA AUTO PARTS` → **[5010]** (3 matches so far)
- `AUTOZONE COMMERCIAL` → **[5010]** (2 matches so far)
- `ADP PAYROLL` → **[6030]** (2 matches so far)
- `STRIPE DEPOSIT PAYOUT` → **[4010]** (2 matches so far)
- `EVERSOURCE` → **[6020]** (1 match so far)

## Notes for the accountant

- Trust metric is workflow-level: a row is counted as verified only when it came through a rule auto-approval, a correction-memory replay, or an explicit human review. Raw model accuracy is reported separately on `/evals`; it is not the trust boundary for the handoff.
- Estimated owner time saved is a conservative figure (1.5 min per deterministic auto-approval, 2.0 min per memory replay). It is not a financial guarantee.
- This handoff package is not tax advice and is not a substitute for accounting review.
- Fictional sample scenario. Not a real business, not tax advice, and not a substitute for accounting review.
