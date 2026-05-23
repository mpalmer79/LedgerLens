# Portfolio deployment — Railway

LedgerLens is a portfolio demo. The deployed version should be safe to leave
running indefinitely with zero paid-API spend. This doc captures the exact
Railway configuration that achieves that.

## Recommended Railway configuration

### Backend service

| Variable | Value | Required | Notes |
|---|---|---|---|
| `CATEGORIZER_MODE` | `demo_stub` | yes | Forces the portfolio-safe fallback. The app **never** imports or calls Anthropic in this mode, even if a key is set. |
| `DATABASE_URL` | Railway-injected Postgres URL, or `sqlite:///./ledgerlens.db` | yes | The default in-memory SQLite resets on every deploy. Use a persistent URL. |
| `LEDGERLENS_AUTO_QUEUE_THRESHOLD` | `0.90` | no | Defaults to 0.90; leave alone for the demo. |
| `LEDGERLENS_REVIEW_QUEUE_THRESHOLD` | `0.60` | no | Defaults to 0.60; leave alone for the demo. |
| `LOG_LEVEL` | `INFO` | no | |
| `CORS_ORIGINS` | `https://ledgerlens.up.railway.app` (or whatever the frontend URL is) | yes | Comma-separated allow-list. The frontend's exact origin must be in here or `/ledger`-style data calls will fail preflight while `/health` still works. |
| `ANTHROPIC_API_KEY` | **unset** | **no — do NOT set** | Setting this does nothing in demo mode (the stub never reads it), but leaving it unset removes the accidental-bill risk entirely. |

### Frontend service

| Variable | Value | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<backend-service>.up.railway.app` | yes | Injected at build time via `Dockerfile` ARG. Must match the backend's CORS allow-list. |

## How the portfolio deployment stays at $0

The categorize pipeline runs three deterministic layers before reaching any
paid model:

1. **Correction memory** — exact-key lookup over rules built from prior human
   corrections. Zero cost. Implemented in `services/correction_memory.py`.
2. **Deterministic rule layer** — ~25 curated merchant/keyword rules in
   `backend/src/ledgerlens/data/category_rules.json`. Zero cost. Implemented in
   `services/rule_categorizer.py`.
3. **Demo stub categorizer** — implemented in
   `backend/src/ledgerlens/categorizers/demo_stub.py`. Returns
   `UNCATEGORIZABLE` with provider `demo_stub`, model name
   `portfolio_stub_v1`, and an explanation reading *"Portfolio demo stub: no
   correction memory or deterministic rule matched, so this transaction is
   routed to human review instead of calling a paid model provider."* Cost is
   exactly `$0.00`.

Result statuses are then assigned by the existing confidence-routing logic;
demo-stub predictions become `uncategorizable` and land in `/review` so a
human can finish them.

**Nothing in the demo-mode code path imports the `anthropic` SDK.** A
regression test (`tests/api/test_demo_stub_mode.py::test_factory_does_not_import_anthropic_in_demo_mode`)
fails if that ever stops being true.

## Verifying no Anthropic calls are made

Three ways to confirm, in order of strength:

1. **The unit test.** Run `pytest tests/api/test_demo_stub_mode.py -q` — eleven
   tests, including one that asserts `"anthropic" not in sys.modules` after a
   demo-mode categorize call.
2. **Readiness endpoint.** `GET /ready` in demo mode returns
   `checks.categorizer.demo_mode: true` and
   `checks.anthropic.required_for_current_mode: false`. The deploy is ready
   even with `ANTHROPIC_API_KEY` unset.
3. **Anthropic console.** Watch the Anthropic dashboard for traffic from the
   Railway egress IP. With `CATEGORIZER_MODE=demo_stub` you'll see zero
   requests no matter how many times the app is exercised.

## Enabling Anthropic for private testing

For a private branch or local development where you want the real model
fallback behaviour, set both:

```
CATEGORIZER_MODE=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

If `CATEGORIZER_MODE=anthropic` but the key is missing, the app starts
cleanly but `/ready` reports `ready: false` and the categorize endpoint
returns a structured 503 (`missing_provider_config`) so failures are
obvious rather than silent.

## Cost-control summary

- The default mode is `demo_stub`. The default *deployed* behaviour is
  zero-cost.
- Anthropic is opt-in via an explicit environment variable change. There is
  no silent fallback.
- The `Categorizer` protocol guarantees the demo stub is API-compatible
  with the real model categorizer, so the rest of the system — correction
  memory, rule layer, audit trail, review queue, ledger export — works
  identically in both modes.
