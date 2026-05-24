# Audit event model

The `AuditEvent` row is the canonical record of every state
change a user / system action makes. Phase 2 extended it with
`business_id`, `actor_user_id`, `actor_display_name`, and
`request_id` so events can be scoped, attributed, and
correlated with the structured-logging request id.

## Schema

```
audit_events (
  id text primary key,
  entity_type text not null,
  entity_id text,
  action text not null,
  details jsonb not null default {},
  business_id text,
  actor_user_id text,
  actor_display_name text,
  request_id text,
  created_at timestamptz not null default now()
)
```

Indexes: `entity_type`, `entity_id`, `business_id`,
`actor_user_id`, `created_at`.

All Phase 2 columns are nullable so legacy events (recorded
before Phase 2) keep working unchanged.

## Service: `services.audit_log.record_audit_event`

Wraps the model write. Always takes:

- `db` — SQLAlchemy session
- `actor` — `DemoActor | None` (resolved from `get_demo_actor`)
- `action`, `entity_type`, `entity_id`
- `before`, `after`, `metadata` — JSON-shaped values that go
  under `details.before` / `details.after` / `details.metadata`
- `commit` — when True, commits the session inline

The service applies a forbidden-key filter (`_redact`) to the
details payload before persistence. Any of these keys are
dropped, even nested:

```
raw_csv, raw_row, raw_rows, row_data, csv_text,
transaction_description, account_number, routing_number,
card_number, credentials, password, secret, api_key,
anthropic_api_key, database_url
```

Test `test_audit_service_redacts_forbidden_keys` pins this.

## Actions recorded today

| Action | Triggered by |
|---|---|
| `import_profile.created` | `POST /import-profiles` |
| `import_profile.updated` | `PUT /import-profiles/{id}` |
| `import_profile.deleted` | `DELETE /import-profiles/{id}` |
| `import_profile.reset` | `POST /import-profiles/reset` |
| `mapping_profile.updated` | `PUT /mapping/profile/entries/{intent}` |
| `mapping_profile.reset` | `POST /mapping/profile/reset` |
| `mapping_preview.generated` | `POST /mapping/preview` |
| `mapping_apply.selected_rows_applied` | `POST /mapping/apply-preview` |

Review-action audits (`review_decision.*`) and owner-answer
audits (`owner_answer.recorded`) are documented as next-PR work.

## Read endpoint: `GET /audit-events`

Scoped to the active business. Query params:

- `limit` (1–200, default 50)
- `entity_type` (optional)
- `action` (optional)

Response shape (`AuditEventListOut`):

```json
{
  "total": 12,
  "business_id": "biz_...",
  "events": [...],
  "warnings": [
    "Public demo — audit events are for workflow traceability, not regulatory compliance.",
    "Actor identity is the seeded demo user; every visitor acts as the same actor.",
    "Sensitive fields (raw CSV rows, account numbers, secrets) are stripped before storage."
  ]
}
```

## Frontend `/audit` page

Reads `GET /audit-events`. Renders the events as a divided list
with action, entity, actor display name, timestamp, request id,
and a small `summarizeDetails()`-driven one-liner. Never dumps
the raw JSON.
