# Sample scenario — sprint review

## 1. What changed

| Surface | Before | After |
|---|---|---|
| `DEMO_TRANSACTIONS` (backend) | 13 generic rows (Comcast, QuickBooks, Zoom, Staples, Shell, Stripe, Amazon, NAPA, ADP, State Farm, Sysco, ACH transfer). | **42 rows** for the fictional **Granite State Auto Repair** independent auto repair shop, March 2026: parts (NAPA / AutoZone / O'Reilly / Advance / LKQ / tire dist), utilities + rent (Eversource / Comcast / Waste Management / NH Property Management / Manchester Water), payroll (ADP bi-weekly ×2 + tax withdrawal + health), software (QuickBooks / Mitchell1 / Google Workspace / Stripe fee), fuel (Shell / Irving / Mobil), insurance + finance (Hanover / TD Bank / First Citizens), ambiguous (ACH ref / paper check / Amazon / Costco / Home Depot / Lowe's / Venmo / OWNER TRANSFER / ATM), revenue (Stripe payouts ×2 / Square / customer checks ×2 / cash). |
| Sample business identity | None — rows belonged to no one. | New `ledgerlens.data.sample_scenario` module centralises the fictional **Granite State Auto Repair** profile (name / location / month / scenario summary / handoff goal / demo disclaimer / handoff filename). |
| `/demo/scenario` endpoint | Did not exist. | **New** read-only endpoint exposing the scenario profile to the frontend. Safe in any mode. |
| `HandoffOut.scenario` | Did not exist. | **New** optional `HandoffScenario` field populated whenever the handoff contains any demo-sourced rows. Drives the markdown heading, the export filename, and the frontend business-name display. |
| `/handoff/export.md` filename | `handoff.md` | **`handoff-granite-state-auto-repair-2026-03.md`** when demo-sourced rows are present; `handoff.md` otherwise. |
| `/handoff/export.md` heading | "# LedgerLens — accountant handoff package" | "# Granite State Auto Repair — March 2026 accountant handoff" + business-type/location line + "fictional sample scenario for demonstration only" sub-line, when scenario is set. Always appends "not tax advice or a substitute for accounting review" + scenario disclaimer. |
| `/questions` templates | 4 pattern-matched templates + a default. | **8 templates** + a default — new templates for parts vendors (NAPA / AutoZone / O'Reilly / Advance / LKQ / tire dist), home-improvement stores (Home Depot / Lowe's), owner transfers (OWNER TRANSFER / VENMO / ATM), and revenue deposits (Stripe / Square / customer check / cash). |
| `/demo` page header | Generic "Guided 3-minute demo" + framing panel. | Adds a **Sample cleanup scenario** card naming Granite State Auto Repair, March 2026, the business type / location, the 5-bullet expected workflow, and the demo disclaimer. |
| `/cleanup` header | Generic monthly-cleanup intro. | Adds a **Sample data** badge with the business name + cleanup month when demo data is present. Empty state now invites "Try the sample scenario" instead of a generic "Start guided demo." |
| `/handoff` header | "Accountant handoff package" / cleanup_period_label. | **"Granite State Auto Repair — March 2026 handoff"** when scenario is set, with a "Sample data" badge and a copy line that names the deliverable as a demo handoff. |
| Homepage example handoff preview | "Example handoff preview" / "Accountant handoff package — March 2026" / 24 imports / 18 verified / 4 questions / 2 review / 3 corrections. | "Example: Granite State Auto Repair" / "March 2026 cleanup before accountant handoff" / "Fictional sample scenario" badge / **42 imports / 28 verified / 10 questions / 4 follow-up / 5 corrections / 100%**. CTAs flip to "Try the sample cleanup → `/demo`" (primary) + "Open the live handoff page" (secondary). Section blocks reference NAPA → COGS, AutoZone → COGS, ADP → Payroll. |
| `GeneratedWalkthrough` transactions | Generic mix (Comcast, QuickBooks, ADP, Shell, Amazon, ACH). | Auto-shop-flavored mix (NAPA, ADP Payroll, Comcast, Shell, Amazon, ACH 41281). Final filename `handoff-granite-state-auto-repair-2026-03.md`. |
| `README.md` | No scenario reference. | New "Sample scenario: Granite State Auto Repair" section explaining the scenario and linking to the docs + example handoff. |
| Docs | No scenario doc; no example handoff. | New `docs/SAMPLE_BUSINESS_SCENARIO_AUDIT.md` (audit), `docs/SAMPLE_BUSINESS_SCENARIO.md` (reference), `docs/examples/granite-state-auto-repair-handoff.md` (example output), `docs/SAMPLE_SCENARIO_REVIEW.md` (this doc). Existing `HANDOFF_STORY_REVIEW.md`, `WALKTHROUGH_HANDOFF_STORY_REVIEW.md`, `GENERATED_WALKTHROUGH.md`, `LINKEDIN_PROJECT_STORY.md`, and `IMPLEMENTATION_GAP_ANALYSIS.md` updated to reference the scenario. |
| Honesty | "Trust metric, workflow-level — not raw model accuracy." | Preserved. Every surface naming Granite State Auto Repair carries a "Fictional sample scenario" / "Sample data" badge. `/handoff` markdown always includes the demo-disclaimer line. |

