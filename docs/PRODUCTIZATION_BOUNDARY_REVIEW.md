# Productization boundary — sprint review

## 1. What changed

This sprint is a major **honesty + boundary** PR, not a feature
PR. The product still does what it did before; the framing,
copy, docs, and a few small safety fixes catch up to a senior
review that flagged overclaim risk and production-readiness
hand-waving.

| Surface | Before | After |
|---|---|---|
| Homepage hero subhead | "export a **verified ledger package**" | "turn messy monthly bank transactions into a **reviewed categorization package and accountant handoff** — it's a cleanup and accountant handoff assistant, **not accounting software**." |
| Homepage trust card big-number caption | "verified finalized demo ledger" | "procedurally verified demo rows" + "Workflow trust boundary — not a guarantee of accounting or tax correctness, and not a substitute for CPA review." |
| `/handoff` subhead | "reviewed ledger summary…to forward to your bookkeeper or accountant" | "reviewed categorization summary…for substantive review" + new amber boundary panel: "This is a **handoff package**, not CPA-reviewed books. 'Verified' means a defensible authority signed off on each row procedurally — it is not a guarantee of accounting or tax correctness, and it is not a substitute for accounting review." |
| `/ledger` heading | "Reviewed ledger export" | "Reviewed categorization export" + "closer to a chart-of-accounts-aware CSV than a double-entry accounting ledger." |
| `/demo` step 6 | "The final output is a verified ledger, not an AI answer" | "The final output is a procedurally verified categorization, not an AI answer" |
| `TrustPanel` heading | "Trust metric — finalized demo ledger" / "Trust metric — finalized ledger" | "Workflow trust metric — finalized demo rows" / "…finalized rows" + procedural-verification paragraph + explicit "workflow trust boundary, not a guarantee of accounting or tax correctness, and not a substitute for CPA review." |
| `/technical-story` comparison row | "Verified finalized ledger — workflow-level guarantee" | "Procedurally verified rows — workflow trust boundary, not CPA-correct" |
| `/technical-story` stack list | "Postgres-ready (SQLite for demo)" | "SQLAlchemy 2.0 models (SQLite for demo, Postgres-compatible in principle)" |
| `/technical-story` Product-metric card | "Verified finalized ledger" / "Workflow-level guarantee" | "Procedurally verified rows" / "Workflow trust boundary (not a CPA guarantee)" |
| `/technical-story` | (no production-readiness section) | **New "Production-readiness boundary" section** naming the gaps (no auth, no Alembic, no PII redaction, no double-entry) + cross-links to the three new boundary docs. |
| `/evals` Product-metric card | "Verified finalized ledger" | "Procedurally verified rows" + "Workflow trust boundary — not a guarantee of accounting or tax correctness." |
| `/evals` trust-boundary section | (no reminder about categorization vs accounting correctness) | New italic footer: "The eval numbers measure categorization behavior… they do not measure accounting correctness." + link to `ACCOUNTING_DOMAIN_BOUNDARY.md`. |
| `/transactions/import` | (no warning about real bank data) | **New amber warning panel at the top**: "Public demo — do not upload real bank data. Use sample or synthetic CSV data only. Do not upload real bank statements, customer information, employee information, account numbers, or sensitive financial data. There is no authentication and no tenant isolation on this deploy." |
| `GeneratedWalkthrough` final scene | "verified finalized demo ledger" | "procedurally verified demo rows" |
| `README.md` TL;DR | "Helps owners turn messy monthly bank transactions into a verified accountant handoff package by combining…" | New top section pair: "What LedgerLens is" + **"What LedgerLens is NOT"** (not production accounting software, not multi-tenant SaaS, not a substitute for a CPA, not safe for real bank data uploads). New "Public demo warning" + "Accounting-domain boundary" + "Security and production-readiness status" + "Production roadmap" + "Test / CI status" sections. |
| `README.md` status table | "Persistent storage (SQLite for demo, Postgres-ready) — Shipped" | "Persistent storage (SQLite for demo; Postgres-compatible models) — Shipped — SQLAlchemy 2.0 models that can run against Postgres in principle, idempotent table creation, seeded chart of accounts. **Production migration management (Alembic), backups, and retention policies are documented as roadmap items, not implemented.**" |
| `docs/TRUST_METRIC.md` headline | "100% of finalized guided-demo ledger rows are verified before export." | "100% of finalized guided-demo rows are procedurally verified before handoff." + new "procedurally verified" definition paragraph cross-linking the accounting-domain boundary doc. |
| `docs/LINKEDIN_PROJECT_STORY.md` short description | "verified categorized ledger" | "procedurally verified categorization package" + explicit "it is not a guarantee of accounting or tax correctness, and not a substitute for CPA review" disclaimer in the §1 short description. "Postgres-ready" → "Postgres-compatible" everywhere. |
| `backend/src/ledgerlens/main.py` startup | `except Exception: pass` | `except Exception: logger.exception(...)` — keeps the resilience semantics but no longer silently swallows the error. |
| `.github/dependabot.yml` | (did not exist) | New config: weekly `npm` (frontend) + `pip` (backend) + monthly `github-actions`. Grouped updates for the big frameworks (Next, React, Vitest, FastAPI, SQLAlchemy). |
| Docs | 35 docs. | +6 new docs: `PRODUCTIZATION_GAP_AUDIT.md`, `ACCOUNTING_LANGUAGE_AUDIT.md`, `ACCOUNTING_DOMAIN_BOUNDARY.md`, `SECURITY_AND_PRODUCTION_READINESS.md`, `SMALL_BUSINESS_UX_ROADMAP.md`, `PRODUCTIZATION_BOUNDARY_REVIEW.md` (this doc). |

