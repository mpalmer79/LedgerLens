# Eval-driven categorization improvement

## Rule expansion: 32 → 50 rules

This sprint added 18 deterministic rules covering gaps in the Granite
State Auto Repair demo scenario:

| New rule | Intent | Confidence | Notes |
|---|---|---|---|
| ADP payroll | payroll | 0.93 | Covers ADP PAYROLL, ADP TAX SERVICES |
| Eversource | utilities | 0.92 | New England electric/gas |
| Comcast/Xfinity | internet_telecom | 0.92 | Business internet |
| Verizon | internet_telecom | 0.90 | Wireless/internet |
| AT&T | internet_telecom | 0.90 | Wireless/internet |
| Waste Management | waste_services | 0.90 | Commercial waste |
| Hanover Insurance | insurance | 0.92 | Commercial property/casualty |
| Concord Group Ins | insurance | 0.92 | NH regional insurer |
| State Farm | insurance | 0.90 | Auto/home/commercial |
| GEICO | insurance | 0.90 | Auto insurance |
| Irving Oil | fuel_vehicle | 0.85 | Northeast fuel chain |
| Sunoco | fuel_vehicle | 0.85 | Fuel chain |
| Cumberland Farms | fuel_vehicle | 0.85 | NE convenience/fuel |
| Stripe processing | merchant_fees | 0.88 | Payment processing fees |
| Square processing | merchant_fees | 0.88 | Payment processing fees |
| Lowe's (ambiguous) | office_supplies | 0.40 | Routes to review |
| Home Depot (ambiguous) | office_supplies | 0.40 | Routes to review |

### Intent coverage after expansion

| Intent | Rule count | Example vendors |
|---|---|---|
| software_subscription | 8 | Adobe, Microsoft, Google, Intuit, Zoom, Dropbox, Slack, GitHub |
| parts_inventory | 5 | NAPA, AutoZone, O'Reilly, Advance Auto, LKQ |
| fuel_vehicle | 8 | Shell, Exxon, Chevron, BP, Irving, Sunoco, Cumberland Farms |
| insurance | 4 | Hanover, Concord Group, State Farm, GEICO |
| internet_telecom | 3 | Comcast, Verizon, AT&T |
| merchant_fees | 2 | Stripe, Square |
| payroll | 1 | ADP |
| utilities | 1 | Eversource |
| waste_services | 1 | Waste Management |
| meals_entertainment | 3 | Starbucks, Dunkin, Uber Eats |
| travel | 4 | Uber, Lyft, Delta, United, Southwest |
| office_supplies | 2 | Staples, Office Depot |
| tires_inventory | 1 | Tire distributors |

### Ambiguous vendors (routed to review, not auto-finalized)

- Amazon (conf 0.40)
- Home Depot (conf 0.40)
- Lowe's (conf 0.40)

These vendors sell both business and personal goods. At confidence
0.40, they fall below the 0.60 review threshold and always route to
owner questions rather than being auto-approved.

## What this improves

- More demo-scenario transactions match deterministic rules at zero
  model cost
- The Granite State guided demo should show more auto-approved rows
  in the handoff
- Correction memory + rules together cover more of the obvious
  vendor patterns

## What remains

- No rules for: rent payments, loan payments, customer revenue,
  owner draw/contribution (these require more context than vendor
  name alone — they should route to review or use correction memory)
- Per-business rule generation (so eval-COA businesses get their own
  rule sets) is next-sprint work
- Eval harness confusion-pair and coverage reporting is deferred
