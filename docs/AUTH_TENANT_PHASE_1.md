# Auth/Tenant Phase 1

Schema foundation. No production authentication, no login UI, no
protected routes, no tenant scoping on existing queries. Phase 2
will build on what this PR ships.

## 1. What Phase 1 added

- Four core auth/tenant SQLAlchemy models: `User`, `Tenant`,
  `Membership` (+ `MembershipRole`), `Business`.
- Two design-only models for the future editable category mapping
  wizard: `CategoryMappingProfile`, `CategoryMappingEntry`.
- An Alembic baseline (`alembic.ini`, `alembic/env.py`,
  `alembic/versions/15d9df38c0b3_baseline_schema.py`) wired to the
  existing `Base.metadata`.
- `TenantContext` dataclass + helpers in
  `backend/src/ledgerlens/tenant_context.py`.
- Demo seed: `seed_demo_tenant()` idempotently creates the
  `LedgerLens Demo Organization` tenant and the
  `Granite State Auto Repair` business.
- Backend endpoint `GET /admin/foundation/status` that reports the
  state of the foundation honestly.
- Frontend `/admin` route that renders the same snapshot with
  explicit "not production" framing and no fake login form.
- Tests: 13 new backend tests + 5 new frontend tests.

## 2. What it did not add

- No `password_hash` column, no `Session` table.
- No login UI, no signup flow, no password reset.
- No JWT issuance, no cookie-based session middleware.
- No protected routes — every endpoint remains public.
- No tenant scoping on `Transaction`, `CategorizationResult`,
  `ReviewDecision`, `CorrectionMemory`, `AuditEvent`.
- No editable category mapping UI. `/mapping` is still read-only.
- No SSO / OAuth providers.
- No rate limiting on public routes.
- No billing, plans, or quotas.

## 3. Models added

| Model | PK prefix | Notes |
|---|---|---|
| `User` | `usr_` | `email` is unique. No password column yet. |
| `Tenant` | `ten_` | `slug` is unique. Soft-delete via `disabled_at`. |
| `Membership` | `mem_` | Unique `(user_id, tenant_id)`. Role enum: `owner`, `admin`, `accountant`, `reviewer`, `viewer`. |
| `Business` | `biz_` | Unique `(tenant_id, slug)`. Belongs to one tenant. |
| `CategoryMappingProfile` | `cmp_` | Per-business; unique `(business_id, name)`. |
| `CategoryMappingEntry` | `cme_` | Per-profile; unique `(profile_id, intent)`. |

Every model uses the existing
`DateTime(timezone=True)` + `default=lambda: datetime.now(UTC)`
pattern that the rest of the codebase uses for `created_at` /
`updated_at` / `disabled_at`.

## 4. Migration baseline

- `alembic.ini` lives at `backend/alembic.ini`. `sqlalchemy.url` is
  a SQLite placeholder; the real URL is read from
  `ledgerlens.config.get_settings().database_url` in `env.py`.
- `alembic/env.py` imports `ledgerlens.models` so every table
  registers with `Base.metadata` before autogenerate runs. SQLite
  gets `render_as_batch=True` for future column-drop / type-change
  safety.
- One baseline revision captures the full schema as of this PR:
  every existing table plus the six new auth/tenant tables.
- A test (`tests/test_alembic_baseline.py`) runs
  `alembic upgrade head` against a fresh SQLite DB inside the test
  process and asserts the resulting tables match
  `Base.metadata.create_all`. This pins the two paths together so
  they cannot silently drift.

To run migrations locally:

```
cd backend
DATABASE_URL=sqlite:///./ledgerlens.db alembic upgrade head
```

The SQLite demo still uses `Base.metadata.create_all()` at lifespan
startup. The docs and `/admin` page both call this out — Alembic is
the production migration path; `create_all` is the demo-mode
bootstrap.

## 5. Demo tenant / business behavior

