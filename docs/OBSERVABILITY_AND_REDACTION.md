# Observability and redaction

The minimum-viable observability foundation the production roadmap
needs without taking on a logging vendor, OpenTelemetry, or a full
PII pipeline.

## 1. Why request IDs were added

Production debugging needs a single id you can trace end-to-end from
the browser's network panel through the backend logs and back into
the database's audit row. Today the backend has effectively one log
line (lifespan startup) and no correlation id at all. A request ID
is the smallest building block that future production logging can
hook into without re-architecting the API.

`ledgerlens.observability.RequestIdMiddleware` runs ahead of the CORS
middleware. For every inbound HTTP request it:

1. Reads `X-Request-ID` from the inbound headers.
2. Validates it against `^[A-Za-z0-9._\-]{1,128}$` — a misbehaving
   client can't inject newlines or shell metacharacters into our
   logs.
3. Generates a fresh UUID hex if no usable id was supplied.
4. Binds the id to a `ContextVar` so any code in the same task can
   pick it up via `get_request_id()`.
5. Echoes the id back on the response as `X-Request-ID`. CORS is
   configured to expose it (`expose_headers=["X-Request-ID"]`).

## 2. Current structured logging behavior

`configure_logging()` installs a `StreamHandler` on the root logger
with the format string:

```
%(asctime)s %(levelname)s %(name)s [request_id=%(request_id)s] %(message)s
```

`RequestIdFilter` injects the active `request_id` (or `-` when none
is bound) onto every `LogRecord`. The handler is idempotent — calling
`configure_logging()` from app startup and from a test fixture is
safe.

This is not JSON-structured logging yet. The next production step
should swap `logging.Formatter` for a JSON formatter; the field set
is the same.

## 3. Redaction utility behavior

`ledgerlens.observability` exposes four targeted redactors plus a
combined `sanitize_for_log()`:

| Function | What it strips |
|---|---|
| `redact_email(s)` | `[A-Za-z0-9._%+\-]+@[domain].[tld]` |
| `redact_phone(s)` | `(?+ddd) ddd-dddd` US-style + dotted / dashed variants |
| `redact_account_number_like(s)` | any run of 9+ consecutive digits |
| `redact_card_like(s)` | 13–19 digit groups separated by spaces or dashes |
| `sanitize_for_log(value, max_len=80)` | all of the above, plus newline / control-char collapse and truncation |

`sanitize_for_log` is the call site every new logger emission should
use when the value came from outside the trust boundary (bank
descriptions, owner notes, vendor names, file contents).

## 4. What should never be logged

These rules are not enforced by code; they are the call-site
contract:

- Never log a raw CSV row.
- Never log a full bank description.
- Never log an account number, routing number, or card number.
- Never log a raw LLM prompt that includes a transaction
  description unless `sanitize_for_log` has scrubbed it first.
- Never log a customer or owner email or phone in the clear.

When you need to attach a transaction's context to a log line, log
its id (`txn_xxxxx`) — the audit table and database hold the rest.

## 5. Remaining observability gaps

- Logs are not yet JSON-formatted.
- There is no central log aggregator on the demo Railway deploy;
  logs ride on Railway's stdout capture.
- No tracing (OpenTelemetry, etc.).
- No request-level metrics (latency histograms, error rate by
  route).
- Audit retention policy is the database row itself — there is no
  retention cap or per-row TTL.

## 6. Future production logging plan

In rough priority order, once auth/tenant exists:

1. **JSON formatter** (drop-in for the current `Formatter`) so
   stdout is machine-parseable.
2. **Per-tenant log scoping** — every log line gets a `tenant_id`
   field similar to today's `request_id`.
3. **Structured event names** — convert ad-hoc messages to a stable
   `event_name=` enum so dashboards can filter on it.
4. **Log shipping** — Railway → a real log store (Logtail, Datadog,
   or Grafana Loki). At that point the redaction utility moves from
   "best practice" to "enforced by middleware on every log call".
5. **Metrics** — Prometheus middleware on the FastAPI app.
6. **Tracing** — OTLP exporter once we have a backend to send it to.
7. **Audit retention** — explicit TTL on `audit_events` per tenant
   policy.
