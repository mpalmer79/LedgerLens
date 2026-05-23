"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import {
  ApiError,
  getLedger,
  getReady,
  getReviewQueue,
  listAuditEvents,
  listCorrections,
  listTransactions,
} from "@/lib/api/client";
import type {
  AuditEvent,
  CorrectionMemoryList,
  Ledger,
  ReadyResponse,
  ReviewQueue,
  TransactionList,
} from "@/lib/api/types";
import { formatAmount, formatDate, formatTimestamp } from "@/lib/format";

type State = {
  transactions: TransactionList | null;
  queue: ReviewQueue | null;
  ledger: Ledger | null;
  events: AuditEvent[] | null;
  corrections: CorrectionMemoryList | null;
  ready: ReadyResponse | null;
  error: string | null;
  loading: boolean;
};

const INITIAL: State = {
  transactions: null,
  queue: null,
  ledger: null,
  events: null,
  corrections: null,
  ready: null,
  error: null,
  loading: true,
};

export default function DashboardPage() {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [transactions, queue, ledger, events, corrections, ready] = await Promise.all([
          listTransactions({ limit: 5 }),
          getReviewQueue({ limit: 5 }),
          getLedger(),
          listAuditEvents({ limit: 8 }),
          listCorrections({ active: true, limit: 1 }),
          getReady().catch(() => null as ReadyResponse | null),
        ]);
        if (!cancelled)
          setState({
            ready,
            transactions,
            queue,
            ledger,
            events,
            corrections,
            error: null,
            loading: false,
          });
      } catch (err) {
        if (!cancelled) {
          setState({
            ...INITIAL,
            loading: false,
            error:
              err instanceof ApiError
                ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
                : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = state.transactions?.total ?? 0;
  const reviewing = state.queue?.total ?? 0;
  const ledgerRows = state.ledger?.rows ?? [];

  const counts = {
    auto_approved: ledgerRows.filter((r) => r.categorization_status === "auto_approved").length,
    corrected: ledgerRows.filter((r) => r.categorization_status === "corrected").length,
    uncategorizable: ledgerRows.filter((r) => r.categorization_status === "uncategorizable").length,
    pending: ledgerRows.filter((r) =>
      ["pending", "needs_review", "failed"].includes(r.categorization_status),
    ).length,
  };

  return (
    <AppShell>
      <header>
        <h1 className="font-display text-[28px] font-medium text-text-primary">
          Small-business bookkeeping cleanup, with human oversight.
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-text-secondary">
          Import messy bank activity, classify obvious vendors automatically, review uncertain
          items, remember corrections, and export a categorized ledger. AI is one layer in the
          pipeline — not the whole answer.
        </p>
      </header>

      {state.ready?.checks.categorizer?.demo_mode && (
        <div className="mt-4 rounded-md border border-brand-200 bg-brand-100 px-4 py-2 text-[12px] text-brand-800">
          <span className="font-medium">Portfolio demo mode.</span> Correction memory and
          deterministic rules run normally; unmatched transactions are routed to review by a
          zero-cost stub instead of a paid model provider.{" "}
          <Link href="/demo" className="underline">
            Walk the 3-minute guided demo →
          </Link>
        </div>
      )}

      {/* Empty state — first-time visitor needs direction, not a status dump */}
      {total === 0 && !state.error && (
        <section className="mt-6 rounded-lg border-2 border-brand-600 bg-brand-100 p-5">
          <h2 className="font-display text-[18px] font-medium text-text-primary">
            Start with a guided bookkeeping cleanup demo.
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] text-text-secondary">
            LedgerLens needs transactions to show the workflow. Load the guided demo to see
            rules, correction memory, review routing, and verified ledger export in action.
            Real backend calls, no mocked state.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/demo"
              className="rounded border-2 border-brand-600 bg-surface-panel p-3 text-[13px] font-medium text-brand-700 hover:bg-brand-50"
            >
              Start guided demo →
              <p className="mt-1 text-[12px] font-normal text-text-secondary">
                Three minutes. Ends at a verified ledger export.
              </p>
            </Link>
            <Link
              href="/transactions/import"
              className="rounded border border-surface-border bg-surface-panel p-3 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
            >
              Import transactions →
              <p className="mt-1 text-[12px] font-normal text-text-secondary">
                Bring a real bank export. Sample CSV is on the import page.
              </p>
            </Link>
            <Link
              href="/technical-story"
              className="rounded border border-surface-border bg-surface-panel p-3 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
            >
              View technical story →
              <p className="mt-1 text-[12px] font-normal text-text-secondary">
                Architecture, trust model, and what this project demonstrates.
              </p>
            </Link>
          </div>
        </section>
      )}

      {/* Why this matters — explain the product, not just the tabs */}
      <section className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-4">
        <p className="text-[13px] font-medium text-text-primary">Why this matters</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-text-secondary">
          <li>Bookkeeping cleanup is repetitive but risky — a wrong category propagates to financial statements and tax filings.</li>
          <li>AI guesses alone are not enough. A model that hallucinates an account number can quietly contaminate the books.</li>
          <li>LedgerLens combines rules, correction memory, review routing, and audit trails so the system stays explainable.</li>
        </ul>
      </section>

      {state.error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          <p className="font-medium">Backend unreachable</p>
          <p className="mt-1">{state.error}</p>
          <p className="mt-2 text-[12px] text-red-600">
            Start the backend with{" "}
            <code className="mono">uvicorn ledgerlens.main:app --reload</code> from{" "}
            <code className="mono">backend/</code>, then refresh.
          </p>
        </div>
      )}

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Total" value={total} loading={state.loading} />
        <Tile label="Auto-approved" value={counts.auto_approved} loading={state.loading} />
        <Tile label="Corrected" value={counts.corrected} loading={state.loading} />
        <Tile label="Needs review" value={reviewing} loading={state.loading} tone="amber" />
        <Tile label="Pending" value={counts.pending} loading={state.loading} />
        <Tile
          label="Learned corrections"
          value={state.corrections?.total ?? 0}
          loading={state.loading}
        />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NextAction
          href="/transactions/import"
          title="Import transactions"
          description="Upload a CSV from your bank. Sample provided on the page."
        />
        <NextAction
          href="/transactions"
          title="Run categorization"
          description="Categorize individual or selected transactions."
        />
        <NextAction
          href="/review"
          title="Review uncertain items"
          description={`${reviewing} transaction${reviewing === 1 ? "" : "s"} awaiting review.`}
          emphasis={reviewing > 0}
        />
        <NextAction
          href="/ledger"
          title="Export ledger"
          description="Download finalized categorized CSV."
        />
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Recent transactions" linkHref="/transactions" linkLabel="View all →">
          {state.transactions && state.transactions.items.length === 0 ? (
            <EmptyState
              message="No transactions yet."
              actionHref="/transactions/import"
              actionLabel="Import a CSV →"
            />
          ) : (
            <ul className="divide-y divide-surface-border">
              {(state.transactions?.items ?? []).map((tx) => (
                <li key={tx.id} className="py-2">
                  <Link
                    href={`/transactions/${tx.id}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-text-primary">{tx.description}</p>
                      <p className="text-[11px] text-text-subtle">
                        <span className="mono">{formatDate(tx.transaction_date)}</span>
                        {tx.merchant && ` · ${tx.merchant}`}
                      </p>
                    </div>
                    <span className="mono text-[13px] text-text-primary">
                      {formatAmount(tx.amount_cents, tx.currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent audit events" linkHref={null} linkLabel={null}>
          {state.events && state.events.length === 0 ? (
            <EmptyState message="No activity yet." />
          ) : (
            <ul className="divide-y divide-surface-border">
              {(state.events ?? []).map((event) => (
                <li key={event.id} className="py-2 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-text-primary">
                      <span className="mono text-[12px] text-text-subtle">{event.entity_type}</span>{" "}
                      <span className="font-medium">{event.action}</span>
                    </span>
                    <span className="text-[11px] text-text-subtle">
                      {formatTimestamp(event.created_at)}
                    </span>
                  </div>
                  {event.entity_id && (
                    <p className="mono mt-0.5 text-[11px] text-text-subtle">{event.entity_id}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </AppShell>
  );
}

function Tile({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone?: "amber";
}) {
  const valueClass =
    tone === "amber" && value > 0 ? "text-amber-700" : "text-text-primary";
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-4">
      <p className="field-label">{label}</p>
      <p className={`mt-1 font-display text-[24px] font-medium ${valueClass}`}>
        {loading ? "—" : value}
      </p>
    </div>
  );
}

function NextAction({
  href,
  title,
  description,
  emphasis = false,
}: {
  href: string;
  title: string;
  description: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition-colors duration-short ease-out-expo ${
        emphasis
          ? "border-brand-600 bg-brand-100 hover:bg-brand-200/60"
          : "border-surface-border bg-surface-panel hover:bg-surface-sunken"
      }`}
    >
      <p className="text-[14px] font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[12px] text-text-secondary">{description}</p>
    </Link>
  );
}

function Card({
  title,
  linkHref,
  linkLabel,
  children,
}: {
  title: string;
  linkHref: string | null;
  linkLabel: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[16px] font-medium text-text-primary">{title}</h2>
        {linkHref && linkLabel && (
          <Link href={linkHref} className="text-[12px] text-brand-700 hover:text-brand-800">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <p className="py-4 text-[13px] text-text-subtle">
      {message}{" "}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="text-brand-700 hover:text-brand-800">
          {actionLabel}
        </Link>
      )}
    </p>
  );
}

