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

By default the app runs in **portfolio demo mode** (`CATEGORIZER_MODE=demo_stub`).
The full workflow — intake, correction memory, rules, review, ledger, audit — is
zero-cost and needs no API keys. Unmatched transactions are routed to human
review by a deterministic stub instead of a paid model.

To use the real Anthropic model fallback for private testing, set both:

```bash
export CATEGORIZER_MODE=anthropic
export ANTHROPIC_API_KEY=sk-ant-...
```

In demo mode an Anthropic key is intentionally ignored.

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

The list shows 12 rows with status `Pending`. Click **Select all (12)** and then **Categorize 12 selected**. Each row passes through the pipeline:

1. Correction memory — empty on first run, so nothing matches yet.
2. Deterministic rule layer (`/rules`) — vendors in the bundled rule set (Adobe, QuickBooks, Zoom, Staples, Uber, Shell, …) categorize **at zero model cost** with provider `rule_categorizer`.
3. Claude Haiku — runs only on the transactions neither layer could classify.

Open the detail page for a few rows to see the "Source" tag on the latest-categorization card: `Rule` (with the rule id), `Memory`, or `Model`. The audit trail records `categorized_from_rules` for rule hits and the matched rule id for traceability.

Likely outcomes:
- Several transactions → `Auto-approved` via the rule layer (zero cost, confidence equal to the rule's confidence)
- A few → `Auto-approved` via the model (≥ 0.90)
- Some → `Needs review` (mid-confidence model results, or rule conflicts)
- 0–1 → `Uncategorizable` if the model refuses

### 4. Visit the review queue

Click **Review queue** in the nav, or visit `/review`.

Each pending item shows the predicted category, confidence, explanation, and a correction dropdown populated from the live `/categories` endpoint. Low-confidence cards (< 0.70) get an amber highlight.

### 5. Correct one transaction (and watch the system learn from it)

Pick the Claude API row (or any other mid-confidence item). In the **Correct to category** dropdown, choose `[6080] Professional Services` (or whatever you think is right). Add a reviewer note. Click **Correct**.

The item drops out of the queue. Visit `/transactions/<the-id>`; the latest categorization now has status `Corrected`, and the audit trail shows the `correct` event with `from` and `to` codes — plus a second event `correction_memory.recorded` showing the merchant key the system extracted.

Click **Learned corrections** in the nav (or visit `/corrections`). The new row is there: merchant key, the category you picked, match count of zero (it hasn't been used yet), source transaction link, and a **Deactivate** button.

Now create a second transaction with the same merchant — for example, on `/transactions/import`, paste:

```csv
date,description,amount
2026-03-30,CLAUDE API USAGE,-22.40
```

Click **Import CSV**, then on `/transactions` select the new row and click **Categorize 1 selected**. The result returns instantly with status `Auto-approved`, model `correction_memory`, confidence `1.000`, cost `$0.00`, and an explanation that begins with *"Matched prior human correction for merchant…"*. The model was not called. On `/corrections`, the row's **Matches** counter is now `1`. The transaction detail page has a **Memory match** panel showing `verdict: apply` and a link back to the source review decision.

This is correction memory. Deterministic exact-key lookup over prior human decisions. It is not model training, it is not fine-tuning — corrections are stored as rules, and the rules are auditable and individually deactivatable.

### 6. Approve one transaction

Back on `/review`, pick the QuickBooks row. Click **Approve prediction**. Confirm it leaves the queue. (Approvals do **not** create memory rows — only explicit corrections do, so the system never claims to have learned something it didn't.)

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

- The categorize button isn't a demo button. It calls Claude Haiku and persists the result — but only when memory and the rule layer can't decide on their own.
- The pipeline is three deterministic layers + a model fallback: memory → rules → model. Each layer is auditable, and each result names which layer produced it. The model is the *last* resort, not the first.
- Confidence routing isn't fake. Mid-confidence predictions go to the review queue. Predictions outside the active chart of accounts are auto-routed to review even at high confidence.
- The ledger reflects review state. A corrected category replaces the model's pick in the export.
- The audit trail is real. Every state change writes a row visible on the transaction detail page.
- Correction memory is real lookup, not fake learning. Step 5 above shows the second transaction categorized at zero model cost from a stored rule, not from the model. Deactivate the rule on `/corrections` and the same transaction would have gone back through the pipeline.
- The rule layer is real lookup, not AI. Step 3 above shows Adobe / Zoom / Staples / Uber categorized from `/rules` at zero model cost. Confidence below the auto-approve threshold routes to review (see the Amazon entry — confidence 0.4, intentionally never auto-applied).
- The eval page isn't oversold. It explicitly names the accuracy gap and connects it to why the workflow exists.

## Known limitations

- Single-tenant. No auth, no per-user accounts of categories. Demo prototype.
- Correction memory is exact-key only — no semantic / fuzzy matching. "Adobe Creative Cloud" and "Adobe CC" are different keys today. Embedding-based retrieval is intentionally deferred until exact matching has proven its hit rate.
- Generic merchants (`ACH`, `POS`, `TRANSFER`, `PAYMENT`, etc.) are deliberately ignored when building memory keys — a correction on an "ACH DEBIT" row will not create a reusable rule, because the key is not specific enough to be safe.
- Conflicting corrections route to review. If two reviewers corrected the same merchant to two different categories, the next matching transaction goes to `/review` instead of auto-applying either rule. This is intentional.
- The bundled rule set is manually curated and tenant-agnostic. It targets the default seed chart of accounts. Per-tenant rules — and rule auto-learning from corrections — are deliberately out of scope for v0.
- Eval-harness metric upgrades (ECE, slice-correct per-category, baselines beyond stub) are partially addressed. A rules-only run is committed under `evals/runs/`; because the bundled rules target the default COA and the synthetic eval businesses use different code mappings, ground-truth accuracy is 0% — that is the *methodology finding*, not a bug.
- No rate limiting on the backend. Demo only.
