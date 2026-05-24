# Auth/Tenant Phase 1 — sprint review

## 1. What changed

- Six new SQLAlchemy models: `User`, `Tenant`, `Membership` (+
  `MembershipRole`), `Business`, `CategoryMappingProfile`,
  `CategoryMappingEntry`.
- Alembic baseline: `alembic.ini`, `alembic/env.py`, one initial
  migration that covers the full schema.
- New tenant helpers in
  `backend/src/ledgerlens/tenant_context.py`.
- `seed_demo_tenant()` in `ledgerlens.seed` is called from
  lifespan startup.
- New backend endpoint: `GET /admin/foundation/status`.
- New frontend route: `/admin`.
- New / updated docs: `AUTH_TENANT_PHASE_1_AUDIT.md`,
  `AUTH_TENANT_PHASE_1.md`, `AUTH_TENANT_FOUNDATION.md`,
  `SECURITY_AND_PRODUCTION_READINESS.md`,
  `CATEGORY_MAPPING_WIZARD.md`, `SMALL_BUSINESS_UX_ROADMAP.md`,
  `IMPLEMENTATION_GAP_ANALYSIS.md`, `README.md`.

## 2. Why this was the right next PR

The previous sprint shipped workflows that already imply
ownership: editable category mapping, accountant collaboration,
saved settings, audit retention. Doing any of those without first
agreeing on a schema for users, tenants, and businesses would
mean redesigning the data model twice. This PR makes the schema
decision once, in a way that doesn't break the demo, and lets the
follow-up sprint focus purely on the auth flow + retrofit.

## 3. Models added

| Model | PK prefix | Uniques | Purpose |
|---|---|---|---|
| `User` | `usr_` | `email` | Identity. No password column yet. |
| `Tenant` | `ten_` | `slug` | Billing scope. |
| `Membership` | `mem_` | `(user_id, tenant_id)` | Role binding. |
| `Business` | `biz_` | `(tenant_id, slug)` | Owned by a tenant. |
| `CategoryMappingProfile` | `cmp_` | `(business_id, name)` | Future editable mapping. |
| `CategoryMappingEntry` | `cme_` | `(profile_id, intent)` | Per-intent override. |

## 4. Alembic / migration baseline

- `alembic.ini` placeholder URL; the real URL is read from
  `ledgerlens.config.get_settings()` in `env.py`.
- `env.py` imports `ledgerlens.models` so `target_metadata =
  Base.metadata` covers every table.
- `render_as_batch=True` on SQLite for future column-drop /
  type-change safety.
- One baseline revision in `alembic/versions/` captures the full
  schema.
- `tests/test_alembic_baseline.py` runs `alembic upgrade head`
  against a fresh SQLite DB inside the test process and asserts
  the resulting tables match `Base.metadata.create_all`. The two
  paths cannot silently drift.

## 5. Demo behavior

- `seed_demo_tenant()` runs after `seed_chart_of_accounts()` in
  the lifespan startup.
- It's idempotent — slugs are stable, re-running returns the
  existing rows.
- No user is seeded.
- Existing public-demo routes work unchanged. The full request
  matrix is pinned by
  `test_public_demo_routes_still_work_without_auth`.

## 6. Admin shell behavior

