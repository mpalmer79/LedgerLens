# Security and production readiness

Honest assessment of where LedgerLens is on the demo → production
arc. Written so a reviewer can see the gap, not be sold on it.

## 1. Current security posture

- **Single-tenant public portfolio demo.** No authentication, no
  authorization, no user model, no tenant model. Anyone with the
  URL can call any endpoint.
- **Synthetic / sample data only.** The Granite State Auto Repair
  scenario seed is fictional. The public deploy is **not** safe
  for real bank data uploads. This is documented on
  `/transactions/import` and in the README, and the demo upload
  warning is the only enforcement.
- **Demo-stub mode by default.** `CATEGORIZER_MODE=demo_stub` is
  the production setting on the Railway deploy. In demo mode the
  Anthropic SDK is never imported (regression-tested in
  `tests/api/test_demo.py::test_seed_does_not_import_anthropic_sdk`)
  so no LLM PII leakage is possible.
- **CORS is permissive.** `allow_methods=["*"]`, `allow_headers=["*"]`,
  `allow_credentials=True`. Defensible for a single-tenant demo;
  production would lock this down.
- **No production-grade secrets management.** Env vars only.
  Acceptable for the demo because the only secret in scope is
  `ANTHROPIC_API_KEY` and it's intentionally absent in demo mode.

This posture is appropriate for the project's stated identity as
a portfolio-grade workflow demo. It is **not** appropriate for any
deployment that handles real customer data.

## 2. Critical production gaps

| Gap | Severity | Why it matters |
|---|---|---|
| Authentication | **Critical** | Every endpoint is public. |
| Authorization / roles | **Critical** | No owner / accountant / admin distinction. |
| User model | **Critical** | Actions are session-less. |
| Tenant model | **Critical** | Single business id. All ORM queries assume one tenant. |
| Tenant-scoped row queries | **Critical** | Even after a tenant model lands, every query needs `WHERE tenant_id = ?`. |
| Rate limiting | **High** | No protection against demo-deploy abuse. |
| LLM usage controls | **High** | Demo-stub avoids the issue today. Production needs per-tenant budget caps + circuit breakers. |
| PII detection before LLM | **High** | Raw `description` strings go to the model in `anthropic` mode. Production needs a redaction step. |
| Structured logging | **Medium** | Stdlib `logging` only. |
| Request IDs | **Medium** | No correlation id surfaced in errors. |
| Log redaction utility | **High** | When structured logs land, PII would leak without a redactor. |
| Migrations | **High** | `alembic` is in deps but no `versions/`. `init_db()` is `create_all()`. |
| Backups | **High** | SQLite file on Railway is not backed up. |
| Retention policy | **Medium** | `Transaction` / `AuditEvent` grow unbounded. |
| Deletion / export path | **High** | No user-data-deletion endpoint. |
| Dependency scanning | **Medium** | Dependabot config added in this PR. No SBOM. |
| Secrets management | **Medium** | Env vars only. |
| Environment separation | **Medium** | One `CATEGORIZER_MODE` toggle; no staging/prod isolation pattern. |

## 3. Risk assessment

| Risk | Severity | Mitigation today |
|---|---|---|
| Real user uploads PII to public demo | High | `/transactions/import` warning panel (this PR) + sample CSV download. |
| Anthropic SDK accidentally imported in demo mode | High | Regression test asserts SDK is never imported after a demo-mode call. |
| Casual buyer misreads "verified" as CPA-correct | High | This PR rewrites buyer-facing copy + adds `docs/ACCOUNTING_DOMAIN_BOUNDARY.md`. |
| Dependency CVE introduced silently | Medium | Dependabot added in this PR; `npm test` + `pytest` already gated by CI. |
| Database schema drift in production | High | Documented gap; not implemented. |
| Permissive CORS exploited | Medium | Single-tenant demo; deal-breaker for prod. |
| Audit-trail PII leak via `details` JSON | Medium | Audit details snapshot strings include transaction descriptions. Acceptable for demo, needs redaction in production. |