## 2. Why Granite State Auto Repair

- **Recognisable vendor mix** — NAPA, AutoZone, O'Reilly, Advance, LKQ, Mitchell1, ADP, Eversource, garage liability insurance all pattern-match instantly as a real small business.
- **Honest ambiguity** — Home Depot / Lowe's, Costco, OWNER TRANSFER, ATM withdrawal, VENMO to a first name — these mirror real monthly-cleanup judgement calls; they aren't contrived edge cases.
- **Correction-memory opportunity** — NAPA, AutoZone, ADP, and Stripe Deposit Payout all repeat across the month, so a reviewer who corrects one row sees the next one categorize from memory at zero model cost.
- **No real-business overlap** — "Granite State Auto Repair" is generic enough that no actual business in NH likely uses the exact name; the fictional framing is reinforced everywhere it appears.

## 3. How the sample scenario improves product value

- **Recruiter view:** the homepage example preview now reads as a real business cleanup, not a developer test fixture. Tiles say 42 / 28 / 10 / 4 / 5 / 100% — those numbers tell a story.
- **Small-business owner view:** an auto-shop owner reading the homepage sees "NAPA, AutoZone, ADP, Home Depot, OWNER TRANSFER" and thinks "those are my transactions." A consulting-firm owner sees "Mitchell1 / parts vendors" and knows immediately that *this product knows what auto-shop ambiguity looks like* — which is a stronger signal than a totally generic dataset.
- **Demo flow view:** `/demo/seed` now creates a 42-row cleanup the user can actually walk for 5–10 minutes. `/questions` shows ~14 review items spanning 4 distinct question types. `/handoff` ends with a substantive deliverable.
- **Walkthrough animation view:** the 30-second animation now uses the same vendor names as the live data; a user who watches the loop and then opens `/demo` sees consistent storytelling.

## 4. Transaction mix summary

42 transactions, March 1–31, 2026:

| Bucket | Count |
|---|---:|
| Parts & inventory | 8 |
| Utilities & operations | 5 |
| Payroll & benefits | 4 |
| Software / subscriptions | 4 |
| Vehicle / fuel | 3 |
| Insurance / finance | 3 |
| Ambiguous — needs review | 9 |
| Revenue & deposits | 6 |

Positive amounts (deposits): 6 rows totaling ~$13K of revenue.
Negative amounts (expenses): 36 rows totaling ~$26K of cleanup activity.
Net activity: realistic-looking small-shop month.

## 5. Owner-question examples

The new dataset triggers eight distinct question types:

| Trigger | Example transaction | Question |
|---|---|---|
| Parts vendor | NAPA AUTO PARTS INV 88421 | "What were these parts for?" |
| Home improvement | HOME DEPOT #2841 CONCORD | "What was this purchase mainly for?" |
| Owner transfer | OWNER TRANSFER TO PERSONAL | "What was this transfer?" |
| Deposit / revenue | CUSTOMER CHECK DEPOSIT 1098 | "Is this a customer deposit or other revenue?" |
| ACH / check | ACH TRANSFER VENDOR REF 41281 | "What was this transfer for?" |
| Big-box ambiguous | COSTCO WHOLESALE #341 | "What was this purchase mainly for?" |
| Fuel | SHELL FUEL 03801 NASHUA | "Was this vehicle expense business-related?" |
| Subscription | MITCHELL1 PRODEMAND SUB | "Is this a business software or service subscription?" |

Each template offers 4–6 plain-English choices, including a "Needs accountant review" escape valve that records the row as a follow-up item without forcing a category.

## 6. Handoff package behavior

See `docs/examples/granite-state-auto-repair-handoff.md` for the full representative output.

Key behaviors:

