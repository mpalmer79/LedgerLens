"""Health/ready tests — these must work without any provider credentials."""

from fastapi.testclient import TestClient


def test_health_returns_ok(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "ledgerlens-api"}


def test_ready_reports_database_ok(client: TestClient) -> None:
    res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is True
    assert body["checks"]["database"]["ok"] is True


def test_ready_reports_anthropic_config_separately(client: TestClient) -> None:
    res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    # Test env intentionally has no key set — readiness should still be True
    # because the database is fine.
    assert "configured" in body["checks"]["anthropic"]


def test_app_imports_without_provider_packages() -> None:
    """The app and routers should import cleanly without anthropic installed.

    Soft check: just confirms the routers import here without raising.
    """
    from ledgerlens.api import audit, categories, categorize, health, ledger, review, transactions

    assert all(
        getattr(m, "router", None) is not None
        for m in (audit, categories, categorize, health, ledger, review, transactions)
    )
