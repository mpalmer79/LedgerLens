# Auth/Tenant Phase 2 audit

A blunt audit before the sprint. What single-business assumptions
exist today, which mutation routes need actor identity, and what
"tenant foundation" honestly means in a portfolio prototype.

## 1. Current single-demo-business assumptions

- `tenant_context.active_business_id()` is hard-coded to
  `granite_state_auto_repair` via `SAMPLE_SCENARIO`.
- `CsvImportProfile.business_id` and
  `CategoryMappingProfile.business_id` columns exist but are
  always set to the demo business id.
- No `Transaction` / `CategorizationResult` / `ReviewDecision`
  table carries a `business_id`. They are implicitly part of the
  single demo workspace.
- The Phase 1 seed creates one `Tenant` + one `Business`
  ("LedgerLens Demo Organization" + "Granite State Auto Repair")
  and no users.

## 2. Routes that mutate state

| Route | Today | Phase 2 target |
|---|---|---|
| `POST /transactions` | unauth, no actor on audit | actor + business via demo session |
| `POST /transactions/import` | unauth | actor + business |
| `POST /categorize` | unauth | actor + business (system-actor when called by retry/job) |
| `POST /review-queue/*/{approve,correct,uncategorizable,accountant-review}` | unauth | actor + business |
| `POST /import-profiles[...]` (CRUD + reset + validate) | unauth | actor + business |
| `POST /mapping/profile/entries/{intent}` | unauth | actor + business |
| `POST /mapping/profile/reset` | unauth | actor + business |
| `POST /mapping/preview` | unauth | actor + business (read-only audit) |
| `POST /mapping/apply-preview` (NEW) | n/a | actor + business + per-row apply |
| `POST /demo/seed` / `/demo/reset` | unauth | actor + business |
| `GET /ledger/export.csv`, `/handoff/export.*` | unauth | actor + business (export audit) |

## 3. Routes that should eventually require actor identity

Every mutation above. The Phase 2 sprint adds the **demo actor
context** dependency, and the mutations that touch
business-scoped data (mapping, import profiles, mapping apply,
review actions) get audit events with the actor's display name +
user id.

Read-only public routes (`/health`, `/ready`, `/demo/ready`,
`/demo/status`, marketing pages) stay open.

## 4. Data that should be business-owned

Already business-scoped (in column shape):

- `CsvImportProfile.business_id`
- `CategoryMappingProfile.business_id`
- `CategoryMappingEntry.profile_id → CategoryMappingProfile.business_id`

**Not yet business-scoped:**

- `Transaction`
- `CategorizationResult`
- `ReviewDecision`
- `CorrectionMemory`
- `AuditEvent` (will gain `business_id` this sprint)
- `AccountCategory` (shipped as a global COA; out of scope for
  this sprint)

Adding `business_id` to the four "not yet" tables is a much
larger PR — it needs a backfill + an enforcement story across
every existing query. **Deferred to Phase 3 of the auth
rollout.** This sprint documents the gap and adds the columns
only where the audit / apply paths read them.

## 5. Why mapping apply needs `actor_user_id`

Apply rewrites the final category code on existing rows. Without
an actor, an audit entry says "something changed [old → new]" with
no defensible owner. With an actor, the audit entry can answer
"who decided to flip these 12 rows?" and "is that person on the
membership for this business?" That single answer is the gate the
review-safety sprint needs to enforce that human corrections stay
sticky and accountant-follow-up rows stay protected.

In this sprint the actor is the seeded demo user — explicitly
labelled "demo" everywhere it surfaces.

## 6. What "tenant foundation" means here

**This sprint:**

- A real `User` + `Business` + `Membership` schema (already
  shipped in Phase 1).
- A session endpoint that exposes the demo user / business as a
  resolved context.
- A `get_current_actor()` FastAPI dependency that future routes
  use.
- An `AuditEvent` extended with `business_id` + actor metadata.
- Business-scoped reads for `/import-profiles`, `/mapping/profile`,
  `/audit-events`.

**Not this sprint:**

- Password auth, signup, email verification, password reset.
- Real session middleware with cookies / CSRF / OAuth.
- Per-tenant rate limiting.
- Backfill of `business_id` onto existing
  Transaction/CategorizationResult/ReviewDecision tables.
- Cross-tenant SQL leak prevention (the demo runs single-tenant).

## 7. What remains out of scope for production auth

- Passwords / argon2 / login forms.
- JWT or signed cookie issuance.
- Email-based account recovery.
- SSO (SAML / Google / etc.).
- MFA.
- Lockout / brute-force protection.
- Role-based access enforcement beyond a single `role` string
  recorded on `Membership`.

## 8. Security limitations

- Public demo session means **anyone with the URL acts as the
  same demo user**. The visible "Demo session" badge says so.
- No CSRF protection on demo session endpoints (no cookies).
- No real authorization — `get_current_actor()` resolves the
  seeded demo user when no other context is present.
- The recorded `actor_user_id` is the demo user id; not
  meaningful as audit evidence.
- The mapping-apply audit event exists and is honest, but the
  underlying decision was made by an unauthenticated demo
  visitor.

## 9. Data ownership limitations

- Existing transactions / categorization results / review
  decisions have **no** `business_id`. The demo workspace is the
  whole world.
- Audit events recorded this sprint will carry `business_id`,
  but a future multi-tenant deploy needs to backfill the
  per-row columns before any real isolation guarantee.

## 10. Proposed implementation plan

A. **Architecture/audit first.** This doc.
B. **DB models + migrations.** Extend `AuditEvent` with
   `business_id`, `actor_user_id`, `actor_display_name`,
   `request_id`. Backfill via Alembic. (User/Business/Membership
   already exist from Phase 1.)
C. **Demo-safe session.** `GET /session`, `POST /session/demo`,
   `POST /session/logout`. Seeded demo user + membership.
   `get_current_actor()` dependency.
D. **Business context normalization.** `/import-profiles`,
   `/mapping/profile`, `/mapping/preview` already business-scoped
   via `active_business_id()`. New audit endpoint scopes the same
   way.
E. **Actor-aware audit service.** Single `record_audit_event()`
   service. Replaces ad-hoc `AuditRepo.record()` calls in
   mapping/import-profile/review paths.
F. **Selected-row mapping apply.** `POST /mapping/apply-preview`
   with strict server-side eligibility recalculation.
G. **UI integration.** AppShell session badge, `/audit` page,
   `/mapping` apply UI.
H. **Tests + docs.** Locked-down contracts; honest copy.

## 11. Acceptance criteria

1. `AuditEvent` carries `business_id`, `actor_user_id`,
   `actor_display_name`, `request_id`. Existing rows are safe.
2. `GET /session` returns the demo user + business + warnings.
3. `get_current_actor()` and `get_current_business()` dependency
   exist and are used by the mapping apply endpoint.
4. `POST /mapping/apply-preview` applies only selected eligible
   rows, recalculates eligibility server-side, and records an
   audit event.
5. Protected rows (human-corrected, accountant-follow-up,
   ACCOUNTANT_REVIEW_REQUIRED, UNCATEGORIZABLE, correction-
   memory) are rejected even if the frontend tries to apply
   them.
6. `GET /audit-events` returns recent events scoped to the
   current business.
7. AppShell shows "Demo session · Granite State Auto Repair"
   without claiming production auth.
8. Public demo works without login.
9. Docs explicitly say what this sprint does and does not give.
10. Tests pin every contract above.
