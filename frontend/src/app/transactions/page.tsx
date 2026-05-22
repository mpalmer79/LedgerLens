"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  ApiError,
  categorize,
  categorizeBatch,
  listCategorizationResults,
  listTransactions,
} from "@/lib/api/client";
import type { CategorizationResult, Transaction } from "@/lib/api/types";
import { formatAmount, formatConfidence, formatDate } from "@/lib/format";

type TxRow = {
  tx: Transaction;
  latest: CategorizationResult | null;
};

type Filter = "all" | "needs_review" | "auto_approved" | "corrected" | "uncategorizable" | "pending";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "needs_review", label: "Needs review" },
  { id: "auto_approved", label: "Auto-approved" },
  { id: "corrected", label: "Corrected" },
  { id: "uncategorizable", label: "Uncategorizable" },
];

export default function TransactionsPage() {
  const [rows, setRows] = useState<TxRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const txs = await listTransactions({ limit: 200 });
      const items = await Promise.all(
        txs.items.map(async (tx) => {
          try {
            const results = await listCategorizationResults(tx.id);
            return { tx, latest: results[0] ?? null };
          } catch {
            return { tx, latest: null };
          }
        }),
      );
      setRows(items);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : String(err),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [] as TxRow[];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = row.latest?.status ?? "pending";
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      const haystack = `${row.tx.description} ${row.tx.merchant ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, filter, search]);

  async function categorizeOne(txId: string) {
    setActionError(null);
    setBusyIds((prev) => new Set(prev).add(txId));
    try {
      const result = await categorize(txId);
      setRows((prev) =>
        prev
          ? prev.map((r) => (r.tx.id === txId ? { ...r, latest: result } : r))
          : prev,
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : String(err),
      );
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(txId);
        return next;
      });
    }
  }

  async function categorizeSelected() {
    if (selected.size === 0) return;
    setActionError(null);
    setBatchRunning(true);
    try {
      const ids = Array.from(selected);
      const out = await categorizeBatch(ids);
      // Refresh just the affected rows.
      const byId = new Map(out.results.map((r) => [r.transaction_id, r]));
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              byId.has(r.tx.id) ? { ...r, latest: byId.get(r.tx.id) ?? r.latest } : r,
            )
          : prev,
      );
      setSelected(new Set());
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : String(err),
      );
    } finally {
      setBatchRunning(false);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map((r) => r.tx.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-text-primary">Transactions</h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            All imported transactions. Categorize individually or batch-categorize selected rows.
          </p>
        </div>
        <Link
          href="/transactions/import"
          className="rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
        >
          Import CSV →
        </Link>
      </header>

      <section className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={
                filter === f.id
                  ? "rounded border border-brand-600 bg-brand-100 px-2.5 py-1 text-[12px] font-medium text-brand-800"
                  : "rounded border border-surface-border bg-surface-panel px-2.5 py-1 text-[12px] text-text-secondary hover:bg-surface-sunken"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search description or merchant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[13px]"
        />
        <div className="flex items-center gap-2 text-[12px] text-text-subtle">
          <button
            type="button"
            onClick={selectAllVisible}
            className="hover:text-text-primary"
            disabled={filtered.length === 0}
          >
            Select all ({filtered.length})
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={clearSelection}
            className="hover:text-text-primary"
            disabled={selected.size === 0}
          >
            Clear
          </button>
        </div>
        <button
          type="button"
          onClick={categorizeSelected}
          disabled={selected.size === 0 || batchRunning}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {batchRunning ? "Categorizing…" : `Categorize ${selected.size || ""} selected`}
        </button>
      </section>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          {actionError}
        </div>
      )}

      <section className="mt-6 overflow-x-auto rounded-lg border border-brand-200 bg-brand-100">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-brand-200">
            <tr>
              <th className="px-3 py-2 w-8" />
              <th className="field-label px-3 py-2">Date</th>
              <th className="field-label px-3 py-2">Description</th>
              <th className="field-label px-3 py-2">Merchant</th>
              <th className="field-label px-3 py-2 text-right">Amount</th>
              <th className="field-label px-3 py-2">Category</th>
              <th className="field-label px-3 py-2">Conf</th>
              <th className="field-label px-3 py-2">Status</th>
              <th className="field-label px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-text-subtle">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-text-subtle">
                  No transactions match.{" "}
                  <Link href="/transactions/import" className="text-brand-700 hover:text-brand-800">
                    Import a CSV →
                  </Link>
                </td>
              </tr>
            )}
            {filtered.map(({ tx, latest }) => {
              const status = latest?.status ?? "pending";
              return (
                <tr key={tx.id} className="border-b border-brand-200/50 last:border-0">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleSelected(tx.id)}
                      className="accent-brand-600"
                    />
                  </td>
                  <td className="mono px-3 py-1.5 text-text-secondary">
                    {formatDate(tx.transaction_date)}
                  </td>
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/transactions/${tx.id}`}
                      className="text-text-primary hover:text-brand-700"
                    >
                      {tx.description}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-text-secondary">{tx.merchant ?? "—"}</td>
                  <td className="mono px-3 py-1.5 text-right text-text-primary">
                    {formatAmount(tx.amount_cents, tx.currency)}
                  </td>
                  <td className="px-3 py-1.5 text-text-secondary">
                    {latest ? (
                      <span>
                        <span className="mono text-text-subtle">{latest.predicted_category_code}</span>
                        {latest.predicted_category_name && (
                          <span className="ml-1">{latest.predicted_category_name}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </td>
                  <td className="mono px-3 py-1.5 text-text-secondary">
                    {formatConfidence(latest?.confidence)}
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => categorizeOne(tx.id)}
                      disabled={busyIds.has(tx.id)}
                      className="rounded border border-surface-border bg-surface-panel px-2 py-1 text-[12px] text-text-primary hover:bg-surface-sunken disabled:opacity-50"
                    >
                      {busyIds.has(tx.id)
                        ? "…"
                        : latest
                          ? "Re-categorize"
                          : "Categorize"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
