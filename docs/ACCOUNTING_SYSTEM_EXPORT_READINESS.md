# Accounting-system export readiness (QuickBooks Online & Xero)

This is a research + planning doc for the integrations the handoff
flow will eventually need. **Nothing here is implemented.** LedgerLens
does not push to QuickBooks Online or Xero today; it produces a
handoff package (markdown + reviewed CSV + follow-up CSV) that a human
hands to the accountant.

Putting the research down in writing accomplishes two things:

1. The product positioning is honest — the README/landing copy can
   reference this doc when stating "we do not replace QuickBooks/Xero,
   we hand off to them."
2. When integration work does start, the team has a written analysis
   to ground the build against, instead of a clean-slate "spike."

## 1. What "export" needs to look like for the small-business case

The handoff today produces three artifacts:

- `handoff.md` — human-readable cleanup summary the owner forwards.
- `reviewed_categorization.csv` — only finalized + verified rows.
- `followup_required.csv` — owner-flagged + pending rows.

A real integration replaces (or supplements) those with a structured
push:

| Target | Object type | Maps from |
|---|---|---|
| QuickBooks Online | `Purchase`, `Bill`, `Deposit`, `JournalEntry` | LedgerLens `Transaction` + final `CategorizationResult` + `ReviewDecision` |
| Xero | `BankTransaction`, `Invoice`, `ManualJournal` | same |

Both systems require an account/category code that exists in the
operator's COA. The mapping wizard (`/mapping`) is what bridges
LedgerLens intents → operator COA codes, so the integration is a thin
push layer over data we already track honestly.

## 2. QuickBooks Online — what we'd need

- **Auth.** OAuth2 against `intuit.com`. The token lives at the tenant
  (or business) scope; refresh handled server-side.
- **Realm / company id.** The QBO company id needs to be stored on the
  `Business` row (new column).
- **COA mapping.** We need to either (a) pull the operator's QBO COA
  and replace our seeded COA, or (b) maintain a per-business
  `qbo_account_id ↔ ledgerlens_category_code` map. Option (b) is
  simpler and matches the existing mapping wizard.
- **Push surface.**
  - `Purchase` for outflows where there is no Bill.
  - `Bill` + `BillPayment` when the row is a paid-bill transaction.
  - `Deposit` for inflows.
  - `JournalEntry` for the rare corrections that don't fit the above.
- **Rate limits.** QBO is 500 req/min/realm; the handoff push must
  batch and respect 429 backoff.
- **Idempotency.** Every pushed object needs a deterministic
  `external_id` keyed off `Transaction.id` so re-runs don't double-post.
- **Reconciliation.** A pushed object's QBO id must round-trip back
  into a new LedgerLens table (`accounting_system_links` or similar)
  so the UI can show "synced ✓" and so re-pushes are no-ops.

The Intuit SDK + sandbox is workable; the production-app review
(security questionnaire + SOC2 attestation) is the long-pole
non-engineering step. None of that work is justified before LedgerLens
has a paying-operator commitment, which is why this is research, not
implementation.

## 3. Xero — what we'd need

- **Auth.** OAuth2 against `xero.com`; uses an
  `Authorization Code with PKCE` flow. Tenant connection model is
  different from QBO — one user can connect to many "organisations,"
  and each call carries the `xero-tenant-id` header.
- **COA mapping.** Same shape as QBO: per-business map between
  LedgerLens intents and Xero `Account.Code`.
- **Push surface.**
  - `BankTransaction` for cash-in/cash-out from bank-feed rows.
  - `Invoice` / `Bill` for AR/AP.
  - `ManualJournal` for adjustments.
- **Rate limits.** Xero is 60 req/min/tenant + 5,000/day. Lower than
  QBO; the batch logic must be careful.
- **Idempotency.** Pass a unique `Reference` field per row keyed off
  `Transaction.id`.

## 4. What stays the same regardless of target

- The "category code" the integration pushes must be the **post-review
  final code** — not the model's raw prediction. The handoff already
  computes this via `services/handoff.py::build_handoff` and the
  `_is_verified` rule in `api/ledger.py`. Integration code MUST consume
  that view, not the raw `CategorizationResult`.
- The accountant-follow-up bucket must NEVER auto-push. Those are
  rows the owner explicitly flagged; they belong in the followup CSV
  and in a future "accountant inbox" UI, not in the books.
- Every push event must add an `AuditEvent` (`entity_type="quickbooks"`
  / `"xero"`, `action="pushed"`, with the external id in `details`).

## 5. Reverse direction (pull)

Not in scope for v1. The honest framing is "LedgerLens cleans up your
bookkeeping data so you can hand it to QuickBooks/Xero." Pull
(consuming the operator's existing QBO/Xero ledger as the input set)
is a different product shape and not on the roadmap.

## 6. Why this matters for positioning

The market wedge (see `docs/MARKET_POSITIONING_AND_COMPETITIVE_WEDGE.md`)
depends on us being honest that QuickBooks/Xero is the destination,
not the competition. This research doc is the source the landing
copy + sales conversations should pull from when prospects ask "do
you replace QuickBooks?" — the answer is no, here is exactly how the
handoff lands.
