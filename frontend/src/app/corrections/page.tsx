"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ApiError, deactivateCorrection, listCorrections } from "@/lib/api/client";
import type { CorrectionMemory } from "@/lib/api/types";
import { formatTimestamp } from "@/lib/format";

type Filter = "active" | "inactive" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
  { id: "all", label: "All" },
];

export default function CorrectionsPage() {
  const [rows, setRows] = useState<CorrectionMemory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const active = filter === "all" ? undefined : filter === "active";
      const res = await listCorrections({ active, limit: 200 });
      setRows(res.items);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = useMemo(() => {
    if (!rows) return [] as CorrectionMemory[];
    const q = search.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.merchant_key.includes(q) || r.description_key.includes(q),
    );
  }, [rows, search]);

  async function deactivate(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await deactivateCorrection(id);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : String(err),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <header>
        <h1 className="font-display text-[28px] font-medium text-text-primary">
          Human corrections become reusable bookkeeping memory.
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-text-secondary">
          When a reviewer corrects a transaction, LedgerLens stores a deterministic{" "}
          <span className="mono">(merchant, description) → category</span> rule. The next
          matching vendor or description is categorized from this memory at{" "}
          <strong>zero model cost</strong>. This is rule lookup, not model training — and
          deactivating any row stops it from being applied.
        </p>
      </header>

      <aside className="mt-4 rounded border border-surface-border bg-surface-panel p-3 text-[12px] text-text-secondary">
        <p className="font-medium text-text-primary">Why this matters</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Reduces repeated cleanup — Adobe corrected once stays corrected for future Adobe charges.</li>
          <li>Keeps humans in control — every memory row is editable and one click from deactivation.</li>
          <li>Makes learning auditable — each row points back to the source transaction and review decision.</li>
          <li>Avoids opaque model retraining — the memory is a SQL table you can read, not a fine-tuned weight you can&apos;t.</li>
        </ul>
      </aside>

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
          placeholder="Search merchant or description key…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px] rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[13px]"
        />
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
              <th className="field-label px-3 py-2">Merchant key</th>
              <th className="field-label px-3 py-2">Description key</th>
              <th className="field-label px-3 py-2">Category</th>
              <th className="field-label px-3 py-2 text-right">Matches</th>
              <th className="field-label px-3 py-2">Last used</th>
              <th className="field-label px-3 py-2">Source</th>
              <th className="field-label px-3 py-2">Status</th>
              <th className="field-label px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-text-subtle">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-text-subtle">
                  No learned corrections yet.{" "}
                  <Link href="/review" className="text-brand-700 hover:text-brand-800">
                    Correct a transaction in the review queue →
                  </Link>
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-brand-200/50 last:border-0 ${
                  row.active ? "" : "opacity-60"
                }`}
              >
                <td className="mono px-3 py-1.5 text-text-primary">{row.merchant_key || "—"}</td>
                <td className="mono px-3 py-1.5 text-text-secondary truncate max-w-[260px]">
                  {row.description_key || "—"}
                </td>
                <td className="px-3 py-1.5 text-text-primary">
                  <span className="mono text-text-subtle">{row.selected_category_code}</span>
                </td>
                <td className="mono px-3 py-1.5 text-right text-text-primary">{row.match_count}</td>
                <td className="px-3 py-1.5 text-text-secondary">
                  {row.last_used_at ? formatTimestamp(row.last_used_at) : "—"}
                </td>
                <td className="px-3 py-1.5 text-text-subtle text-[12px]">
                  <Link
                    href={`/transactions/${row.source_transaction_id}`}
                    className="mono hover:text-brand-700"
                  >
                    {row.source_transaction_id}
                  </Link>
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                      row.active
                        ? "border-brand-200 bg-brand-100 text-brand-800"
                        : "border-surface-border bg-surface-sunken text-text-secondary"
                    }`}
                  >
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  {row.active ? (
                    <button
                      type="button"
                      onClick={() => deactivate(row.id)}
                      disabled={busyId === row.id}
                      className="rounded border border-surface-border bg-surface-panel px-2 py-1 text-[12px] text-text-primary hover:bg-surface-sunken disabled:opacity-50"
                    >
                      {busyId === row.id ? "…" : "Deactivate"}
                    </button>
                  ) : (
                    <span className="text-[12px] text-text-subtle">deactivated</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-6 max-w-3xl text-[12px] text-text-subtle">
        Memory rows are created only from explicit <strong>Correct</strong> review actions
        (approvals don&apos;t create rules). Generic merchants like <span className="mono">ACH</span>,{" "}
        <span className="mono">POS</span>, or <span className="mono">TRANSFER</span> are
        intentionally ignored. When two corrections disagree on the same merchant, future
        transactions route to the review queue instead of auto-applying either.
      </p>
    </AppShell>
  );
}
