# Accounting language audit

## 1. Risky terms found

Surfaces that currently use accounting-tinged language a casual
buyer could misread as a CPA-grade claim:

| Surface | Phrase | Verdict |
|---|---|---|
| Homepage hero subhead | "verified ledger package" | **Risky** — implies full ledger. |
| Homepage trust card | "verified finalized demo ledger" | **OK with `demo` qualifier**, but the word "ledger" still over-claims. |
| `/demo` step 6 | "verified ledger, not an AI answer" | **Risky** — same issue. |
| `/ledger` page header | "Reviewed ledger export" | **Risky** — page title implies a real accounting ledger. |
| `/handoff` page subhead | "reviewed ledger summary…to forward to your bookkeeper or accountant" | **Risky** — "ledger summary" + "to forward to your accountant" reads like CPA-ready output. |
| `/technical-story` | "Verified finalized ledger — workflow-level guarantee" | **OK** in context — section explicitly explains it's workflow-level, but the heading still says "ledger". |
| `TrustPanel` | "Trust metric — finalized demo ledger" / "Trust metric — finalized ledger" | **Risky** — depends on the variant. |
| `README` | "verified accountant handoff package" + "categorized ledger" + "Postgres-ready" | **Mixed** — `accountant handoff package` is fine; `ledger` should be qualified; `Postgres-ready` overstates production readiness. |
| `docs/TRUST_METRIC.md` | "100% of finalized guided-demo ledger rows are verified before export" | **OK with `demo` qualifier**, but consistency matters. |
| `docs/LINKEDIN_PROJECT_STORY.md` | "verified categorized ledger" (×3); "Postgres-ready" (×3); "production-grade" implied | **Risky in the launch context** — LinkedIn buyers / recruiters are exactly the audience this audit cares about. |

## 2. Why each term may be misleading

- **"Ledger"** — to an accountant or accounting-software buyer,
  "ledger" means a double-entry accounting ledger with debits,
  credits, and trial balance. LedgerLens emits a categorized
  transaction sheet — closer to a chart-of-accounts-aware CSV than
  a ledger.
- **"Verified ledger"** — combines an accountancy-loaded noun with
  a strong claim word. Even though we define "verified" as
  procedural (rule, memory, or human reviewed), buyers may read it
  as "CPA-certified" or "tax-compliant."
- **"Accountant-ready"** — implies the output is suitable for
  professional accounting use without further review.
- **"Postgres-ready"** — in a status table next to "Shipped",
  reads as "ready to run in production on Postgres." The truth is
  the models are SQLAlchemy-compatible with Postgres dialect, but
  no migration tooling, backups, or retention policies exist.
- **"Compliance" / "audit"** — `AuditEvent` is an internal audit
  trail of state changes. Saying the app has "an audit trail" is
  factually true but reads as "compliance audit-ready" to a
  buyer.
- **"Production-ready"** — used twice in the codebase, once as
  the explicit "not production-ready" disclaimer (which is good)
  and once in a comment on `/evals`. The disclaimer is helpful.

## 3. Recommended safer replacement language

| Risky term | Safer replacement |
|---|---|
| "verified ledger" / "verified ledger package" | **"verified handoff package"** or **"reviewed categorization package"** |
| "ledger export" (buyer-facing) | **"categorized transaction export"** or **"reviewed categorization export"** |
| "ledger summary" | **"reviewed categorization summary"** |
| "accountant-ready" | **"prepared for accountant review"** or **"handoff-ready"** |
| "Postgres-ready" | **"Designed against the SQLAlchemy ORM; can run against Postgres in principle. Production migration management, backups, and retention policies are not implemented yet."** |
| "verified finalized demo ledger" (TrustPanel + homepage) | **"100% of finalized demo rows are procedurally verified before handoff"** (full long form) or **"100% verified finalized demo rows"** (compact) |
| "audit trail" | OK — keep, but pair with: **"internal state-change audit log, not a compliance audit."** |
| "AI-assisted bookkeeping workflow" | OK — but pair with: **"cleanup and accountant handoff assistant; not accounting software."** |
| "production-ready" (any positive use) | Avoid. Pair with explicit "not production-ready" wherever production is implied. |

## 4. Surfaces that need updates (this PR)

- `frontend/src/app/page.tsx` — hero subhead, trust card big-number caption.
- `frontend/src/app/ledger/page.tsx` — page header.
- `frontend/src/app/handoff/page.tsx` — subhead copy.
- `frontend/src/app/demo/page.tsx` — step 6 outcome card.
- `frontend/src/app/technical-story/page.tsx` — trust card heading.
- `frontend/src/components/app/TrustPanel.tsx` — heading.
- `README.md` — TL;DR and "Sample scenario" sections + status table.
- `docs/TRUST_METRIC.md` — add the procedural-verification paragraph.
- `docs/LINKEDIN_PROJECT_STORY.md` — TL;DR + long post + Postgres-ready references.
- `frontend/src/components/marketing/GeneratedWalkthrough.tsx` — scene 6 trust card text.

## 5. Terms that can remain if carefully defined

- **`/ledger` route name** — internal route path; not buyer-facing.
  Keep the URL; rename the page heading.
- **"ledger" inside `docs/TRUST_METRIC.md`** — fine when followed
  by the procedural-verification definition.
- **`HandoffOut.ledger_period_label`** etc. internal field names —
  unchanged.
- **"workflow-level trust metric"** — fine; keep.

## 6. Final approved glossary

For future contributors, the approved buyer-facing vocabulary:

| Use this | Not this |
|---|---|
| "categorized transaction export" / "reviewed categorization export" | "verified ledger" |
| "verified handoff package" | "verified ledger package" |
| "100% verified finalized demo rows" (or full form with procedural-verification clause) | "100% verified finalized demo ledger" |
| "prepared for accountant review" | "accountant-ready" / "CPA-ready" |
| "Designed against SQLAlchemy / can run on Postgres" + "production migration management not implemented" | "Postgres-ready" without qualification |
| "internal state-change audit log" | "audit trail" (without context) |
| "cleanup and accountant handoff assistant" | "bookkeeping software" / "accounting software" |
| "procedural verification — a defensible authority (rule auto-approval, correction-memory replay, or human review) signed off" | "verified" without definition |
| "Not tax advice or a substitute for accounting review." | (silent omission) |

Procedural-verification long-form (use verbatim where space allows):

> "Verification is procedural: a defensible authority (deterministic
> rule auto-approval, correction-memory replay, or explicit human
> review) signed off on each finalized row before handoff. This is a
> workflow trust boundary, not a guarantee of accounting or tax
> correctness, and not a substitute for CPA review."