- `seed_demo_tenant(db)` is called from the lifespan startup right
  after `seed_chart_of_accounts(db)`.
- It is idempotent — re-running it returns the existing rows
  unchanged.
- Slugs are `ledgerlens-demo` and `granite-state-auto-repair`.
  Neither can collide with realistic production data.
- No user is seeded. Phase 2 will add a demo user when login lands.

## 6. Admin shell behavior

`/admin` renders the backend's foundation snapshot verbatim:

- A top-of-page amber warning: "Authentication and tenant isolation
  are not fully implemented in this public demo. Do not upload real
  bank data."
- A status list with one row per model + capability. Models present
  show "added" + a green tick. Production auth and full tenant
  enforcement show "not implemented" / "not complete" + an amber
  marker.
- Four count cards (users / tenants / memberships / businesses)
  filled from the live DB.
- Honesty warnings echoed from the backend response.
- A "Login UI" section with the explicit text "Login UI is
  intentionally not implemented in this public demo." No `<input
  type="password">`, no `<input type="email">`, no `<form>`.
- Three external doc links: `SECURITY_AND_PRODUCTION_READINESS.md`,
  `AUTH_TENANT_FOUNDATION.md`, `ACCOUNTING_DOMAIN_BOUNDARY.md`.

The frontend test block in `page-content.test.ts > admin / tenant
foundation page` pins every contract above.

## 7. Current route protection status

**None.** Every existing route is publicly reachable, including
`/admin` and `/admin/foundation/status`. The latter is intentionally
public because it advertises the foundation's incomplete state, not
sensitive data.

The endpoint's response excludes `DATABASE_URL`, env vars, secrets,
and inbound headers. A test
(`test_foundation_status_does_not_leak_environment`) pins this.

## 8. Current tenant-enforcement status

**Not enforced.** Existing rows (`Transaction`, `CategorizationResult`,
`ReviewDecision`, `CorrectionMemory`, `AuditEvent`,
`AccountCategory`) have no `tenant_id` / `business_id` columns.
Adding them before the data-model is agreed creates more confusion
than safety, so Phase 1 stops short of that.

`TenantContext` and `require_tenant_context()` exist so future
protected routes can adopt the dependency signature without
re-shuffling every endpoint when Phase 2 lands.

## 9. Future Phase 2 plan

1. Add `password_hash` (argon2), `Session` table, login UI behind a
   feature flag. Demo deploy auto-issues a guest session so the
   existing public flows continue to work.
2. Wire `require_tenant_context()` to read `current_user` from the
   session and resolve their active membership.
3. Migrate `Transaction`, `CategorizationResult`, `ReviewDecision`,
   `CorrectionMemory`, `AuditEvent`, `AccountCategory` to carry
   `business_id` / `tenant_id`. Migrations add the column as
   nullable, backfill to the demo business, then flip to
   `NOT NULL`.
2. Move `business_rule_maps.py` content into
   `CategoryMappingProfile` / `CategoryMappingEntry` rows seeded for
   the demo business. `/rules` and `/mapping` read from the table.
3. Build the editable mapping wizard at `/mapping`.
4. Add an `accountant` role flow with reply threads on review
   items.

## 10. Risks and limitations

- **Alembic / create_all drift.** Mitigated by
  `test_alembic_upgrade_head_applies_cleanly` which fails if the two
  paths produce different table sets.
- **Foundation status endpoint leak.** Mitigated by
  `test_foundation_status_does_not_leak_environment`.
- **/admin route mistaken for real auth.** Mitigated by the visible
  amber warning + the explicit "Login UI is intentionally not
  implemented" copy + no input form.
- **Demo seed in production.** Mitigated by the slugs being clearly
  demo-flavored; a real deploy that runs the same lifespan will
  also seed those rows, which is acceptable because they have no
  real PII and the slugs are stable.
- **The new tables are unused.** Acceptable for Phase 1 — they are
  the foundation Phase 2 needs.
