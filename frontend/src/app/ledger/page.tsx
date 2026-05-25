"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import { TrustPanel } from "@/components/app/TrustPanel";
import { ApiError, downloadCsvExport, getLedger } from "@/lib/api/client";
import type { Ledger } from "@/lib/api/types";
import { formatAmount, formatConfidence, formatDate } from "@/lib/format";

export default function LedgerPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLedger();
        if (!cancelled) {
          setLedger(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
              : String(err),
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finalized = (ledger?.rows ?? []).filter((r) =>
    ["auto_approved", "corrected"].includes(r.categorization_status),
  );
  const unresolved = (ledger?.rows ?? []).filter(
    (r) => !["auto_approved", "corrected", "uncategorizable"].includes(r.categorization_status),
  );
  const uncategorizable = (ledger?.rows ?? []).filter(
    (r) => r.categorization_status === "uncategorizable",
  );

  const hasUnverified = (ledger?.trust.unverified_finalized_count ?? 0) > 0;

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async () => {
    if (exporting) return;
    if (hasUnverified) {
      const ok = window.confirm(
        "This ledger contains finalized rows that have not been verified by review, " +
          "correction memory, or a deterministic rule. Export anyway?\n\n" +
          "Recommended: review the unverified rows before treating this CSV as final " +
          "bookkeeping output.",
      );
      if (!ok) return;
    }
    setExporting(true);
    setExportError("");
    try {
      await downloadCsvExport("/ledger/export.csv");
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed. Try again.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-medium text-text-primary">
            Reviewed categorization export.
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] text-text-secondary">
            The final product is not an AI response. It is a categorized transaction sheet with
            reviewed decisions and traceable status — closer to a chart-of-accounts-aware
            CSV than a double-entry accounting ledger. Corrected categories take precedence
            over any model prediction; unresolved review items are explicitly flagged and
            excluded from the finalized count.
          </p>
        </div>
        <div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`rounded-md px-4 py-2 text-[13px] font-medium text-white ${
              exporting
                ? "cursor-wait bg-brand-400"
                : hasUnverified
                  ? "bg-amber-600 hover:bg-amber-500"
                  : "bg-brand-600 hover:bg-brand-500"
            }`}
          >
            {exporting
              ? "Downloading…"
              : hasUnverified
                ? "Export CSV (warning) ↓"
                : "Export CSV ↓"}
          </button>
          {exportError && (
            <p className="mt-1 text-[12px] text-red-700">{exportError}</p>
          )}
        </div>
      </header>

      {hasUnverified && ledger && (
        <section className="mt-4 rounded-md border-2 border-amber-400 bg-amber-50 p-4">
          <p className="text-[14px] font-medium text-amber-900">
            This ledger contains{" "}
            <span className="mono">{ledger.trust.unverified_finalized_count}</span> unverified
            finalized row{ledger.trust.unverified_finalized_count === 1 ? "" : "s"}.
          </p>
          <p className="mt-1 text-[13px] text-amber-900">
            Recommended: review unverified rows before treating this export as final
            bookkeeping output. The CSV still exports — every row carries a per-row{" "}
            <span className="mono">verified</span> column so downstream tooling can filter.
          </p>
        </section>
      )}

      {!hasUnverified && ledger && ledger.trust.finalized_count > 0 && (
        <section className="mt-4 rounded-md border-2 border-brand-600 bg-brand-100 p-4">
          <p className="text-[14px] font-medium text-brand-900">
            Every finalized row is verified.
          </p>
          <p className="mt-1 text-[13px] text-brand-800">
            All{" "}
            <span className="mono">{ledger.trust.finalized_count}</span> finalized row
            {ledger.trust.finalized_count === 1 ? "" : "s"} were decided by a deterministic
            rule auto-approval, a correction-memory replay, or an explicit human review. The
            CSV export carries the same per-row <span className="mono">verified=true</span>{" "}
            signal so downstream tooling can confirm.
          </p>
        </section>
      )}

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="mt-6 text-[14px] text-text-subtle">Loading…</p>}

      {ledger && (
        <>
          <TrustPanel trust={ledger.trust} />
          {ledger.unresolved > 0 && (
            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-[14px] font-medium text-amber-900">
                {ledger.unresolved} transaction{ledger.unresolved === 1 ? "" : "s"} not yet
                finalized.
              </p>
              <p className="mt-1 text-[13px] text-amber-800">
                Items below in the &quot;Unresolved&quot; section are still pending or awaiting
                review and are not included in the finalized ledger above.{" "}
                <Link href="/review" className="underline">
                  Resolve them in the review queue →
                </Link>
              </p>
            </div>
          )}

          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Total transactions" value={ledger.total} />
            <Tile label="Finalized" value={finalized.length} />
            <Tile label="Unresolved" value={ledger.unresolved} tone={ledger.unresolved > 0 ? "amber" : undefined} />
            <Tile label="Uncategorizable" value={uncategorizable.length} />
          </section>

          <h2 className="mt-10 font-display text-[20px] font-medium text-text-primary">
            Finalized ({finalized.length})
          </h2>
          <LedgerTable rows={finalized} emptyMessage="No finalized transactions yet." />

          {unresolved.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-[20px] font-medium text-amber-900">
                Unresolved — not exported as finalized ({unresolved.length})
              </h2>
              <LedgerTable rows={unresolved} emptyMessage="" tone="amber" />
            </>
          )}

          {uncategorizable.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-[20px] font-medium text-text-secondary">
                Uncategorizable ({uncategorizable.length})
              </h2>
              <LedgerTable rows={uncategorizable} emptyMessage="" />
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "amber";
}) {
  const valueClass = tone === "amber" && value > 0 ? "text-amber-800" : "text-text-primary";
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-4">
      <p className="field-label">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}

function LedgerTable({
  rows,
  emptyMessage,
  tone,
}: {
  rows: Ledger["rows"];
  emptyMessage: string;
  tone?: "amber";
}) {
  if (rows.length === 0) {
    return emptyMessage ? (
      <p className="mt-4 text-[13px] text-text-subtle">{emptyMessage}</p>
    ) : null;
  }
  return (
    <div
      className={`mt-4 overflow-x-auto rounded-lg border ${
        tone === "amber" ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-100"
      }`}
    >
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-brand-200">
          <tr>
            <th className="field-label px-3 py-2">Date</th>
            <th className="field-label px-3 py-2">Description</th>
            <th className="field-label px-3 py-2 text-right">Amount</th>
            <th className="field-label px-3 py-2">Category</th>
            <th className="field-label px-3 py-2">Status</th>
            <th className="field-label px-3 py-2">Conf</th>
            <th className="field-label px-3 py-2">Reviewed</th>
            <th className="field-label px-3 py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.transaction_id} className="border-b border-brand-200/50 last:border-0">
              <td className="mono px-3 py-1.5 text-text-secondary">
                {formatDate(r.transaction_date)}
              </td>
              <td className="px-3 py-1.5 text-text-primary">
                <Link
                  href={`/transactions/${r.transaction_id}`}
                  className="hover:text-brand-700"
                >
                  {r.description}
                </Link>
              </td>
              <td className="mono px-3 py-1.5 text-right text-text-primary">
                {formatAmount(r.amount_cents, r.currency)}
              </td>
              <td className="px-3 py-1.5 text-text-secondary">
                {r.category_code ? (
                  <span>
                    <span className="mono text-text-subtle">{r.category_code}</span>{" "}
                    {r.category_name}
                  </span>
                ) : (
                  <span className="text-text-subtle">—</span>
                )}
              </td>
              <td className="px-3 py-1.5">
                <StatusBadge status={r.categorization_status} />
              </td>
              <td className="mono px-3 py-1.5 text-text-secondary">
                {formatConfidence(r.confidence)}
              </td>
              <td className="px-3 py-1.5 text-[12px] text-text-secondary">
                {r.reviewed ? "yes" : "no"}
              </td>
              <td className="px-3 py-1.5 text-[12px] text-text-subtle">{r.reviewer_note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
