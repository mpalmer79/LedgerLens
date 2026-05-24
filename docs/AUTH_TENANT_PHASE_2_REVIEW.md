# Auth/Tenant Phase 2 — sprint review

## 1. What changed

Three coordinated outcomes:

| Area | Outcome |
|---|---|
| **Demo-safe session + actor** | `GET /session` returns the seeded `Demo Owner` + `Granite State Auto Repair` business + honest warnings. `get_demo_actor()` dependency resolves the actor context for any FastAPI route. |
| **Actor-aware audit** | `AuditEvent` extended with `business_id`, `actor_user_id`, `actor_display_name`, `request_id`. New `services.audit_log.record_audit_event()` service + `GET /audit-events` endpoint. Mapping + import-profile mutations all record events. |
| **Safe selected-row mapping apply** | `POST /mapping/apply-preview` accepts an explicit list of selected transaction ids, recomputes eligibility server-side, applies only the eligible ones, and records an audit event with the actor. Protected categories (human-corrected, accountant-follow-up, ACCOUNTANT_REVIEW_REQUIRED, UNCATEGORIZABLE, correction-memory) are always rejected. |

## 2. Files changed

**Backend (new):**
- `src/ledgerlens/actor.py` — `DemoActor` dataclass + `get_demo_actor` / `get_demo_business_id` dependencies.
- `src/ledgerlens/api/session.py` — `GET /session`, `POST /session/demo`, `POST /session/logout`.
- `src/ledgerlens/api/audit_events.py` — `GET /audit-events` scoped to the active business.
- `src/ledgerlens/services/audit_log.py` — `record_audit_event()` + `_redact()` (drops `raw_csv`, `account_number`, `secret`, `password`, etc.).
- `alembic/versions/02a42e24f8cd_audit_event_actor_business_request_id.py` — adds `business_id`, `actor_user_id`, `actor_display_name`, `request_id` columns + indexes on `business_id` / `actor_user_id`.
- `tests/api/test_session_and_audit.py` (10 tests).
- `tests/api/test_mapping_apply.py` (10 tests).

**Backend (changed):**
- `src/ledgerlens/models/audit_event.py` — new nullable columns.
- `src/ledgerlens/seed.py` — seeds `Demo Owner` user + OWNER membership.
- `src/ledgerlens/main.py` — wires `session` + `audit_events` routers.
- `src/ledgerlens/api/mapping.py` — actor on mutations; preview audit; new `POST /mapping/apply-preview`.
- `src/ledgerlens/api/import_profiles.py` — actor on create/update/delete/reset; audit on each.

**Frontend (new):**
- `src/app/audit/page.tsx`.
- `src/lib/api/client.ts` — `getSession`, `createDemoSession`, `listAuditEventsScoped`, `applyMappingPreview` + types.

**Frontend (changed):**
- `src/components/app/AppShell.tsx` — `SessionBadge` ("Demo session · Granite State Auto Repair · Demo Owner") + `/audit` in technical nav.
- `src/app/mapping/page.tsx` — `PreviewSummaryAndRows` upgraded with checkbox selection, "Select all eligible", confirmation dialog, apply action, and audit-link result panel.
- `src/lib/page-content.test.ts` — Phase 2 test blocks.

**Docs (new):** this file, `AUTH_TENANT_PHASE_2_AUDIT.md`, `AUDIT_EVENT_MODEL.md`, `DEMO_SESSION_AND_BUSINESS_CONTEXT.md`, `MAPPING_APPLY_SELECTED_ROWS.md`.

**Docs (updated):** `README.md`, `SECURITY_AND_PRODUCTION_READINESS.md`, `IMPLEMENTATION_GAP_ANALYSIS.md`, `MAPPING_RECATEGORIZATION_PREVIEW.md`, `PERSISTENT_CATEGORY_MAPPING.md`.

## 3. What auth/session means in this demo

- The session is **stateless**. There is no cookie, no JWT, no
  password.
