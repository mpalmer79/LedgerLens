# LedgerLens demo walkthrough

A reviewer-facing path through the working app. Five minutes start to finish.

## Prerequisites

```bash
# 1. Backend, in one terminal
cd backend
pip install -e .
uvicorn ledgerlens.main:app --reload
# → http://localhost:8000

# 2. Frontend, in another terminal
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

The categorize endpoint needs `ANTHROPIC_API_KEY`. The rest of the workflow works without it.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## The path

### 1. Open the app

Visit `http://localhost:3000`. The landing page shows the project pitch. Click **Open the app →** in the top nav, or go to `http://localhost:3000/app`.

The dashboard shows tiles for total / auto-approved / corrected / needs-review / pending / uncategorizable. All zero on first run. Backend connection status is the green dot in the top nav.

### 2. Import sample CSV

Click **Import** in the nav, or **Import transactions** on the dashboard.

On `/transactions/import`, click **Download sample CSV** to grab a 12-row file covering software, utilities, COGS, fuel, payroll, insurance, an ambiguous Claude API charge, and an unknown ACH transfer.

Either upload the file or switch to "Paste CSV" and click **Load sample into paste box**. Click **Import CSV**.

The summary shows `Received rows: 12`, `Created: 12`, `Errors: 0`, and lists every imported row.

### 3. Run categorization

Click **View imported transactions →**, or visit `/transactions`.

The list shows 12 rows with status `Pending`. Click **Select all (12)** and then **Categorize 12 selected**. Each row gets a real Claude Haiku prediction, a confidence number, and a status badge.

Likely outcomes:
- 6–9 transactions → `Auto-approved` (confidence ≥ 0.90)
- 3–6 → `Needs review` (mid confidence)
- 0–1 → `Uncategorizable` if the model refuses

### 4. Visit the review queue

Click **Review queue** in the nav, or visit `/review`.

Each pending item shows the predicted category, confidence, explanation, and a correction dropdown populated from the live `/categories` endpoint. Low-confidence cards (< 0.70) get an amber highlight.

### 5. Correct one transaction

Pick the Claude API row (or any other mid-confidence item). In the **Correct to category** dropdown, choose `[6080] Professional Services` (or whatever you think is right). Add a reviewer note. Click **Correct**.

The item drops out of the queue. Visit `/transactions/<the-id>`; the latest categorization now has status `Corrected`, and the audit trail shows the `correct` event with `from` and `to` codes.

### 6. Approve one transaction

Back on `/review`, pick the QuickBooks row. Click **Approve prediction**. Confirm it leaves the queue.

### 7. Export the ledger

Click **Ledger** in the nav, or visit `/ledger`.

You'll see three sections:
- **Finalized** — auto-approved + corrected transactions
- **Unresolved** — anything still pending or in review; flagged amber and explicitly not included in finalized
- **Uncategorizable** — items marked uncategorizable

Click **Export CSV ↓** to download `ledger.csv`. Open it; the corrected rows show the corrected category, not the original prediction. The reviewer note is in the last column.

### 8. Inspect audit events

Click any transaction in the list. The detail page shows:
- Raw + normalized descriptions
- The latest categorization (model, latency, cost)
- Every categorization attempt with timestamps
- The full audit trail for this transaction (every action with its JSON details)

### 9. Visit the eval evidence page

Click **Eval evidence** in the nav, or visit `/evals`.

The dashboard shows real eval metrics from the committed JSON artifact: overall accuracy, non-adversarial, adversarial, cost per 100. The amber callout at the top explains the limitations (adversarial accuracy is low; calibration needs work) and ties them to why the product is designed around human review.

## What the reviewer should notice

- The categorize button isn't a demo button. It calls Claude Haiku and persists the result.
- Confidence routing isn't fake. Mid-confidence predictions go to the review queue. Predictions outside the active chart of accounts are auto-routed to review even at high confidence.
- The ledger reflects review state. A corrected category replaces the model's pick in the export.
- The audit trail is real. Every state change writes a row visible on the transaction detail page.
- The eval page isn't oversold. It explicitly names the accuracy gap and connects it to why the workflow exists.

## Known limitations

- Single-tenant. No auth, no per-user accounts of categories. Demo prototype.
- The correction memory loop isn't built yet — the next session will use prior corrections to bias new predictions. Currently every transaction is categorized from scratch.
- Eval-harness metric upgrades (ECE, slice-correct per-category, baselines beyond stub) are deferred. See `docs/IMPLEMENTATION_GAP_ANALYSIS.md`.
- No rate limiting on the backend. Demo only.
