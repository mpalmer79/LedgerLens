"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  ApiError,
  approveReview,
  categorize,
  correctReview,
  getTransaction,
  listAuditEvents,
  listCategorizationResults,
  listCategories,
  markUncategorizable,
} from "@/lib/api/client";
import type {
  AuditEvent,
  CategorizationResult,
  Category,
  Transaction,
} from "@/lib/api/types";
import { formatAmount, formatConfidence, formatTimestamp } from "@/lib/format";

type State = {
  tx: Transaction | null;
  results: CategorizationResult[];
  categories: Category[];
  events: AuditEvent[];
  loading: boolean;
  error: string | null;
};

const INITIAL: State = {
  tx: null,
  results: [],
  categories: [],
  events: [],
  loading: true,
  error: null,
};

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const txId = params?.id ?? "";

  const [state, setState] = useState<State>(INITIAL);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [correctCode, setCorrectCode] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [tx, results, categories, events] = await Promise.all([
        getTransaction(txId),
        listCategorizationResults(txId).catch(() => []),
        listCategories().catch(() => []),
        listAuditEvents({ entity_id: txId, limit: 50 }).catch(() => []),
      ]);
      setState({ tx, results, categories, events, loading: false, error: null });
    } catch (err) {
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

  useEffect(() => {
    if (!txId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId]);

  async function runAction(name: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    setActionMsg(null);
    try {
      await fn();
      setActionMsg(`${name} complete.`);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : String(err),
      );
    } finally {
      setBusy(false);
    }
  }

  const latest = state.results[0] ?? null;

  return (
    <AppShell>
      <Link
        href="/transactions"
        className="text-[12px] text-text-subtle hover:text-text-primary"
      >
        ← All transactions
      </Link>

      {state.loading && (
        <p className="mt-6 text-[14px] text-text-subtle">Loading…</p>
      )}

      {state.error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {state.error}
        </div>
      )}

      {state.tx && (
        <>
          <header className="mt-3">
            <h1 className="font-display text-[24px] font-medium text-text-primary">
              {state.tx.description}
            </h1>
            <p className="mt-1 text-[14px] text-text-secondary">
              <span className="mono">{state.tx.transaction_date}</span>
              {state.tx.merchant && (
                <>
                  {" "}
                  · <span>{state.tx.merchant}</span>
                </>
              )}{" "}
              · <span className="mono">{state.tx.id}</span>
            </p>
          </header>

          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Amount" value={formatAmount(state.tx.amount_cents, state.tx.currency)} mono />
            <Field label="Currency" value={state.tx.currency} />
            <Field label="Source" value={state.tx.source} />
            <Field label="Latest status">
              <StatusBadge status={latest?.status ?? "pending"} />
            </Field>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-brand-100 p-4">
              <p className="field-label">Raw description</p>
              <p className="mono mt-1 text-[13px] text-text-primary">
                {state.tx.raw_description}
              </p>
              <p className="field-label mt-4">Normalized description</p>
              <p className="mono mt-1 text-[13px] text-text-primary">
                {state.tx.normalized_description || "—"}
              </p>
            </div>

            <div className="rounded-lg border border-brand-200 bg-brand-100 p-4">
              <p className="field-label">Latest categorization</p>
              {latest ? (
                <div className="mt-2 space-y-2 text-[13px]">
                  <p>
                    <span className="mono text-text-subtle">
                      [{latest.predicted_category_code}]
                    </span>{" "}
                    <span className="text-text-primary">{latest.predicted_category_name}</span>
                  </p>
                  <p className="text-text-secondary">
                    Confidence:{" "}
                    <span className="mono text-text-primary">
                      {formatConfidence(latest.confidence)}
                    </span>
                  </p>
                  <p className="text-text-secondary">{latest.explanation}</p>
                  <p className="text-[11px] text-text-subtle">
                    Model: <span className="mono">{latest.model_name ?? "—"}</span> · Latency{" "}
                    <span className="mono">{latest.latency_ms} ms</span> · Cost{" "}
                    <span className="mono">${latest.estimated_cost_usd.toFixed(4)}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-text-subtle">
                  Not yet categorized.{" "}
                  <button
                    type="button"
                    onClick={() => runAction("Categorize", () => categorize(txId))}
                    disabled={busy}
                    className="text-brand-700 hover:text-brand-800"
                  >
                    Run categorization →
                  </button>
                </p>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
            <p className="field-label">Review actions</p>
            <p className="mt-1 text-[12px] text-text-subtle">
              Available regardless of current status; approve/correct/uncategorizable each write an
              audit event.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="field-label">Correct to category</label>
                <select
                  className="mt-1 w-full rounded border border-surface-border bg-surface-panel px-2 py-1.5 text-[13px]"
                  value={correctCode}
                  onChange={(e) => setCorrectCode(e.target.value)}
                  disabled={state.categories.length === 0}
                >
                  <option value="">— select —</option>
                  {state.categories.map((c) => (
                    <option key={c.code} value={c.code}>
                      [{c.code}] {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="field-label">Reviewer note (optional)</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-surface-border bg-surface-panel px-2 py-1.5 text-[13px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. mis-categorized as software"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !latest}
                onClick={() =>
                  runAction("Re-categorize", () => categorize(txId))
                }
                className="rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[13px] hover:bg-surface-sunken disabled:opacity-50"
              >
                {latest ? "Re-categorize" : "Categorize"}
              </button>
              <button
                type="button"
                disabled={busy || !latest}
                onClick={() =>
                  runAction("Approve", () => approveReview(txId, note || undefined))
                }
                className="rounded bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                Approve latest
              </button>
              <button
                type="button"
                disabled={busy || !latest || !correctCode}
                onClick={() =>
                  runAction("Correct", () => correctReview(txId, correctCode, note || undefined))
                }
                className="rounded border-2 border-brand-600 bg-surface-panel px-3 py-1.5 text-[13px] font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                Correct to selected
              </button>
              <button
                type="button"
                disabled={busy || !latest}
                onClick={() =>
                  runAction("Mark uncategorizable", () =>
                    markUncategorizable(txId, note || undefined),
                  )
                }
                className="rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface-sunken disabled:opacity-50"
              >
                Mark uncategorizable
              </button>
            </div>
            {actionError && (
              <p className="mt-2 text-[13px] text-red-700">{actionError}</p>
            )}
            {actionMsg && (
              <p className="mt-2 text-[13px] text-brand-700">{actionMsg}</p>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
            <p className="field-label">All categorization attempts ({state.results.length})</p>
            {state.results.length === 0 ? (
              <p className="mt-2 text-[13px] text-text-subtle">No attempts yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-brand-200/60">
                {state.results.map((r) => (
                  <li key={r.id} className="py-2 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="mono text-text-subtle">[{r.predicted_category_code}]</span>{" "}
                        <span className="text-text-primary">{r.predicted_category_name}</span>{" "}
                        — conf{" "}
                        <span className="mono">{formatConfidence(r.confidence)}</span>
                      </span>
                      <span className="text-[11px] text-text-subtle">
                        {formatTimestamp(r.created_at)} ·{" "}
                        <StatusBadge status={r.status} />
                      </span>
                    </div>
                    {r.explanation && (
                      <p className="mt-1 text-[12px] italic text-text-secondary">{r.explanation}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
            <p className="field-label">Audit trail ({state.events.length})</p>
            {state.events.length === 0 ? (
              <p className="mt-2 text-[13px] text-text-subtle">No audit events.</p>
            ) : (
              <ul className="mt-3 divide-y divide-brand-200/60">
                {state.events.map((e) => (
                  <li key={e.id} className="py-2 text-[12px]">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        <span className="mono text-text-subtle">{e.entity_type}</span>{" "}
                        <span className="font-medium text-text-primary">{e.action}</span>
                      </span>
                      <span className="text-[11px] text-text-subtle">
                        {formatTimestamp(e.created_at)}
                      </span>
                    </div>
                    {Object.keys(e.details).length > 0 && (
                      <pre className="mono mt-1 overflow-x-auto rounded bg-surface-sunken p-2 text-[11px] text-text-secondary">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function Field({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-3">
      <p className="field-label">{label}</p>
      {children ?? (
        <p
          className={`mt-1 text-[14px] text-text-primary ${mono ? "mono" : ""}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
