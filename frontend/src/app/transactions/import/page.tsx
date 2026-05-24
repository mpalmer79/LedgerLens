"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ApiError, importCsv } from "@/lib/api/client";
import type { CsvImportSummary } from "@/lib/api/types";

const SAMPLE_CSV = `transaction_date,description,merchant,amount,currency,source
2026-03-08,Comcast Business Internet,Comcast Business,-199.00,USD,bank
2026-03-09,QuickBooks Online subscription,QuickBooks,-70.00,USD,bank
2026-03-09,Claude API usage variable,Anthropic,-24.80,USD,bank
2026-03-10,NAPA Auto Parts order,NAPA Auto Parts,-215.44,USD,bank
2026-03-10,ADP Payroll bi-weekly,ADP,-8930.00,USD,bank
2026-03-11,Costco Business paper supplies,Costco Business,-418.62,USD,bank
2026-03-11,Stripe payout daily settlement,Stripe,3420.00,USD,bank
2026-03-12,State Farm monthly auto policy,State Farm,-284.00,USD,bank
2026-03-12,Shell fuel company vehicle,Shell,-72.30,USD,bank
2026-03-13,Sysco Foods weekly delivery,Sysco Foods,-1247.18,USD,bank
2026-03-14,Mitchell1 repair manuals,Mitchell1,-172.99,USD,bank
2026-03-14,ACH TRANSFER UNKNOWN VENDOR,,-149.00,USD,bank`;

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CsvImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [pasteMode, setPasteMode] = useState(false);

  async function submit() {
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      let payload: File | Blob;
      let filename = "import.csv";
      if (pasteMode) {
        if (!pastedText.trim()) {
          throw new Error("Paste CSV content first.");
        }
        payload = new Blob([pastedText], { type: "text/csv" });
      } else {
        if (!file) {
          throw new Error("Choose a CSV file first.");
        }
        payload = file;
        filename = file.name || filename;
      }
      const summary = await importCsv(payload, filename);
      setResult(summary);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ledgerlens-sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function loadSampleIntoPaste() {
    setPasteMode(true);
    setPastedText(SAMPLE_CSV);
  }

  return (
    <AppShell>
      <header>
        <h1 className="font-display text-[28px] font-medium text-text-primary">
          Import transactions
        </h1>
        <div
          role="alert"
          className="mt-3 max-w-3xl rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900"
        >
          <p className="font-medium">
            Public demo — do not upload real bank data.
          </p>
          <p className="mt-1 text-[12px]">
            Use sample or synthetic CSV data only. Do not upload real bank
            statements, customer information, employee information, account
            numbers, or sensitive financial data. There is no authentication
            and no tenant isolation on this deploy — uploaded rows are
            visible to anyone with the URL. A sample CSV is one click away
            below.
          </p>
        </div>
        <p className="mt-3 text-[14px] text-text-secondary">
          Upload a CSV of bank transactions, or paste CSV content directly.
          Supported columns:{" "}
          <span className="mono text-[12px]">
            transaction_date · description · merchant · amount · currency · source
          </span>
          . Column order is flexible; extra columns are ignored.
        </p>
      </header>

      <section className="mt-8 rounded-lg border border-brand-200 bg-brand-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 text-[13px]">
            <button
              type="button"
              onClick={() => setPasteMode(false)}
              className={
                pasteMode
                  ? "rounded border border-surface-border bg-surface-panel px-3 py-1 text-text-secondary"
                  : "rounded border-2 border-brand-600 bg-surface-panel px-3 py-1 font-medium text-text-primary"
              }
            >
              Upload file
            </button>
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className={
                pasteMode
                  ? "rounded border-2 border-brand-600 bg-surface-panel px-3 py-1 font-medium text-text-primary"
                  : "rounded border border-surface-border bg-surface-panel px-3 py-1 text-text-secondary"
              }
            >
              Paste CSV
            </button>
          </div>
          <div className="flex gap-3 text-[12px]">
            <button
              type="button"
              onClick={downloadSample}
              className="text-brand-700 hover:text-brand-800"
            >
              Download sample CSV
            </button>
            <button
              type="button"
              onClick={loadSampleIntoPaste}
              className="text-brand-700 hover:text-brand-800"
            >
              Load sample into paste box
            </button>
          </div>
        </div>

        {pasteMode ? (
          <textarea
            className="mono mt-4 w-full rounded border border-surface-border bg-surface-panel p-3 text-[12px]"
            rows={10}
            placeholder="Paste CSV here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
        ) : (
          <div className="mt-4">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block text-[13px] text-text-secondary file:mr-3 file:rounded file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-white hover:file:bg-brand-500"
            />
            {file && (
              <p className="mt-2 text-[12px] text-text-subtle">
                Selected: <span className="mono">{file.name}</span> ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-500 disabled:opacity-60"
          >
            {submitting ? "Importing..." : "Import CSV"}
          </button>
          {result && (
            <Link href="/transactions" className="text-[13px] text-brand-700 hover:text-brand-800">
              View imported transactions →
            </Link>
          )}
        </div>
      </section>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {result && (
        <section className="mt-6">
          <h2 className="font-display text-[18px] font-medium text-text-primary">
            Import summary
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Summary label="Received rows" value={result.received_rows} />
            <Summary label="Created" value={result.created} />
            <Summary label="Errors" value={result.errors.length} tone={result.errors.length > 0 ? "amber" : undefined} />
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-[13px] font-medium text-amber-900">Rows that did not import</p>
              <ul className="mt-2 space-y-1 text-[12px] text-amber-900">
                {result.errors.map((e, i) => (
                  <li key={i} className="mono">
                    Row {e.row}: {e.error}
                    {e.message && ` — ${e.message}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.transactions.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-brand-200 bg-brand-100">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-brand-200">
                  <tr>
                    <th className="field-label px-3 py-2">Date</th>
                    <th className="field-label px-3 py-2">Description</th>
                    <th className="field-label px-3 py-2">Merchant</th>
                    <th className="field-label px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.map((t) => (
                    <tr key={t.id} className="border-b border-brand-200/50 last:border-0">
                      <td className="mono px-3 py-1.5 text-text-secondary">
                        {t.transaction_date}
                      </td>
                      <td className="px-3 py-1.5 text-text-primary">{t.description}</td>
                      <td className="px-3 py-1.5 text-text-secondary">{t.merchant ?? "—"}</td>
                      <td className="mono px-3 py-1.5 text-right text-text-primary">
                        {(t.amount_cents / 100).toFixed(2)} {t.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}

function Summary({
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
      <p className={`mt-1 font-display text-[24px] font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}