- `GET /session` returns the seeded demo user / business that every
  visitor shares.
- `POST /session/demo` is idempotent — it returns the same demo
  context whether or not you've "logged in" first.
- `POST /session/logout` returns 204; the demo session is shared
  per-deploy, not per-browser.
- The visible "Demo session · Granite State Auto Repair · Demo
  Owner" badge in the AppShell header tells the visitor exactly
  what's going on.

## 4. What tenant/business context does and does not guarantee

**It does:**

- Audit events carry `business_id`.
- `GET /audit-events` scopes to the current business.
- `GET /import-profiles`, `GET /mapping/profile`, and `POST
  /mapping/preview` already business-scope through
  `active_business_id()`.
- `Membership` carries the OWNER role on the demo tenant.

**It does not:**

- `Transaction`, `CategorizationResult`, `ReviewDecision`,
  `CorrectionMemory`, and `AccountCategory` do **not** carry a
  `business_id`. They are implicitly part of the single demo
  workspace.
- A real multi-tenant deploy still needs a migration to add and
  backfill those columns. The cross-tenant leak prevention story
  is **not** complete.

## 5. How audit events work

See `AUDIT_EVENT_MODEL.md`.

## 6. What data is stored in audit events

- `action` (e.g. `mapping_apply.selected_rows_applied`).
- `entity_type` + `entity_id` (e.g. `mapping_entry` +
  `parts_inventory`).
- `business_id` resolved from the actor.
- `actor_user_id`, `actor_display_name` (seeded demo user).
- `request_id` from the request-ID middleware.
- `details.before` / `details.after` / `details.metadata` —
  small JSON snippets with forbidden keys stripped.

## 7. What data is not stored

The audit service's `_FORBIDDEN_KEYS` set drops these before
persistence (test pins this):

- `raw_csv`, `raw_row`, `raw_rows`, `row_data`, `csv_text`.
- `transaction_description`, `account_number`, `routing_number`,
  `card_number`.
- `credentials`, `password`, `secret`, `api_key`,
  `anthropic_api_key`, `database_url`.

## 8. How selected-row mapping apply works

See `MAPPING_APPLY_SELECTED_ROWS.md`.

## 9. Why protected rows stay protected

Server-side eligibility recomputation. The apply endpoint never
trusts the frontend's eligibility flag; it runs the same
`_ineligibility_reason()` helper the preview uses and rejects any
row that comes back ineligible — even if the frontend passes it
in the `selected_transaction_ids` list. The test
`test_apply_rejects_human_corrected_row` proves this: the frontend
explicitly submits a protected transaction id and the server
returns `applied_count=0, rejected_count=1`.

## 10. Known limitations

- The demo session is the same for every visitor — there is no
  real identity boundary.
- `Transaction` / `CategorizationResult` / `ReviewDecision` /
  `CorrectionMemory` are not business-scoped at the column level.
  A multi-tenant deploy needs to backfill those before any real
  isolation guarantee.
- The apply endpoint commits unconditionally on success — there is
  no rollback / undo flow. A subsequent edit would create a new
  audit event but the prior state isn't replayable.
- No CSRF / rate-limiting on session/audit/apply routes (out of
  scope; the demo runs without cookies).
- `GET /audit-events` is unauthenticated (it returns the demo
  business's events; nothing else exists in the workspace).

## 11. Recommended next PR

Three roughly equal candidates:

1. **Backfill business_id on Transaction / CategorizationResult /
   ReviewDecision / CorrectionMemory.** Closes the largest
   remaining tenant-isolation gap.
2. **Real cookie-based session + login.** Replaces the stateless
   demo session with an actual identity boundary. Requires a
   password column on `User` and an `/api/auth/login` flow.
3. **Mapping-apply undo flow.** Use audit events to drive a
   "revert this apply" action; surface it on `/audit` next to each
   apply event.

The blunt recommendation: **(1) first.** It unblocks the rest of
the multi-business roadmap.
