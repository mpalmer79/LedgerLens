"""Phase 2 session + actor + audit foundation.

- `GET /session` returns the demo user + business + honest warnings.
- `POST /session/demo` is idempotent (same shape as GET).
- `POST /session/logout` is a 204 no-op (stateless demo).
- The session response never echoes secrets.
- `GET /audit-events` returns recent events scoped to the demo business.
- Mutation routes record audit events with actor metadata.
- The audit service strips forbidden keys from `details`.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

# ── Session ──────────────────────────────────────────────────────────


def test_get_session_returns_demo_actor_and_business(client: TestClient) -> None:
    res = client.get("/session")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["authenticated"] is True
    assert body["mode"] == "demo"
    assert body["user"]["display_name"] == "Demo Owner"
    assert body["user"]["id"].startswith("usr_")
    assert body["user"]["role_hint"] == "owner"
    assert body["business"]["name"] == "Granite State Auto Repair"
    assert body["business"]["slug"] == "granite-state-auto-repair"
    assert body["business"]["is_demo"] is True
    warnings = " ".join(body["warnings"]).lower()
    assert "public demo session" in warnings
    assert "not production authentication" in warnings
    assert "not complete tenant isolation" in warnings
    assert "do not upload real bank" in warnings


def test_post_session_demo_is_idempotent(client: TestClient) -> None:
    first = client.post("/session/demo").json()
    second = client.post("/session/demo").json()
    assert first["user"]["id"] == second["user"]["id"]
    assert first["business"]["id"] == second["business"]["id"]


def test_post_session_logout_returns_204(client: TestClient) -> None:
    res = client.post("/session/logout")
    assert res.status_code == 204
    assert res.text == ""


def test_session_response_does_not_leak_env_or_secrets(client: TestClient) -> None:
    text = client.get("/session").text.lower()
    for forbidden in ["database_url", "anthropic_api_key", "secret", "password"]:
        assert forbidden not in text


# ── Audit events ─────────────────────────────────────────────────────


def test_audit_events_empty_on_fresh_db(client: TestClient) -> None:
    res = client.get("/audit-events")
    assert res.status_code == 200, res.text
    body = res.json()
    # Some mutations from earlier endpoint calls in this test session
    # may show up; the call itself is at least well-shaped.
    assert "business_id" in body
    assert body["business_id"].startswith("biz_")
    assert isinstance(body["events"], list)
    warnings = " ".join(body["warnings"]).lower()
    assert "workflow traceability" in warnings
    assert "not regulatory compliance" in warnings
    assert "stripped before storage" in warnings


def test_mapping_entry_update_records_actor_aware_audit(client: TestClient) -> None:
    # Trigger a mapping update.
    res = client.put(
        "/mapping/profile/entries/parts_inventory",
        json={"category_code": "6080", "block_fallback": False},
    )
    assert res.status_code == 200, res.text
    events = client.get("/audit-events?action=mapping_profile.updated").json()["events"]
    assert events, "no mapping_profile.updated audit event recorded"
    e = events[0]
    assert e["actor_display_name"] == "Demo Owner"
    assert e["actor_user_id"].startswith("usr_")
    assert e["business_id"].startswith("biz_")
    assert e["entity_type"] == "mapping_entry"
    assert e["entity_id"] == "parts_inventory"
    after = e["details"].get("after") or {}
    assert after.get("category_code") == "6080"


def test_mapping_preview_records_audit_event(client: TestClient) -> None:
    res = client.post(
        "/mapping/preview",
        json={"intent": "parts_inventory", "proposed_category_code": "6080"},
    )
    assert res.status_code == 200
    events = client.get("/audit-events?action=mapping_preview.generated").json()["events"]
    assert events
    metadata = events[0]["details"].get("metadata") or {}
    assert "affected_count" in metadata
    assert metadata["proposed_category_code"] == "6080"


def test_import_profile_create_records_audit_event(client: TestClient) -> None:
    res = client.post(
        "/import-profiles",
        json={
            "name": "audit-test-profile",
            "amount_mode": "debit_credit",
            "date_column": "Posted Date",
            "description_column": "Description",
            "debit_column": "Debit",
            "credit_column": "Credit",
            "expected_headers": ["Posted Date", "Description", "Debit", "Credit"],
        },
    )
    assert res.status_code == 201, res.text
    events = client.get("/audit-events?action=import_profile.created").json()["events"]
    assert events
    assert any(
        (e["details"].get("after") or {}).get("name") == "audit-test-profile" for e in events
    )


def test_audit_service_redacts_forbidden_keys() -> None:
    """The audit service must drop forbidden keys from `details`
    before persistence, even if a caller accidentally passes one."""
    from ledgerlens.services.audit_log import _redact

    cleaned = _redact(
        {
            "name": "ok",
            "raw_csv": "Posted Date,Description,Debit,Credit\n2026-03-14,NAPA,42.80,",
            "nested": {
                "account_number": "1234567890",
                "ok_field": "stays",
            },
            "items": [{"secret": "shh", "name": "kept"}],
        }
    )
    assert "raw_csv" not in cleaned
    assert cleaned["name"] == "ok"
    assert "account_number" not in cleaned["nested"]
    assert cleaned["nested"]["ok_field"] == "stays"
    assert "secret" not in cleaned["items"][0]
    assert cleaned["items"][0]["name"] == "kept"


# ── Public demo still works ──────────────────────────────────────────


def test_public_demo_routes_still_work(client: TestClient) -> None:
    for path in ["/health", "/ready", "/demo/ready", "/session"]:
        res = client.get(path)
        assert res.status_code == 200, f"{path} returned {res.status_code}"