## 4. Production roadmap

Phases sized so each could ship as one PR. Order is recommended,
not strict — but Phase A is a prerequisite for everything else.

### Phase A — auth + tenant model + route protection

- User table (email, password hash via `passlib`, role enum).
- Tenant table (id, name, COA snapshot reference, settings).
- `user_tenant_membership` join.
- JWT / session middleware on the FastAPI app.
- Every ORM model gains `tenant_id`; every query gets a tenant
  filter; SQLAlchemy event-listener or repository wrapper to
  prevent accidental cross-tenant queries.
- Frontend gains a sign-in screen, a tenant selector, and an
  auth-aware API client.

### Phase B — rate limiting + request IDs + structured logging + redaction

- `slowapi` or equivalent rate-limit middleware (per IP for
  unauthenticated routes; per user/tenant for authenticated).
  **⏳ Not implemented.**
- `X-Request-Id` middleware: generate if absent, echo on responses,
  thread through structured logs. **✅ Implemented.** See
  `backend/src/ledgerlens/observability.py` and
  `docs/OBSERVABILITY_AND_REDACTION.md`. CORS exposes the header so
  the browser can read it.
- Structured logging foundation: stdlib `logging` with a request-id
  filter + a baseline format string. **✅ Implemented (idempotent
  `configure_logging()`).** JSON formatter is the next upgrade.
- `sanitize_for_log(value)` utility + targeted helpers
  (`redact_email`, `redact_phone`, `redact_account_number_like`,
  `redact_card_like`). **✅ Implemented with full test coverage.**
- Frontend `<ErrorState>` surfaces request id in the technical
  details panel. **⏳ Not yet wired — utility exists, surface
  follow-up.**

### Phase C — Alembic migrations + backup/restore + retention/deletion

- `alembic init`, generate baseline migration from current models,
  wire `alembic upgrade head` into Railway startup script.
- Daily Railway-side Postgres backup with retention.
- Retention job: prune `AuditEvent` older than N days.
- `DELETE /tenant/{id}/data` endpoint with audit-event of its own.

### Phase D — PII redaction before LLM + model-provider controls + audit retention

- Pre-categorize step that runs description through a redactor
  before serializing to the Anthropic prompt.
- Per-tenant model-spend budget + circuit breaker.
- `model_provider_allowed: list[str]` per tenant.
- Retention policy for the prompt/response pairs LedgerLens
  currently stores in `CategorizationResult.explanation`.

### Phase E — dependency scanning + Dependabot + SBOM + security CI

- Dependabot config landed in this PR (`.github/dependabot.yml`).
- Add `pip-audit` and `npm audit --omit=dev` to CI with
  thresholded failure (low + medium → warn, high + critical →
  fail).
- Generate SBOM at release time (CycloneDX).
- Optional: GitHub's CodeQL scan on the FastAPI surface.

## 5. What is intentionally out of scope for the public demo

- SOC2 / HIPAA / PCI compliance audits.
- KMS-backed per-tenant encryption.
- Bank-feed integrations (Plaid, Yodlee, MX).
- Real CPA / tax workflows.
- Full double-entry accounting engine (see
  `docs/ACCOUNTING_DOMAIN_BOUNDARY.md`).
- React Native / native mobile apps.
- Real-time accountant collaboration UI.

## 6. What a real buyer should not do yet

- **Do not upload real bank statements** to the public demo. The
  upload page now warns explicitly.
- **Do not rely on the demo for tax or accounting decisions.** The
  "Not tax advice or substitute for accounting review" disclaimer
  is intentional.
- **Do not treat demo output as a CPA-reviewed ledger.** "Verified"
  in LedgerLens means procedural (rule, memory, or human review)
  — not substantively correct accounting.
- **Do not deploy this as multi-tenant SaaS** without completing
  Phase A at minimum.
