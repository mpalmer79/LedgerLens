# Productization gap audit

A blunt assessment of LedgerLens against a real production
small-business bookkeeping product. Written so future contributors
know exactly what's portfolio-grade, what's roadmap, and what's
intentionally out of scope.

## 1. What LedgerLens is today

A **portfolio-grade workflow demo** that shows an AI-assisted
bookkeeping cleanup loop end-to-end:

- Sample / synthetic transactions in
- Layered categorization: correction memory → deterministic rules →
  demo-stub or model
- Confidence-aware routing to a human review queue
- Plain-English owner questions
- Structured owner answers (v2)
- Accountant handoff package (markdown + CSV)
- Workflow-level trust metric
- Multi-business mapped-rule eval harness with honest reporting
- Granite State Auto Repair fictional scenario

Everything is real code (FastAPI + Next.js, persisted SQLite,
committed eval artifacts), but it is built and run as a
single-tenant **public demo with sample data**.

## 2. What it is not

- **Not production accounting software.** No double-entry, no
  accrual, no bank reconciliation, no tax handling.
- **Not multi-tenant SaaS.** No auth, no user model, no tenant
  isolation, no row-level scoping.
- **Not a finished ledger.** The "ledger" page is a categorized
  transaction sheet with verification metadata, not a structured
  debit/credit ledger.
- **Not a substitute for an accountant.** The "verified" label
  is procedural ("a defensible authority signed off") not
  substantive ("a CPA confirmed the books").
- **Not safe for real bank data uploads.** The public demo is
  intended for synthetic CSVs only.

## 3. Frontend / UX gaps

Identified by senior review. None of these are "broken"; they're
the gap between a polished demo and a tool a real small-business
owner would use at 11pm on a phone.

| Gap | Severity | Notes |
|---|---|---|
| No drag-and-drop CSV upload | Medium | Current import accepts file or pasted text; no visual drop zone, no per-row preview. |
| No CSV column-mapping wizard | Medium | Hardcoded `transaction_date / description / merchant / amount / currency / source` schema. Real bank CSVs use varied column names and debit/credit split. |
| No account-mapping wizard | Medium | Per-business intent map is hand-curated in Python. No UI to edit the map. |
| No mobile-first one-card-at-a-time review queue | High | `/review` and `/questions` are table-shaped. A phone-using owner needs single-card view with big buttons. |
| No bulk review actions | Low | "Approve all NAPA as parts" would shorten the cleanup loop. |
| No split transactions | Medium | A single bank line can't be split across two categories. |
| No accountant collaboration | High | Handoff is a one-way export; an accountant can't reply. |
| Marketing surface vs production UX imbalance | Low | Hero + walkthrough + comparison page are polished; the actual owner workflow could use more love. |

Detailed roadmap: `docs/SMALL_BUSINESS_UX_ROADMAP.md`.

## 4. Security gaps

| Gap | Severity | Notes |
|---|---|---|
| No authentication | Critical (for any non-demo deploy) | Anyone with the URL can call any endpoint. Acceptable for a public single-tenant demo; deal-breaker for production. |
| No authorization / roles | Critical | No owner / accountant / admin distinction. |
| No user model | Critical | All actions are session-less. |
| No tenant model | Critical | Single database, single business id (the sample scenario). |
| No tenant-scoped row queries | Critical | All ORM queries assume single tenant. |
| No rate limiting | High | No protection against abuse on the demo deploy. |
| Permissive CORS | High | `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=True`. Acceptable for the demo, dangerous in production. |
| No security headers | Medium | No CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy on the Next.js side. |
| No secrets management beyond env vars | Medium | Demo-mode default avoids the issue; production deploys would need a real secret store. |
| No environment separation | Medium | Single `CATEGORIZER_MODE` toggle; no staging vs prod isolation pattern. |

Detailed posture + roadmap: `docs/SECURITY_AND_PRODUCTION_READINESS.md`.

## 5. Privacy / PII gaps

| Gap | Severity | Notes |
|---|---|---|
| No PII detection in transaction descriptions | High | A real bank statement contains employee names, customer names, possibly account numbers in memos. None of that is filtered before the model fallback in `anthropic` mode. |
| No PII redaction before LLM calls | High | The Claude prompt currently sends the raw `description` field. Production would need a redaction step. |
| No audit-event redaction | Medium | `AuditEvent.details` JSON stores transaction snippets verbatim. |
| No deletion / GDPR-style data-subject-request workflow | High | No way for a user to delete their data. |
| Demo-mode skip is the current safety net | n/a | `CATEGORIZER_MODE=demo_stub` keeps Anthropic from being imported at all on the public deploy. That's the only PII firewall today. |

## 6. Accounting-domain gaps

| Gap | Severity | Notes |
|---|---|---|
| No double-entry bookkeeping | Critical (for "accounting software") | Each transaction has one category; no offsetting account. |
| No accrual vs cash basis distinction | High | All transactions treated as cash basis by description. |
| No split transactions | High | A $500 Costco run that's 50% office supplies / 50% meals can't be split. |
| No sales tax handling | High | Tax-inclusive amounts not separated from base. |
| No multi-currency normalization | Medium | `currency` is a string field but no FX. |
| No transfers between own accounts | High | Owner moving money from checking to savings counts as both an inflow and an outflow today. |
| No bank reconciliation | Critical | No statement-vs-ledger reconciliation workflow. |
| "Verified" means procedural, not substantive | High | Trust metric is workflow-level: rule auto-approval, memory replay, or human review. Casual buyers could misread it as "CPA-approved." Fixed in this PR via copy changes. |

