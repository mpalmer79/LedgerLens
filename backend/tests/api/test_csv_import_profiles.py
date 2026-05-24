"""Saved CSV import profiles — CRUD + header validation + privacy guards."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _new_profile_payload(**overrides):  # type: ignore[no-untyped-def]
    base = {
        "name": "My TD checking",
        "amount_mode": "debit_credit",
        "date_column": "Posted Date",
        "description_column": "Description",
        "debit_column": "Debit",
        "credit_column": "Credit",
        "account_column": "Account",
        "reference_column": "Reference",
        "expected_headers": [
            "Posted Date",
            "Description",
            "Debit",
            "Credit",
            "Account",
            "Reference",
        ],
    }
    base.update(overrides)
    return base


# ── List + seeded sample ─────────────────────────────────────────────


def test_list_seeds_sample_profile_on_first_read(client: TestClient) -> None:
    res = client.get("/import-profiles")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["business_id"] == "granite_state_auto_repair"
    assert body["business_name"] == "Granite State Auto Repair"
    names = [p["name"] for p in body["profiles"]]
    assert "Granite State sample bank CSV" in names
    seed = next(p for p in body["profiles"] if p["source"] == "seed")
    assert seed["amount_mode"] == "debit_credit"
    assert seed["date_column"] == "Posted Date"
    assert seed["description_column"] == "Description"
    assert seed["debit_column"] == "Debit"
    assert seed["credit_column"] == "Credit"
    assert seed["expected_headers"] == [
        "Posted Date",
        "Description",
        "Debit",
        "Credit",
        "Account",
        "Reference",
    ]
    warnings = " ".join(body["warnings"]).lower()
    assert "public demo" in warnings
    assert "metadata" not in warnings  # we use plainer copy
    assert "column names and mapping choices only" in warnings
    assert "do not upload real bank" in warnings


def test_list_is_idempotent(client: TestClient) -> None:
    first = client.get("/import-profiles").json()
    second = client.get("/import-profiles").json()
    first_ids = sorted(p["id"] for p in first["profiles"])
    second_ids = sorted(p["id"] for p in second["profiles"])
    assert first_ids == second_ids


# ── Create / validate ────────────────────────────────────────────────


def test_create_debit_credit_profile(client: TestClient) -> None:
    res = client.post("/import-profiles", json=_new_profile_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["source"] == "user"
    assert body["name"] == "My TD checking"
    assert body["amount_mode"] == "debit_credit"


def test_create_signed_profile(client: TestClient) -> None:
    res = client.post(
        "/import-profiles",
        json=_new_profile_payload(
            name="Chase signed export",
            amount_mode="signed",
            amount_column="Amount",
            debit_column=None,
            credit_column=None,
            expected_headers=["Date", "Description", "Amount"],
            date_column="Date",
            description_column="Description",
        ),
    )
    assert res.status_code == 201, res.text


def test_create_rejects_blank_name(client: TestClient) -> None:
    res = client.post("/import-profiles", json=_new_profile_payload(name="   "))
    assert res.status_code == 422
    assert "blank" in res.json()["detail"]["message"].lower() or "name" in res.text.lower()


def test_create_rejects_signed_mode_without_amount_column(client: TestClient) -> None:
    res = client.post(
        "/import-profiles",
        json=_new_profile_payload(
            amount_mode="signed",
            amount_column=None,
            debit_column=None,
            credit_column=None,
        ),
    )
    assert res.status_code == 422
    assert "amount_column" in res.json()["detail"]["message"]


def test_create_rejects_debit_credit_without_both_columns(client: TestClient) -> None:
    res = client.post(
        "/import-profiles",
        json=_new_profile_payload(debit_column="Debit", credit_column=None),
    )
    assert res.status_code == 422
    res2 = client.post(
        "/import-profiles",
        json=_new_profile_payload(debit_column=None, credit_column="Credit"),
    )
    assert res2.status_code == 422


def test_create_rejects_invalid_amount_mode(client: TestClient) -> None:
    res = client.post("/import-profiles", json=_new_profile_payload(amount_mode="nonsense"))
    assert res.status_code == 422
    assert "amount_mode" in res.json()["detail"]["message"]


def test_create_rejects_duplicate_name_within_business(client: TestClient) -> None:
    client.post("/import-profiles", json=_new_profile_payload(name="duplicate-test"))
    # Second create with same name → DB unique constraint surfaces.
    res = client.post("/import-profiles", json=_new_profile_payload(name="duplicate-test"))
    assert res.status_code >= 400


# ── Update + delete ──────────────────────────────────────────────────


def test_update_profile(client: TestClient) -> None:
    created = client.post("/import-profiles", json=_new_profile_payload(name="updateable")).json()
    res = client.put(
        f"/import-profiles/{created['id']}",
        json=_new_profile_payload(name="updateable", description_column="Memo"),
    )
    assert res.status_code == 200, res.text
    assert res.json()["description_column"] == "Memo"


def test_delete_user_profile(client: TestClient) -> None:
    created = client.post("/import-profiles", json=_new_profile_payload(name="deletable")).json()
    res = client.delete(f"/import-profiles/{created['id']}")
    assert res.status_code == 200
    # Subsequent list does not include it.
    names = [p["name"] for p in client.get("/import-profiles").json()["profiles"]]
    assert "deletable" not in names


def test_delete_refuses_to_remove_seed_profile(client: TestClient) -> None:
    seed = next(
        p for p in client.get("/import-profiles").json()["profiles"] if p["source"] == "seed"
    )
    res = client.delete(f"/import-profiles/{seed['id']}")
    assert res.status_code == 422
    assert "Seeded profiles cannot be deleted" in res.json()["detail"]["message"]


def test_reset_restores_seed_profile(client: TestClient) -> None:
    # Replace the seed's row directly by deleting + recreating via reset.
    seed_before = next(
        p for p in client.get("/import-profiles").json()["profiles"] if p["source"] == "seed"
    )
    res = client.post("/import-profiles/reset")
    assert res.status_code == 200
    seed_after = res.json()
    assert seed_after["name"] == seed_before["name"]
    assert seed_after["source"] == "seed"


# ── Validate headers ─────────────────────────────────────────────────


def _seed_id(client: TestClient) -> str:
    return next(
        p["id"] for p in client.get("/import-profiles").json()["profiles"] if p["source"] == "seed"
    )


def test_validate_all_headers_present(client: TestClient) -> None:
    pid = _seed_id(client)
    res = client.post(
        f"/import-profiles/{pid}/validate",
        json={
            "headers": [
                "Posted Date",
                "Description",
                "Debit",
                "Credit",
                "Account",
                "Reference",
            ]
        },
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["profile_applicable"] is True
    assert body["missing_headers"] == []
    assert "Posted Date" in body["matched_headers"]


def test_validate_detects_missing_required_header(client: TestClient) -> None:
    pid = _seed_id(client)
    res = client.post(
        f"/import-profiles/{pid}/validate",
        json={"headers": ["Posted Date", "Description", "Credit", "Account"]},
    )
    body = res.json()
    assert body["profile_applicable"] is False
    assert "Debit" in body["missing_headers"]
    warnings = " ".join(body["warnings"]).lower()
    assert "may have changed the export format" in warnings


def test_validate_allows_extra_headers(client: TestClient) -> None:
    pid = _seed_id(client)
    res = client.post(
        f"/import-profiles/{pid}/validate",
        json={
            "headers": [
                "Posted Date",
                "Description",
                "Debit",
                "Credit",
                "Account",
                "Reference",
                "Some New Bank Column",
            ]
        },
    )
    body = res.json()
    assert body["profile_applicable"] is True
    assert "Some New Bank Column" in body["extra_headers"]


def test_validate_unknown_profile_returns_404(client: TestClient) -> None:
    res = client.post("/import-profiles/nope/validate", json={"headers": []})
    assert res.status_code == 404


# ── Privacy guardrails ──────────────────────────────────────────────


def test_profile_response_never_includes_row_or_pii_fields(client: TestClient) -> None:
    """The shape returned by the API should be purely metadata. Quick
    paranoia check that no obviously-sensitive field name slips in."""
    body = client.get("/import-profiles").json()
    text = res_text = repr(body).lower()
    for forbidden in [
        "raw_csv",
        "raw_row",
        "raw_rows",
        "row_data",
        "transaction_description",
        "account_number",
        "credentials",
        "password",
        "secret",
        "api_key",
    ]:
        assert forbidden not in text, f"profile response leaked {forbidden!r}"
    del res_text


def test_validate_endpoint_accepts_headers_only(client: TestClient) -> None:
    """Sanity check: the validate route does not require row data."""
    pid = _seed_id(client)
    # Empty header list is acceptable input (returns profile_applicable=False).
    res = client.post(f"/import-profiles/{pid}/validate", json={"headers": []})
    assert res.status_code == 200
    assert res.json()["profile_applicable"] is False


def test_routes_carry_x_request_id(client: TestClient) -> None:
    for url, method in [
        ("/import-profiles", "GET"),
        ("/import-profiles", "POST"),
        ("/import-profiles/reset", "POST"),
    ]:
        if method == "GET":
            r = client.get(url)
        elif method == "POST":
            if url.endswith("/reset"):
                r = client.post(url)
            else:
                r = client.post(url, json=_new_profile_payload(name="rid-check"))
        assert r.headers.get("X-Request-ID")