## 2. Why this PR was necessary

A senior review flagged three correlated risks:

1. **Accounting overclaim.** Words like "ledger," "verified
   ledger," and "Postgres-ready" appeared on buyer-facing
   surfaces in ways a casual buyer could read as "CPA-grade
   production accounting software."
2. **Production-readiness hand-waving.** No auth, no tenant
   model, no PII redaction, no migrations, no rate limiting —
   but the homepage and `/technical-story` didn't acknowledge
   the gap visibly. A reviewer who clicked through the polish
   might assume more had been built than actually was.
3. **UX inversion.** The marketing surface (hero, walkthrough,
   comparison) was more polished than the real owner workflow.
   The actual owner — using this at 11pm from a phone — would
   notice missing CSV mapping, no mobile-first review queue, no
   bulk actions.

The fix isn't to build all of that in one sprint. The fix is to
correct the framing, document the boundary honestly, and put
concrete roadmaps on paper so the gap is visible without
exaggerated promises.

## 3. Accounting-language changes

Replaced "verified ledger" / "verified ledger package" / "ledger
export" with **"procedurally verified rows"** / **"reviewed
categorization package"** / **"reviewed categorization export"**
across every buyer-facing surface. "Ledger" is preserved only on
the internal route (`/ledger`) and where the page itself defines
the boundary. The full glossary lives in
`docs/ACCOUNTING_LANGUAGE_AUDIT.md` §6.

## 4. Trust / verification wording changes

The headline metric ("100% of finalized guided-demo rows are
procedurally verified before handoff") is unchanged in meaning,
sharper in wording. Every surface that displays it now includes:

> "Verification is procedural: a defensible authority (rule,
> correction memory, or human review) signed off. This is a
> workflow trust boundary, not a guarantee of accounting or tax
> correctness, and not a substitute for CPA review."

The trust badge in the README updates to read
`trust-100%%20procedurally%20verified`.

## 5. Security and production-readiness documentation

New `docs/SECURITY_AND_PRODUCTION_READINESS.md` enumerates 17
critical / high / medium gaps with severity ratings + a 5-phase
production roadmap (Phase A = auth/tenant, Phase B =
observability, Phase C = migrations/backups/retention, Phase D =
PII redaction + model controls, Phase E = dependency scanning +
SBOM). Each phase is sized to ship as one PR.

The doc also lists "what a real buyer should not do yet" —
explicit don'ts to make sure no one mistakes the demo for real
SaaS.

## 6. UX roadmap response

New `docs/SMALL_BUSINESS_UX_ROADMAP.md` responds directly to the
senior-review observation that the marketing surface outpaces the
owner workflow. Concrete designs for:

- **CSV mapping wizard** — drag/drop, preview 10 rows, column
  mapping, debit/credit detection, date format detection, save
  profile per bank.
- **Account-mapping wizard** — current map view, suggest
  defaults, unmapped intents at the top, per-intent options
  (use this code / leave unmapped / block fallback).
- **Mobile-first review queue** — one transaction per card, big
  buttons, sticky save/skip, owner note above answers,
  progress indicator, "works at 11pm on phone."

## 7. Lightweight fixes implemented

- **Startup error handling** — replaced silent
  `except Exception: pass` in `lifespan()` with
  `logger.exception(...)`. Resilience preserved (process still
  starts so `/health` works), but the error class is now
  visible in stdout / wherever logs land. The other three
  `except Exception` blocks in the codebase already log via
  `logger.exception` and route errors to `/ready` — defensible
  and documented.
- **Dependabot config** — `.github/dependabot.yml` ships
  weekly npm + pip updates, monthly GitHub Actions updates,
  grouped for the major frameworks.
- **CORS / security headers** — documented as Phase B roadmap
  items rather than half-implemented in this PR. The risk of
  shipping broken security headers (breaking the Loom embed,
  for example) outweighed the benefit on a portfolio demo.
- **Alembic reality check** — README + status table updated to
  explicitly say production migration management is not
  implemented. The dependency stays in `pyproject.toml` because
  removing it would block the Phase C migration PR.

## 8. What remains unfixed

Intentionally left for the production roadmap (see
`SECURITY_AND_PRODUCTION_READINESS.md`):