Detailed boundary: `docs/ACCOUNTING_DOMAIN_BOUNDARY.md`.

## 7. Persistence / migration gaps

| Gap | Severity | Notes |
|---|---|---|
| Alembic in deps but not used | High | `pyproject.toml` lists `alembic`, but there's no `alembic.ini`, no `versions/`, no migration files. Production deploys would have nothing to manage schema with. |
| `init_db()` runs `create_all()` on startup | Medium | Fine for demo, not for production (no migration history, no rollback). |
| README "Postgres-ready" claim was misleading | Medium | The models are Postgres-compatible (SQLAlchemy 2.0 + generic types). Production migration management is not. Fixed in this PR via README + docs updates. |
| No backup policy | High | SQLite file on Railway is not backed up. |
| No retention / deletion policy | Medium | Audit events grow unbounded. |
| Single DB per deploy | n/a | Single-tenant by design today. |

## 8. Observability gaps

| Gap | Severity | Notes |
|---|---|---|
| No structured logging | Medium | Standard library `logging` only, mostly absent. |
| No request IDs | Medium | Errors surfaced to the user don't carry a correlation id. |
| No metrics emission | Low | No Prometheus / OpenTelemetry. |
| No log redaction utility | High | When logs are added, PII would leak. |
| Audit trail is good | Strength | `AuditEvent` records every state change; the data is there if production needed to surface it. |

## 9. Compliance / retention gaps

| Gap | Severity | Notes |
|---|---|---|
| No retention policy | Medium | Transactions, audit events, predictions grow forever. |
| No deletion endpoint | High | No way for a user to delete their cleanup data. |
| No export endpoint beyond handoff | Low | The handoff markdown + ledger CSV are exports, but no "export everything" GDPR-style endpoint. |
| No data-classification labels in code | Medium | No formal sensitive-field annotations. |

## 10. Dependency / security automation gaps

| Gap | Severity | Notes |
|---|---|---|
| No Dependabot config | Medium | Added in this PR. |
| No SBOM generation | Low | Not in scope for portfolio demo. |
| No security CI gating | Low | `npm audit` / `pip audit` not in CI. Adding noisy tools without alert triage would create false work. |
| No secret scanning beyond GitHub's default push protection | Low | GitHub's default scanning catches the obvious cases. |

## 11. Which issues should be fixed now (this PR)

- ✅ Accounting language audit + copy corrections on every buyer-facing
  surface (`docs/ACCOUNTING_LANGUAGE_AUDIT.md` + edits to homepage /
  `/handoff` / `/ledger` / `/demo` / `/technical-story` / README).
- ✅ Clarify "verified" everywhere as **procedural** verification,
  with an explicit "not CPA-reviewed, not tax-compliant" note.
- ✅ Add a demo-mode upload warning on `/transactions/import`.
- ✅ Add a production-readiness boundary section on
  `/technical-story` linking the new docs.
- ✅ Add Dependabot config.
- ✅ Document the Alembic / migration gap honestly in the README
  and remove the bare "Postgres-ready" framing.
- ✅ Document the accounting-domain boundary
  (`docs/ACCOUNTING_DOMAIN_BOUNDARY.md`).
- ✅ Document the security + production-readiness roadmap
  (`docs/SECURITY_AND_PRODUCTION_READINESS.md`).
- ✅ Document the small-business UX roadmap
  (`docs/SMALL_BUSINESS_UX_ROADMAP.md`).
- ✅ Convert any silent `except Exception: pass` to logged
  exceptions where present. (Existing exception blocks already
  `# noqa: BLE001` and surface to `/ready` — defensible, but
  documented.)

## 12. Which issues should become roadmap items

- Auth + tenant model + tenant-scoped row queries (Phase A in
  `SECURITY_AND_PRODUCTION_READINESS.md`).
- Rate limiting + request IDs + structured logging + log redaction
  (Phase B).
- Alembic migrations + backup/restore + retention/deletion (Phase
  C).
- PII detection/redaction before LLM (Phase D).
- Dependency scanning beyond Dependabot + SBOM + security CI
  (Phase E).
- Mobile-first review queue + CSV mapping wizard + account-mapping
  wizard (UX roadmap).
- Double-entry / split-transactions / sales tax / multi-currency
  (Accounting roadmap — substantial; needs CPA review).

## 13. Which issues are intentionally out of scope for a portfolio demo

- SOC2 / HIPAA / PCI compliance audits.
- Full multi-tenant deploy + tenant-scoped backups.
- Per-tenant encryption keys / KMS integration.
- Real bank-feed integrations (Plaid, Yodlee).
- Real tax / CPA workflows.
- Full double-entry accounting engine.
- Mobile apps (React Native / iOS / Android native).
- Real-time collaboration with an accountant inside LedgerLens.

The portfolio demo's value is demonstrating clean engineering
practice + honest measurement on a focused workflow, not building
all of QuickBooks. Documenting the scope boundary is more honest
than pretending these things are coming "in v2."

## Acceptance criteria

- ✅ Audit is blunt.
- ✅ Distinguishes portfolio demo from production SaaS.
- ✅ Does not hand-wave serious gaps.
- ✅ Cross-links to the four new boundary docs.
