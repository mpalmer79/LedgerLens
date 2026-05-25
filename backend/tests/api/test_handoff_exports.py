"""Tests for handoff export endpoints (owner questions, splits, package)."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_owner_questions_csv_returns_200(client: TestClient) -> None:
    res = client.get("/handoff/export.owner-questions.csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "charset=utf-8" in res.headers.get("content-type", "")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert "ledgerlens-owner-questions.csv" in res.headers.get("content-disposition", "")
    lines = res.text.strip().split("\n")
    assert len(lines) >= 1
    header = lines[0]
    assert "transaction_id" in header
    assert "owner_question_label" in header


def test_splits_csv_returns_200(client: TestClient) -> None:
    res = client.get("/handoff/export.splits.csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "charset=utf-8" in res.headers.get("content-type", "")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert "ledgerlens-splits.csv" in res.headers.get("content-disposition", "")
    lines = res.text.strip().split("\n")
    assert len(lines) >= 1
    header = lines[0]
    assert "transaction_id" in header
    assert "split_line_id" in header
    assert "split_amount" in header


def test_package_json_returns_200(client: TestClient) -> None:
    res = client.get("/handoff/export.package.json")
    assert res.status_code == 200
    assert "application/json" in res.headers.get("content-type", "")
    assert res.headers.get("x-content-type-options") == "nosniff"
    body = res.json()
    assert body["synthetic_demo_data"] is True
    assert "generated_at" in body
    assert "exports" in body
    assert len(body["exports"]) == 7
    paths = {e["path"] for e in body["exports"]}
    assert "/ledger/export.csv" in paths
    assert "/handoff/export.reviewed.csv" in paths
    assert "/handoff/export.owner-questions.csv" in paths
    assert "/handoff/export.splits.csv" in paths
    assert "/handoff/export.md" in paths
    assert "/handoff/export.package.json" in paths


def test_reviewed_csv_has_hardened_headers(client: TestClient) -> None:
    res = client.get("/handoff/export.reviewed.csv")
    assert res.status_code == 200
    assert "charset=utf-8" in res.headers.get("content-type", "")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert "ledgerlens-reviewed.csv" in res.headers.get("content-disposition", "")


def test_followup_csv_has_hardened_headers(client: TestClient) -> None:
    res = client.get("/handoff/export.followup.csv")
    assert res.status_code == 200
    assert "charset=utf-8" in res.headers.get("content-type", "")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert "ledgerlens-followup.csv" in res.headers.get("content-disposition", "")
