from fastapi.testclient import TestClient

SAMPLE = {
    "transaction_date": "2026-03-14",
    "description": "  TST* Sweetgreen 4471  ",
    "amount_cents": -1599,
    "currency": "usd",
}


def test_create_transaction(client: TestClient) -> None:
    res = client.post("/transactions", json=SAMPLE)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["id"].startswith("tx_")
    assert body["raw_description"] == SAMPLE["description"]
    # TST* prefix stripped; uppercase; trimmed.
    assert body["normalized_description"].startswith("SWEETGREEN")
    assert "TST*" not in body["normalized_description"]
    assert body["currency"] == "USD"
    assert body["merchant"] is not None


def test_get_transaction_404(client: TestClient) -> None:
    res = client.get("/transactions/tx_does_not_exist")
    assert res.status_code == 404
    assert res.json()["detail"]["error"] == "not_found"


def test_list_transactions_pagination(client: TestClient) -> None:
    for i in range(3):
        client.post("/transactions", json={**SAMPLE, "amount_cents": -100 * (i + 1)})
    res = client.get("/transactions?limit=2")
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 3
    assert len(body["items"]) == 2


def test_batch_create(client: TestClient) -> None:
    payload = {"transactions": [SAMPLE, {**SAMPLE, "amount_cents": -2500}]}
    res = client.post("/transactions/batch", json=payload)
    assert res.status_code == 201
    body = res.json()
    assert len(body["created"]) == 2
    assert body["errors"] == []


def test_batch_create_rejects_empty(client: TestClient) -> None:
    res = client.post("/transactions/batch", json={"transactions": []})
    assert res.status_code == 422


def test_csv_import(client: TestClient) -> None:
    csv_bytes = (
        b"date,description,amount\n"
        b"2026-03-14,Sweetgreen NYC,-15.99\n"
        b"2026-03-15,Adobe Creative Cloud,-28.80\n"
        b"2026-03-16,Stripe payout,3420.00\n"
    )
    res = client.post(
        "/transactions/import",
        files={"file": ("test.csv", csv_bytes, "text/csv")},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["received_rows"] == 3
    assert body["created"] == 3
    assert body["errors"] == []
    assert len(body["transactions"]) == 3
    # Amounts converted to cents correctly.
    amounts = sorted(t["amount_cents"] for t in body["transactions"])
    assert amounts == [-2880, -1599, 342000]


def test_csv_import_bad_row(client: TestClient) -> None:
    csv_bytes = b"date,description,amount\n2026-03-14,OK row,-15.99\nnot-a-date,Bad row,-20.00\n"
    res = client.post(
        "/transactions/import",
        files={"file": ("test.csv", csv_bytes, "text/csv")},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["created"] == 1
    assert len(body["errors"]) == 1


def test_csv_import_size_limit(client: TestClient) -> None:
    # Build a CSV that exceeds the 5 MB limit.
    header = b"date,description,amount\n"
    row = b"2026-03-14,Some long-ish description for filling bytes,-12.34\n"
    body_bytes = header + row * (6 * 1024 * 1024 // len(row) + 1)
    res = client.post(
        "/transactions/import",
        files={"file": ("big.csv", body_bytes, "text/csv")},
    )
    assert res.status_code == 422
    assert res.json()["detail"]["error"] == "validation_failed"