- `/admin` is publicly reachable (the foundation snapshot is not
  sensitive — it advertises what's missing).
- Top of page: amber alert banner with "Authentication and tenant
  isolation are not fully implemented in this public demo."
- Status list with one row per model + capability. Production
  auth, route protection, and full tenant enforcement are
  explicitly tagged "not implemented" / "not complete".
- Counts panel with users / tenants / memberships / businesses.
- Honesty warnings echoed from the backend response.
- A "Login UI" section: "Login UI is intentionally not
  implemented in this public demo." No `<input type="password">`,
  no `<input type="email">`, no `<form>`.
- Three external doc links: `SECURITY_AND_PRODUCTION_READINESS.md`,
  `AUTH_TENANT_FOUNDATION.md`, `ACCOUNTING_DOMAIN_BOUNDARY.md`.

## 7. What is still not implemented

- No login flow.
- No session middleware, no JWT, no cookie auth.
- No protected routes.
- No tenant scoping on existing tables (`Transaction`,
  `CategorizationResult`, `ReviewDecision`, `CorrectionMemory`,
  `AuditEvent`, `AccountCategory`).
- No editable category mapping UI.
- No rate limiting on public routes.
- No backup / retention / deletion endpoints.

## 8. Category mapping persistence prep

`CategoryMappingProfile` and `CategoryMappingEntry` are in the
migration but **not yet read or written by any code path**. The
active mapping is still resolved from
`business_rule_maps.py`. Phase 2 will:

1. Seed `CategoryMappingProfile` rows from the Python map.
2. Read from the table at `/rules` and `/mapping` with the
   Python file as a fallback for unseeded businesses.
3. Add the editor UI behind the auth/tenant Phase 2 routes.

## 9. Security / claim boundaries preserved

- No "production authentication" claim anywhere on the live
  surface.
- No "tenant isolation is enforced" claim.
- No "safe for real bank data" claim — the public-demo warnings
  are unchanged.
- No "production-ready" claim.
- The `/admin` shell's text and the foundation-status endpoint's
  warnings are the binding contract.
- No email / phone / resume / mailto / tel links added.
- The Granite State Auto Repair fictional-sample disclaimer is
  intact.
- "Not tax advice or substitute for accounting review" is intact.

## 10. Tests added / updated

| Suite | Before | After |
|---|---|---|
| Backend pytest | 221 | **234** |
| Frontend vitest | 231 | **236** |

New backend tests (highlights):

- `test_user_model_persists_and_enforces_unique_email`
- `test_tenant_model_persists_and_enforces_unique_slug`
- `test_business_model_requires_tenant_and_enforces_per_tenant_slug`
- `test_membership_requires_user_and_tenant_unique_pair`
- `test_seed_demo_tenant_is_idempotent`
- `test_tenant_context_helper_resolves_demo_pair`
- `test_foundation_status_endpoint_returns_honest_snapshot`
- `test_foundation_status_does_not_leak_environment`
- `test_public_demo_routes_still_work_without_auth`
- `test_response_carries_request_id_header_on_admin_route`
- `test_alembic_config_files_exist`
- `test_at_least_one_baseline_migration_exists`
- `test_alembic_upgrade_head_applies_cleanly`

New frontend tests:

- `admin / tenant foundation page` block:
  - "renders foundation status with explicit not-production framing"
  - "lists every model the foundation phase adds + their status"
  - "does not ship a fake login form"
  - "links to the relevant docs (not mailto, not tel)"
  - "calls the foundation status endpoint to source the snapshot"

## 11. Remaining weaknesses

- The new `Category*` tables are unused. Acceptable for the
  foundation but means an unused-FK lint rule would surface them
  if it existed.
- No CI step runs `alembic upgrade head` against Postgres — only
  SQLite. The migration is autogenerated and may have
  PG-specific tweaks needed when first applied.
- `seed_demo_tenant()` runs on every startup; this is intentional
  but means a "real" deploy that reuses the same lifespan will
  also seed those rows. Documented; not blocking.
- `/admin/foundation/status` is publicly reachable. Phase 2 will
  add an `admin` role check.
- No CI runs the responsive smoke against real Chrome.

## 12. Recommended next PR

Pick the path that unblocks the most follow-on work:

1. **Auth Phase A.2** — `password_hash` (argon2) + `Session`
   table + `/api/auth/login` + `/api/auth/logout` + cookie-based
   session middleware behind a feature flag. Demo deploy keeps
   public flows public.
2. **Then Phase A.3** — `require_tenant_context()` resolves
   `current_user` from the session and gates `/admin/*` writes.
3. **Then Phase A.4** — retrofit `business_id` on existing tables
   via additive migrations (nullable → backfill → NOT NULL).

Other strong candidates (don't need auth):

- **Saved CSV import profiles** — `CsvImportProfile` model +
  endpoint + UI to recall a previously-mapped bank format. Pairs
  naturally with the mapping wizard work.
- **Audit retention / deletion policy** — explicit TTL on
  `AuditEvent` + a `DELETE /tenant/{id}/data` placeholder.
- **JSON-structured logging + frontend request-id surfacing** —
  finish Phase B observability.
- **Split transaction design** — model + UI work; orthogonal to
  auth.

The blunt recommendation: do Auth Phase A.2 next.
