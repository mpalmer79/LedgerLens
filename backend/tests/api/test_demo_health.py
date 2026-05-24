"""`/demo/ready` and the structured-503 behavior of `/demo/status`.

The incident: `/health` and `/ready` both passed while `/demo/status`
returned plain "Internal Server Error" because schema drift broke
the queries inside `/demo/status` but not `SELECT 1`.

The hotfix:
- `/demo/status` catches DB exceptions and returns a structured 503.
- New `/demo/ready` probes every demo-critical table independently
  so failures surface in /demo/ready instead of hiding behind /ready.
"""

from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

# ── /demo/ready ──────────────────────────────────────────────────────


def test_demo_ready_returns_ready_true_on_healthy_db(client: TestClient) -> None:
    res = client.get("/demo/ready")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ready"] is True
    # Every demo-critical table is probed and OK.
    for table in [
        "transactions",
        "categorization_results",
        "review_decisions",
        "correction_memory",
        "account_categories",
        "category_mapping_profiles",
        "category_mapping_entries",
    ]:
        assert body["checks"][table]["ok"] is True, f"{table} not ok: {body['checks']}"
    assert body["checks"]["database"]["ok"] is True
    assert body["version"]
    # Public-demo honesty warning is always present.
    warnings = " ".join(body["warnings"]).lower()
    assert "synthetic" in warnings
    assert "do not upload real bank" in warnings


def test_demo_ready_returns_ready_false_when_a_table_fails(
    client: TestClient,
) -> None:
    """If even one table check raises, ready=false and the responsible
    table is marked not ok with the error class — but the response is
    still a clean 200 with structured JSON."""

    real_query = type(client.app).__mro__  # silence unused-import lint
    del real_query

    from sqlalchemy.orm import Query

    original_count = Query.count

    def boom(self):  # type: ignore[no-untyped-def]
        # Make `transactions` count fail only.
        entities = [d["expr"] for d in self.column_descriptions]
        for ent in entities:
            if getattr(ent, "__tablename__", None) == "transactions":
                raise OperationalError("simulated", {}, Exception("drift"))
        return original_count(self)

    with patch.object(Query, "count", boom):
        res = client.get("/demo/ready")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ready"] is False
    assert body["checks"]["transactions"]["ok"] is False
    assert body["checks"]["transactions"]["error"] == "OperationalError"
    # Other tables continue to be probed.
    assert body["checks"]["account_categories"]["ok"] is True


def test_demo_ready_never_echoes_database_url_or_secrets(client: TestClient) -> None:
    body_lower = client.get("/demo/ready").text.lower()
    for forbidden in [
        "database_url",
        "postgresql://",
        "postgres://",
        "anthropic_api_key",
        "secret",
        "password",
    ]:
        assert forbidden not in body_lower, f"/demo/ready leaked {forbidden!r}"


def test_demo_ready_returns_request_id_header(client: TestClient) -> None:
    res = client.get("/demo/ready")
    assert res.headers.get("X-Request-ID")


# ── /demo/status structured-503 fallback ─────────────────────────────


def test_demo_status_returns_structured_503_on_db_failure(client: TestClient) -> None:
    """A schema-drift exception inside /demo/status must NOT escape as
    plain Internal Server Error."""
    from sqlalchemy.orm import Query

    original_count = Query.count

    def boom(self):  # type: ignore[no-untyped-def]
        entities = [d["expr"] for d in self.column_descriptions]
        for ent in entities:
            if getattr(ent, "__tablename__", None) == "transactions":
                raise OperationalError("simulated", {}, Exception("drift"))
        return original_count(self)

    with patch.object(Query, "count", boom):
        res = client.get("/demo/status")
    assert res.status_code == 503, res.text
    body = res.json()
    assert body["error"] == "demo_status_unavailable"
    assert body["message"] == "Demo status is temporarily unavailable."
    assert body["hint"].startswith("Check /demo/ready")
    # The request id is echoed for log correlation.
    assert body["request_id"]
    # No raw stack trace or class name leaks into the public body.
    public = res.text.lower()
    assert "traceback" not in public
    assert "operationalerror" not in public
