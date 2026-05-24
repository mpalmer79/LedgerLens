# Demo session and business context

LedgerLens Phase 2 introduces a stateless, demo-only session
foundation. It is **not** production authentication.

## What the demo session is

- A FastAPI dependency (`get_demo_actor`) that resolves to the
  seeded `Demo Owner` user + the `Granite State Auto Repair`
  business on every request.
- A `GET /session` endpoint that returns the resolved actor +
  business + a list of honesty warnings the UI must echo.
- A "Demo session · Granite State Auto Repair · Demo Owner"
  badge in the AppShell header.

## What the demo session is not

- Not a login. Anyone visiting the public deploy acts as the
  same demo user.
- Not a cookie / JWT / signed token. The session is stateless;
  every request resolves the same context.
- Not a per-tenant boundary. Existing `Transaction` /
  `CategorizationResult` / `ReviewDecision` rows have no
  `business_id` and are shared.

## Endpoints

| Verb | Path | Behavior |
|---|---|---|
| `GET` | `/session` | Returns demo actor + business + warnings. |
| `POST` | `/session/demo` | Idempotent — same shape as GET. Kept for API symmetry. |
| `POST` | `/session/logout` | 204 no-op; the stateless demo has nothing to clear. |

## Response shape

```json
{
  "authenticated": true,
  "mode": "demo",
  "user": {
    "id": "usr_...",
    "display_name": "Demo Owner",
    "role_hint": "owner"
  },
  "business": {
    "id": "biz_...",
    "name": "Granite State Auto Repair",
    "slug": "granite-state-auto-repair",
    "is_demo": true
  },
  "warnings": [
    "Public demo session uses fictional data.",
    "This is not production authentication — every visitor acts as the same demo user.",
    "Business context is a portfolio foundation, not complete tenant isolation.",
    "Do not upload real bank data."
  ]
}
```

## How mutation routes use the actor

Every mutation route that should be audit-traceable injects
`actor: DemoActor = Depends(get_demo_actor)`. The audit service
reads `actor.user_id`, `actor.display_name`, `actor.business_id`,
and `actor.request_id` and persists them on the new
`AuditEvent` columns.

`get_demo_business_id()` is a convenience dependency for routes
that only need the business scope.

## Future production auth

When real auth lands (cookies + sessions + password hashes), the
plan is:

1. Add a `password_hash` column on `User`.
2. Add a `Session` table or signed-cookie middleware.
3. Replace `get_demo_actor` with a `get_current_user_actor`
   resolver that reads `request.state.current_user`.
4. The route signatures stay put; only the dependency body
   changes.

## Limitations

- One demo user is shared across all visitors of a deploy. The
  visible badge says so.
- No CSRF protection (no cookies to protect).
- No rate limiting on session endpoints.
- The `actor_user_id` recorded on audit events is the seeded
  demo user id — not meaningful as audit evidence for a real
  workflow.