- All of Phase A (auth, tenant, route protection).
- All of Phase B (rate limiting, request IDs, structured
  logging, log redaction).
- All of Phase C (Alembic migrations, backups, retention,
  deletion endpoint).
- All of Phase D (PII redaction before LLM).
- Phase E beyond Dependabot.
- Mobile-first review queue + CSV mapping wizard + account
  mapping wizard (UX roadmap).
- Double-entry / split transactions / sales tax / multi-currency
  / bank reconciliation (accounting roadmap).

## 9. Why those items remain roadmap items

- **Auth + tenant model is a multi-week project.** Building it
  half-way is worse than documenting the gap honestly. The
  Phase A PR is its own sprint, and it'll need design review.
- **Real PII redaction needs adversarial testing** — building
  a redactor without testing it against realistic inputs is
  worse than the demo-stub firewall we have today.
- **Migrations need a baseline + tested rollback path** — a
  half-finished Alembic setup is a footgun.
- **Mobile review queue + CSV wizard are real UX work** —
  prototyping them properly takes more than the time-budget for
  a boundary / framing PR.
- **Double-entry needs accountant review.** Building it without
  a CPA looking at the data model would be the exact kind of
  overclaim this sprint is trying to prevent.

## 10. Tests added / updated

**Backend — 202 passed (was 202, unchanged)**

No new backend tests; the only backend change is the startup
logger replacement (covered by `test_demo`'s end-to-end
lifecycle).

**Frontend — 179 passed (was 161, +18)**

| New test | Coverage |
|---|---|
| homepage: explicitly disclaims accounting-software framing | "not accounting software" present; no positive "AI accounting software" claim. |
| homepage: procedural verification framing | "procedurally verified" present; "not a substitute for CPA" present. |
| handoff: not CPA-reviewed clarification | "not cpa-reviewed", "procedural", "not a substitute for accounting review" all present. |
| technical-story: production-readiness boundary section | New section title + all three boundary doc links + "portfolio-grade workflow demo" + "not production accounting software". |
| transactions/import: real bank data warning | "Public demo", "do not upload real bank", "customer information", "employee information", "account numbers" all present. |
| transactions/import: no auth / no tenant isolation note | "no authentication", "no tenant isolation" present. |
| evals: product metric wording updated | "Procedurally verified rows" replaces "Verified finalized ledger". |
| demo step 6: procedural framing | "procedurally verified categorization, not an AI answer". |
| VideoDemo + GeneratedWalkthrough trust copy | "procedurally verified demo rows" replaces "verified finalized demo ledger". |
| **New `productization-docs.test.ts` (7 tests)** | Docs file existence (PRODUCTIZATION_GAP_AUDIT, ACCOUNTING_LANGUAGE_AUDIT, ACCOUNTING_DOMAIN_BOUNDARY, SECURITY_AND_PRODUCTION_READINESS, SMALL_BUSINESS_UX_ROADMAP, TRUST_METRIC); each doc contains the right anchor phrases; Dependabot config present and covers npm + pip + github-actions. |

All 161 prior frontend tests pass unchanged (those that
referenced old copy were updated in lockstep with the source
edits).

**Build / lint / typecheck**

- `cd backend && pytest -q` → **202 passed**
- `cd backend && ruff check src tests` → all checks passed
- `cd backend && ruff format --check src tests` → all formatted
- `cd backend && mypy --strict src` → no issues found
- `cd frontend && npm test -- --run` → **179 passed (12 files)**
- `cd frontend && npm run lint` → 0 warnings / 0 errors
- `cd frontend && npm run build` → clean production build

## 11. Recommended next PR

In priority order:

1. **CSV import mapping wizard.** Directly addresses the most
   visible UX-vs-marketing inversion. Self-contained client-side
   work; doesn't need backend changes (existing import endpoint
   accepts normalized CSV). Owner can use the wizard from a
   phone.
2. **Mobile-first review queue.** Same theme — bring the real
   owner workflow up to the level of the marketing polish.
   One transaction per card, big buttons, sticky save/skip.
3. **Auth + tenant model design doc and schema foundation
   (Phase A).** Even before implementation, write the design
   doc + the schema diff. Future contributors then have a
   target.
4. **Request IDs + structured logging + redaction utility
   (Phase B).** Smallest production-readiness step that adds
   real value. Pairs with the `<ErrorState>` technical-details
   surface from PR #40.
5. **QuickBooks-friendly CSV export mapping.** Map the handoff
   CSV to IIF or QBO XML so the handoff plugs directly into a
   real accountant's QuickBooks setup.
6. **Real Loom recording + launch assets** — the
   GeneratedWalkthrough is good; a real Loom would close the
   homepage video story.

The recommended single next PR is **#1 (CSV import mapping
wizard)** because it directly answers the senior review's "this
is a demo, not the workflow a real owner would use" critique
without needing the multi-week Phase A foundation first.
