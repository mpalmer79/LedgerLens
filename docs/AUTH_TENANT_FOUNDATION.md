# Auth and tenant foundation

Design-only. Production auth and per-tenant isolation are not
implemented. This document captures the schema, scoping rules, and
rollout phases so the next implementation PR has a blueprint to
follow.

## 1. Current no-auth demo state

LedgerLens runs as a single-tenant public demo:

- Anyone can hit any endpoint without authenticating.
- A single shared SQLite database holds every row.
- The "active business" is hard-coded as Granite State Auto Repair
  (`backend/src/ledgerlens/data/business_rule_maps.py`).
- The `/transactions/import` page carries two visible warnings
  against uploading real bank data. The README + technical-story
  page repeat the warnings.

This is correct for a portfolio demo; it is not safe for any kind of
real owner workflow.

## 2. Why production needs auth and tenant isolation

Without auth + tenants:

- Any visitor can see and overwrite any other visitor's transactions.
- The audit trail has no way to attribute a decision to a specific
  human.
- The intent → category mapping is a Python file, not editable.
- Memory rules learned for business A can suggest categories for
  business B (one shared `correction_memory` table today — fine for
  the demo, unsafe in production).
- A `/handoff` export reveals the full ledger of whoever wrote it
  last.

## 3. Proposed entities

| Entity | Key | Notes |
|---|---|---|
| `User` | `user_id`, email, password hash (or SSO provider id), display name | Standard auth shape. |
| `Tenant` (a.k.a. Organization) | `tenant_id`, name, plan, created_at | A single billing scope. |
| `Membership` | `(user_id, tenant_id)`, role | Role enum: owner / accountant / member. |
| `Business` | `business_id`, tenant_id, name, fiscal_year_start, COA snapshot | A real-world business owned by one tenant. One tenant can have many businesses (an accountant managing several clients). |
| `Account` | `account_id`, business_id, code, name, type, active | Per-business chart of accounts. |
| `Transaction` | `transaction_id`, business_id, … | Already exists. Add a non-nullable `business_id` FK in the auth/tenant PR. |
| `CategorizationResult` | … `business_id` (derived) | Scoped via transaction. |
| `ReviewDecision` | … `actor_user_id`, `business_id` (derived) | Records who made the decision. |
| `AuditEvent` | … `actor_user_id`, `tenant_id`, `business_id` | Already exists; extends with the actor + tenant fields. |
| `BusinessIntentMap` | `(business_id, intent)`, `category_code`, `block_fallback`, `updated_at` | Replaces the Python `business_rule_maps.py` once persistence is live. |
| `Session` | `session_id`, user_id, expires_at, last_seen_at, ip, user_agent_hash | For cookie-based auth. JWT alternative would skip this table. |

A `Membership` row gives a user access to a tenant; access to a
specific business is implicit (a user with any role on tenant T has
visibility into every business under T). Per-business permissions can
be added later via a `BusinessMembership` table.

## 4. Tenant scoping rules

Every read and write must be scoped to the active tenant:

1. Auth middleware resolves `current_user` from the session token.
2. The request must supply (or default to) a `tenant_id` the user is
   a member of. If the user has memberships in multiple tenants, the
   token / cookie carries the active one.
3. Repository helpers always filter by `tenant_id` (and `business_id`
   when relevant). A query helper like
   `TransactionRepo.for_business(business_id)` enforces it.
4. SQL constraints: every multi-tenant table has a `tenant_id`
   foreign key; every per-business table has a `business_id` FK. Add
   composite indexes on `(tenant_id, …)` for hot queries.
5. Test fixture: every API test gets a fresh tenant + user; any
   accidental cross-tenant read fails the test.

## 5. Migration strategy

Pick `alembic`. Each PR ships:

- A migration that adds the new column (`tenant_id` / `business_id`)
  as nullable.
- A backfill script that assigns the demo's existing rows to the
  seeded `granite_state_auto_repair` tenant + business.
- A follow-up migration that flips the column to `NOT NULL` once
  every row is backfilled.

Demo data should keep working through the migration window — the
backfill makes the demo's existing transactions belong to a
"public-demo" tenant the seed script creates.

## 6. Backfill strategy for demo data

- The seed script (`ledgerlens.seed`) creates the public-demo tenant
  + the Granite State business + a single seed user (the only user
  who can sign in to the demo, with a generated password printed on
  startup so it isn't checked in).
- Every existing row gets assigned to that tenant + business in the
  same script.
- The `business_rule_maps.py` map becomes the seed value for
  `BusinessIntentMap` rows for that business.

The demo continues to behave as today (no login required) until the
auth middleware is enabled. At that point the demo deploy gains a
"log in as demo user" button.

## 7. API authorization strategy

- Use cookie + CSRF token for browser clients (frontend is
  same-origin via Next on Railway).
- Add a small `auth.py` module that exposes `current_user` as a
  FastAPI dependency. Every router that touches tenant data injects
  it.
- 401 when no session; 403 when the session exists but lacks access
  to the requested tenant / business.
- Audit every successful write with `actor_user_id` filled in.
- Rate limit unauthenticated routes (`/health`, `/ready`, the
  marketing API) more aggressively than authenticated ones.

## 8. Future route protection plan

Phased rollout to avoid breaking the demo:

| Phase | Routes protected | Notes |
|---|---|---|
| 0 (today) | none | All routes public. |
| 1 | `/admin/*` | New routes for tenant settings. Demo users see them with limited capabilities. |
| 2 | All write routes | `POST /transactions`, `/categorize`, `/review-queue/*`, `/transactions/import`. Demo deploy auto-logs-in a guest user with a write-rate-limited token. |
| 3 | All read routes | `/ledger`, `/handoff`, `/rules`, `/mapping`, `/transactions`. Public demo becomes "view-only without login; full access after login". |
| 4 | Audit + admin | `/audit`, `/admin` require an explicit role. |

## 9. Risks and rollout phases

- **Phase 0 → 1**: low risk. Adds routes that didn't exist before.
- **Phase 1 → 2**: medium risk. Existing demo flows need a guest
  session. Test plan: every existing API test gets a fixture that
  installs a guest auth dependency override.
- **Phase 2 → 3**: medium risk. The demo deploy needs a stable
  "sign in" link with a pre-provisioned guest user.
- **Phase 3 → 4**: low risk if Phase 2-3 land cleanly.

What this PR does:

- This file (the blueprint).
- The /mapping page + /rules endpoint already make the
  per-business mapping visible. They are read-only and explicitly
  call out that production tenanting is not implemented.
- The category mapping wizard is deferred until Phase 2 ships.

What this PR does NOT do:

- No `User`, `Tenant`, `Membership`, or `Session` tables.
- No login UI, password reset, or JWT issuance.
- No tenant scoping on existing repositories.
- No protected routes.

Each of those is its own follow-up PR, sequenced as above.