- **Heading** uses the business name + cleanup month when scenario is set.
- **Filename** in `Content-Disposition` is `handoff-granite-state-auto-repair-2026-03.md`.
- **Honesty footer** always includes "This handoff package is not tax advice and is not a substitute for accounting review." When scenario is set it also includes "Fictional sample scenario. Not a real business, not tax advice, and not a substitute for accounting review."
- **Trust language** unchanged: workflow-level, not raw model accuracy.
- **Time-saved estimate** unchanged: 1.5 min / deterministic auto-approval, 2.0 min / memory replay. Still labelled as an estimate.

## 7. Honesty constraints preserved

- ✅ No "100% AI accuracy" claim anywhere.
- ✅ No real business name claim. "Fictional sample scenario" / "Sample data" badges on every surface.
- ✅ No real account numbers, real check numbers, or real policy numbers — every identifier is an obvious placeholder.
- ✅ No real customer or employee names. "VENMO PAYMENT - JON" uses a generic first name only.
- ✅ No email, no phone, no address, no resume link.
- ✅ "Not tax advice or a substitute for accounting review" disclaimer added to the markdown export.
- ✅ Anthropic SDK is never imported in demo mode — regression test `test_seed_does_not_import_anthropic_sdk` passes.
- ✅ `/demo/reset` semantics unchanged — only `source="demo"` rows deleted; non-demo data untouched. Existing test `test_reset_only_deletes_demo_rows` continues to apply.
- ✅ Trust contract (`docs/TRUST_METRIC.md`) unchanged.

## 8. Tests added/updated

**Backend (146 passed, +5):**

| Test | Asserts |
|---|---|
| `test_scenario_endpoint_returns_granite_state_profile` | `GET /demo/scenario` returns the fictional business identity and the disclaimer. |
| `test_seed_loads_granite_state_42_row_dataset` | `POST /demo/seed` creates exactly 42 rows containing NAPA / AutoZone / O'Reilly / ADP / Mitchell1 / ACH / OWNER TRANSFER / ATM / Stripe deposit / customer check; at least one positive (revenue) amount. |
| `test_seed_does_not_import_anthropic_sdk` | Anthropic SDK is not imported after a demo-mode seed call. |
| `test_handoff_scenario_is_none_without_demo_data` | Non-demo handoff has `scenario == null` and uses the generic markdown heading. |
| `test_handoff_scenario_surfaces_for_demo_seeded_rows` | Demo-seeded handoff has `scenario.business_name == "Granite State Auto Repair"`, the markdown heading uses it, the Content-Disposition filename is `handoff-granite-state-auto-repair-2026-03.md`, and "not tax advice" appears in the body. |

The existing `test_seed_creates_demo_rows_with_source_tag` (asserts `>= 10`) and `test_seed_then_categorize_produces_mixed_provider_results` (asserts both `rule_categorizer` and `demo_stub` providers appear) still pass against the new 42-row dataset.

**Frontend (119 passed, +6):**

| Test | Asserts |
|---|---|
| homepage / "includes the Granite State Auto Repair sample scenario" | The business name + "fictional sample" both appear on the homepage. |
| homepage / "renders the example handoff preview card with the sample-scenario name" | Preview shows "Example: Granite State Auto Repair", "Fictional sample scenario" badge, "March 2026 cleanup before accountant handoff", and illustrative tile values 42 / 28. |
| /demo / "renders the sample-cleanup-scenario card driven by /demo/scenario" | Demo page includes "Sample cleanup scenario", calls `getDemoScenario`, shows "Fictional sample data" badge. |
| /cleanup / "surfaces the sample-scenario context when demo data is present" | Header reads off `scenario.business_name` + `scenario.cleanup_month`, empty state names Granite State Auto Repair, primary CTA "Try the sample scenario". |
| /handoff / "surfaces the sample-scenario context when handoff.scenario is set" | Header uses `handoff?.scenario`, "Sample data" badge, "demo handoff" copy. |
| /questions / "includes auto-shop-friendly templates introduced with the sample scenario" | Parts ("What were these parts for?"), owner transfer ("What was this transfer?"), customer deposit ("Is this a customer deposit or other revenue?"), and home-improvement ("Shop supplies", "Building repair") templates all render. |
| GeneratedWalkthrough / "uses auto-repair-flavored sample transactions in scenes 1-5" | NAPA, ADP Payroll, Shell appear. |
| GeneratedWalkthrough / "renders the handoff package preview file label with the sample-scenario name" | Filename `handoff-granite-state-auto-repair-2026-03.md` appears in scene 6. |

## 9. Responsive QA notes

CSS already handles 360 / 375 / 430 / 768 / 1024 / 1280 from prior sprints; new surfaces inherit:

