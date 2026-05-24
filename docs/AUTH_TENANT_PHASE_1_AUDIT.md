# Auth/Tenant Phase 1 audit

A blunt audit of the current no-auth state and what Phase 1 should
add. Schema foundation only — this sprint does not implement
production authentication.

## 1. Current no-auth / no-tenant state

- No `User` model. No `Tenant` / `Organization` / `Membership` /
  `Business` models.
- No `request.state.current_user`. No session token, no JWT, no
  cookie auth.
- No protected routes. Every endpoint is publicly reachable.
- `business_rule_maps.py` hard-codes `active_business_id() =
  "granite_state_auto_repair"` for the entire process.
- `init_db()` calls `Base.metadata.create_all()` on app startup —
  fine for SQLite demo, not durable for production schema changes.
- Alembic is in `pyproject.toml` dependencies but no config, no
  `alembic/` directory, no migrations.
- `docs/AUTH_TENANT_FOUNDATION.md` documents the intended schema
  but ships no code.

## 2. Existing models that will eventually need tenant scoping

| Model | Scope today | Future scope |
|---|---|---|
| `AccountCategory` | global | per-business (each business has its own COA) |
| `Transaction` | global | per-business |
| `CategorizationResult` | per-transaction | per-business via transaction |
| `ReviewDecision` | per-result | per-business + per-user |
| `CorrectionMemory` | global | per-business |
| `AuditEvent` | global | per-tenant + per-business + per-user (actor) |

This sprint does **not** retrofit any of these. Adding nullable
`business_id` / `tenant_id` foreign keys before the data model is
agreed creates worse problems than not having them.

## 3. Existing database initialization behavior

- `init_db()` is called from the lifespan startup handler.
- It calls `Base.metadata.create_all()` — idempotent table creation.
- Demo deploy seeds the chart of accounts via
  `seed_chart_of_accounts()`.
- SQLite is the default; Postgres is "supported in principle"
  through `database_url`.

This works for the demo. It is not production-grade because there is
no path to evolve the schema without dropping tables.

## 4. Alembic / migration status

- Alembic is listed as a dependency in `pyproject.toml`.
- No `alembic.ini`, no `alembic/env.py`, no `alembic/versions/`.
- No CI step runs migrations.
- `README.md` does not mention migrations.

## 5. Recommended Phase 1 scope

**In scope:**

1. Alembic baseline (`alembic.ini`, `env.py`, `versions/`) wired to
   the existing `Base.metadata`. One initial migration that captures
   the **current** schema plus the new auth/tenant tables.
2. Four new models: `User`, `Tenant`, `Membership`, `Business`. No
   foreign keys from existing tables yet — those are Phase 2.
3. A `TenantContext` helper + `get_demo_tenant_id()` /
   `get_demo_business_id()` constants. No retrofit of existing
   queries.
4. Demo seed: one `Tenant` ("LedgerLens Demo Organization"), one
   `Business` ("Granite State Auto Repair"). No demo users
   (fictional emails are still PII-shaped and we don't need them
   yet).
5. New backend route `GET /admin/foundation/status` that reports
   the state of the foundation honestly.
6. New frontend `/admin` route that surfaces the same status with
   explicit "not production" copy and no fake login form.
7. Read-only design for future `CategoryMappingProfile` /
   `CategoryMappingEntry` models, included in this PR's schema only
   if the migration story is clean. Otherwise documented as Phase 2.
8. `init_db()` keeps working for the SQLite demo. Production docs
   point to Alembic.

**Explicitly out of scope:**

- Password hashing, login UI, session management, JWT, OAuth.
- Tenant scoping on existing queries.
- Editable category mapping UI.
- Invitations, email flows.
- Per-tenant rate limiting, billing, etc.

## 6. What must remain public-demo behavior

- `/transactions/import`, `/categorize`, `/review-queue/*`,
  `/ledger`, `/handoff`, `/rules`, `/mapping`, `/questions`, `/app`,
  `/cleanup`, `/demo`, `/evals`, `/transactions/[id]` all work
  without authentication.
- The demo's existing sample-data flow continues.
- The two "do not upload real bank data" warnings stay in place on
  `/transactions/import`.

## 7. What must not be claimed yet

- "Production authentication."
- "Login is implemented."
- "Tenant isolation is enforced."
- "Multi-tenant ready."
- "Production-secure."
- "Safe for real bank data."

The `/admin` shell and docs must be explicit that these are not
done.

## 8. Risks and migration considerations

- **Risk 1 — Alembic baseline diverges from `create_all`.**
  Mitigation: the initial migration is generated from the current
  `Base.metadata`, so the schema is identical. Tests use
  `create_all` against an in-memory SQLite as today.
- **Risk 2 — Adding new tables breaks the demo startup.**
  Mitigation: new models are added to `Base.metadata` via the
  models package; `create_all` picks them up. SQLite handles
  every column type used.
- **Risk 3 — Seeding fictional data leaks into real deployments.**
  Mitigation: seed entries use `.example` / `.example.invalid`
  domains; tenant/business slugs are clearly `ledgerlens-demo` /
  `granite-state-auto-repair`.
- **Risk 4 — Frontend `/admin` route is mistaken for real auth.**
  Mitigation: explicit copy on the page; no input form, no token
  exchange. Top-of-page banner makes the boundary obvious.

## 9. Acceptance criteria

1. Alembic baseline exists and at least one migration applies cleanly
   to an empty SQLite database.
2. `User`, `Tenant`, `Membership`, `Business` models exist with
   unique constraints where appropriate.
3. The demo `Tenant` and `Business` are seeded by the existing
   startup path.
4. `GET /admin/foundation/status` returns an honest snapshot.
5. `/admin` renders the same snapshot with explicit "not
   production" copy and links to the relevant docs.
6. Every existing public demo route works without authentication.
7. No copy regression — no live route claims production auth or
   tenant isolation is complete.
8. Tests cover the new models, the new endpoint, the demo seed,
   and the public-demo regression check.