- **Homepage example preview tiles** — `grid-cols-2 sm:grid-cols-3` so phones get 2-up tiles and tablets+ get 3-up. Numbers `42 / 28 / 10 / 4 / 5 / 100%` are 2-digit max so they don't wrap or clip.
- **`/demo` scenario card** — `md:grid-cols-2` on the bullet list; on phones it stacks vertically. The business name + cleanup month is clamp-scaled with the existing `font-display text-[20px]` so it stays on one line at 360px.
- **`/cleanup` scenario badge** — `inline-flex flex-wrap` so the business name can wrap below the badge pill on narrow screens.
- **`/handoff` scenario header** — h1 already uses `clamp(24px,5vw,32px)` so "Granite State Auto Repair — March 2026 handoff" scales down on phones.
- **GeneratedWalkthrough** — existing `@media (max-width: 480px)` rules already collapse two-column splits to single-column; new vendor names are no longer than the previous ones.
- **`/questions` new templates** — existing `grid grid-cols-1 sm:grid-cols-2` answer buttons handle 4-, 5-, and 6-option templates the same way.

A manual pass at 360 / 375 / 430 / 768 / 1024 / 1280 on the deploy is recommended before LinkedIn launch but no blocking responsive issues are expected.

## 10. Build / test results

- `cd backend && pytest -q` → **146 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → 85 files already formatted
- `cd backend && mypy --strict src` → no issues found in 58 source files
- `cd frontend && npm test -- --run` → **119 passed (10 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build, all routes including `/demo` (15.1 kB), `/handoff` (4.4 kB), `/cleanup`, `/questions`, `/walkthrough` build cleanly

## 11. Remaining weaknesses

- **Single scenario only.** Granite State Auto Repair is the only sample business. Adding a second scenario (restaurant or freelance consultant) is straightforward but out of scope for this sprint.
- **No per-tenant chart of accounts.** The shared `DEFAULT_COA` doesn't include auto-shop-specific accounts (parts WIP, customer cores, warranty work). Real auto shops would want those.
- **No per-tenant categorization rules.** NAPA / AutoZone / O'Reilly / ADP all currently route to review by default; the scenario relies on correction memory to learn them on first use. A real auto-shop product would ship industry-specific rules.
- **No `/handoff?demo=1` cold preview.** A cold visitor still has to click "Start the sample cleanup" before seeing the handoff page populated. The homepage example preview card covers most of the messaging gap.
- **No multi-month progression.** March 2026 is the only month. February or April demos would require additional seed data.
- **Owner question free-text field still missing.** The walkthrough rescript review noted this; still a follow-up.

## 12. Recommended next PR

In priority order (be honest, be specific):

1. **Owner-question free-text field (`/questions` v2).** Today every answer is multiple-choice. A small `<textarea>` next to "Needs accountant review" so the owner can paste context ("this Venmo was to my mechanic Jon, he subcontracts brake jobs") would meaningfully strengthen the handoff package. Concrete: extend `ReviewDecision.reviewer_note` to accept structured owner notes, surface a "Free-form note" tab on `/questions`, and bubble the text into the markdown handoff "Questions answered by owner" section.

2. **Per-tenant rule generation from correction memory.** Today the rule layer is global and the eval numbers reflect a generic rule set. After this sprint's seed runs, a Granite State Auto Repair tenant would have NAPA / AutoZone / O'Reilly / ADP corrections in memory. A nightly job could synthesize those into a tenant-specific rule pack and re-run the eval against that rule layer. This is the single highest-value engineering follow-up; it would make the eval numbers reflect what the rule layer is actually capable of in production.

3. **CI enforcement of frontend tests.** Backend tests + ruff + mypy already run in CI. Frontend tests + lint + build don't. Adding a GitHub Action that runs `npm test`, `npm run lint`, and `npm run build` on every PR closes the loop.

4. **QuickBooks-friendly CSV mapping.** The current CSV export uses LedgerLens-native column names. Mapping to IIF or to QuickBooks Online's import format would let a real accountant drop the handoff CSV directly into their QuickBooks setup with no transformation.

5. **Frontend API timeout / retry hardening.** The frontend currently calls the backend with no timeout. A 5-second timeout on `getHandoff()` and friends + a single retry on network errors would make the public deploy more resilient on flaky connections.

The recommended single next PR is **#1 (owner-question free-text field)** because it directly strengthens the handoff package — the same artefact this sprint just made tangible. The others are excellent follow-ups but each is a step further from the user-facing product story.
