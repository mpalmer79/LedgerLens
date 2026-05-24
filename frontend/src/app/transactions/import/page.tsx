"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { ErrorState } from "@/components/ui/DataState";
import { ApiError, importCsv } from "@/lib/api/client";
import {
  detectAccount,
  detectAmount,
  detectCredit,
  detectDate,
  detectDebit,
  detectDescription,
  detectMemo,
  detectMerchant,
  detectReference,
  suggestAmountMode,
} from "@/lib/csv-import/detect";
import {
  buildNormalizedCsv,
  normalizeRows,
} from "@/lib/csv-import/normalize";
import {
  CsvParseError,
  parseCsvFile,
  parseCsvText,
  type ParsedCsv,
} from "@/lib/csv-import/parse";
import type {
  AmountMode,
  ColumnMapping,
  NormalizationSummary,
} from "@/lib/csv-import/types";
import type { CsvImportSummary } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";

type Step = "upload" | "preview" | "map" | "validate" | "import" | "done";

const SAMPLE_CSV_PATH = "/samples/granite-state-bank-sample.csv";

const EMPTY_MAPPING: ColumnMapping = {
  date: null,
  description: null,
  amount: null,
  debit: null,
  credit: null,
  merchant: null,
  memo: null,
  reference: null,
  account: null,
};

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [amountMode, setAmountMode] = useState<AmountMode>("signed");
  const [normalization, setNormalization] = useState<NormalizationSummary | null>(null);
  const [result, setResult] = useState<CsvImportSummary | null>(null);
  const [parseError, setParseError] = useState<unknown>(null);
  const [importError, setImportError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /** Accept a parsed CSV — apply auto-detection and advance the wizard. */
  const acceptParsed = useCallback((parsedCsv: ParsedCsv, sourceLabel: string) => {
    setParsed(parsedCsv);
    setFileName(sourceLabel);
    setParseError(null);
    const headers = parsedCsv.headers;
    const mode = suggestAmountMode(headers);
    setAmountMode(mode);
    setMapping({
      date: detectDate(headers),
      description: detectDescription(headers),
      amount: detectAmount(headers),
      debit: detectDebit(headers),
      credit: detectCredit(headers),
      merchant: detectMerchant(headers),
      memo: detectMemo(headers),
      reference: detectReference(headers),
      account: detectAccount(headers),
    });
    setStep("preview");
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const out = await parseCsvFile(file);
        acceptParsed(out, file.name);
      } catch (err) {
        setParseError(err);
        setParsed(null);
      }
    },
    [acceptParsed],
  );

  const handleSampleLoad = useCallback(async () => {
    try {
      const res = await fetch(SAMPLE_CSV_PATH);
      if (!res.ok) throw new Error("Sample CSV download failed.");
      const text = await res.text();
      const out = parseCsvText(text);
      acceptParsed(out, "granite-state-bank-sample.csv");
    } catch (err) {
      setParseError(err);
    }
  }, [acceptParsed]);

  /** Compute the normalization on demand so the validate step always
   *  reflects the current mapping. */
  const recomputeValidation = useCallback(() => {
    if (!parsed) return null;
    const out = normalizeRows(parsed.rows, mapping, amountMode);
    setNormalization(out);
    return out;
  }, [parsed, mapping, amountMode]);

  const mappingComplete = useMemo(() => {
    if (!mapping.date) return false;
    if (!mapping.description) return false;
    if (amountMode === "signed") return mapping.amount !== null;
    return mapping.debit !== null && mapping.credit !== null;
  }, [mapping, amountMode]);

  const goToValidate = useCallback(() => {
    recomputeValidation();
    setStep("validate");
  }, [recomputeValidation]);

  const submitImport = useCallback(async () => {
    if (!normalization) return;
    setSubmitting(true);
    setImportError(null);
    try {
      const blob = buildNormalizedCsv(normalization.rows);
      const summary = await importCsv(blob, "wizard-import.csv");
      setResult(summary);
      setStep("done");
    } catch (err) {
      setImportError(err);
    } finally {
      setSubmitting(false);
    }
  }, [normalization]);

  const resetWizard = useCallback(() => {
    setStep("upload");
    setFileName("");
    setParsed(null);
    setMapping(EMPTY_MAPPING);
    setAmountMode("signed");
    setNormalization(null);
    setResult(null);
    setParseError(null);
    setImportError(null);
  }, []);

  // Drag-and-drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragging(false), []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

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
            For this public demo, use the sample CSV below or your own
            synthetic test file only. Do not upload real bank statements,
            customer information, employee information, account numbers, or
            sensitive financial data. There is no authentication and no
            tenant isolation on this deploy — uploaded rows are visible to
            anyone with the URL.
          </p>
        </div>
      </header>

      <StepBar step={step} />

      {step === "upload" && (
        <UploadStep
          isDragging={isDragging}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onFile={handleFile}
          onSample={handleSampleLoad}
          parseError={parseError}
        />
      )}

      {step === "preview" && parsed && (
        <PreviewStep
          fileName={fileName}
          parsed={parsed}
          onBack={resetWizard}
          onNext={() => setStep("map")}
        />
      )}

      {step === "map" && parsed && (
        <MapStep
          parsed={parsed}
          mapping={mapping}
          amountMode={amountMode}
          onMappingChange={setMapping}
          onAmountModeChange={setAmountMode}
          onBack={() => setStep("preview")}
          onNext={goToValidate}
          mappingComplete={mappingComplete}
        />
      )}

      {step === "validate" && normalization && (
        <ValidateStep
          normalization={normalization}
          onBack={() => setStep("map")}
          onImport={submitImport}
          submitting={submitting}
          importError={importError}
        />
      )}

      {step === "done" && result && (
        <DoneStep
          result={result}
          fileName={fileName}
          onReset={resetWizard}
        />
      )}
    </AppShell>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview" },
  { key: "map", label: "Map columns" },
  { key: "validate", label: "Validate" },
  { key: "done", label: "Imported" },
];

function StepBar({ step }: { step: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === step || (s.key === "done" && step === "import"));
  return (
    <nav
      aria-label="Import progress"
      className="mt-6 flex flex-wrap items-center gap-1 text-[11px]"
    >
      {STEPS.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <span
            key={s.key}
            className={
              active
                ? "rounded-full border border-brand-600 bg-brand-100 px-2 py-0.5 font-medium text-brand-800"
                : done
                  ? "rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700"
                  : "rounded-full border border-surface-border bg-surface-page px-2 py-0.5 text-text-subtle"
            }
          >
            {i + 1}. {s.label}
          </span>
        );
      })}
    </nav>
  );
}

// ── Upload step ──────────────────────────────────────────────────────────

function UploadStep(props: {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFile: (f: File) => void;
  onSample: () => void;
  parseError: unknown;
}) {
  return (
    <section className="mt-6 space-y-4">
      <div
        role="region"
        aria-label="Upload CSV"
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
        onDrop={props.onDrop}
        className={
          props.isDragging
            ? "rounded-lg border-2 border-dashed border-brand-600 bg-brand-50 p-8 text-center"
            : "rounded-lg border-2 border-dashed border-surface-border-strong bg-surface-panel p-8 text-center"
        }
      >
        <Upload className="mx-auto h-8 w-8 text-brand-600" aria-hidden="true" />
        <p className="mt-3 font-display text-[18px] font-medium text-text-primary">
          Drag &amp; drop a CSV here
        </p>
        <p className="mt-1 text-[13px] text-text-secondary">
          or choose a file from your computer. CSV files up to 1 MB. The
          wizard will detect column names automatically and let you confirm
          the mapping.
        </p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500">
          <Upload className="h-4 w-4" aria-hidden="true" />
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void props.onFile(f);
            }}
          />
        </label>
      </div>

      <div className="rounded-md border border-surface-border bg-surface-page p-4">
        <p className="text-[13px] font-medium text-text-primary">
          Don&apos;t have a CSV handy?
        </p>
        <p className="mt-1 text-[12px] text-text-secondary">
          Practice the wizard with a synthetic CSV from the Granite State
          Auto Repair fictional scenario. The sample uses separate{" "}
          <span className="mono">Debit</span> /{" "}
          <span className="mono">Credit</span> columns, so it exercises the
          debit/credit mapping mode.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={SAMPLE_CSV_PATH}
            download
            className="inline-flex items-center gap-2 rounded-md border border-surface-border-strong px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download sample CSV
          </a>
          <button
            type="button"
            onClick={props.onSample}
            className="inline-flex items-center gap-2 rounded-md border border-surface-border-strong px-3 py-1.5 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            Load sample into wizard
          </button>
        </div>
      </div>

      {props.parseError !== null && (
        <ErrorState
          title="Couldn’t parse that file"
          message={
            props.parseError instanceof CsvParseError
              ? props.parseError.userMessage
              : props.parseError instanceof Error
                ? props.parseError.message
                : String(props.parseError)
          }
        />
      )}
    </section>
  );
}

// ── Preview step ─────────────────────────────────────────────────────────

function PreviewStep(props: {
  fileName: string;
  parsed: ParsedCsv;
  onBack: () => void;
  onNext: () => void;
}) {
  const preview = props.parsed.rows.slice(0, 10);
  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-lg border border-surface-border bg-surface-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[18px] font-medium text-text-primary">
            Preview — first {preview.length} of {props.parsed.rows.length} rows
          </h2>
          <span className="mono text-[12px] text-text-subtle">{props.fileName}</span>
        </div>
        {props.parsed.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-amber-800">
            {props.parsed.warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-page">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-surface-border bg-surface-panel">
            <tr>
              {props.parsed.headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium text-text-primary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="border-b border-surface-border last:border-0">
                {props.parsed.headers.map((h) => (
                  <td key={h} className="mono whitespace-nowrap px-3 py-1.5 text-text-secondary">
                    {row[h] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
        >
          ← Choose another file
        </button>
        <button
          type="button"
          onClick={props.onNext}
          className="rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
        >
          Map columns →
        </button>
      </div>
    </section>
  );
}

// ── Map step ─────────────────────────────────────────────────────────────

function MapStep(props: {
  parsed: ParsedCsv;
  mapping: ColumnMapping;
  amountMode: AmountMode;
  onMappingChange: (m: ColumnMapping) => void;
  onAmountModeChange: (m: AmountMode) => void;
  onBack: () => void;
  onNext: () => void;
  mappingComplete: boolean;
}) {
  const update = (patch: Partial<ColumnMapping>) =>
    props.onMappingChange({ ...props.mapping, ...patch });

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-lg border border-surface-border bg-surface-panel p-4">
        <h2 className="font-display text-[18px] font-medium text-text-primary">
          Map columns
        </h2>
        <p className="mt-1 text-[12px] text-text-secondary">
          We&apos;ve picked the most likely match for each field. Tweak the
          dropdowns if a different column is the right one. Required fields
          are date, description, and amount.
        </p>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-page p-4">
        <fieldset>
          <legend className="text-[13px] font-medium text-text-primary">
            How is your amount stored?
          </legend>
          <p className="mt-1 text-[12px] text-text-secondary">
            Some banks export one signed column (e.g. <span className="mono">-150.00</span>);
            others export separate debit and credit columns.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label
              className={
                props.amountMode === "signed"
                  ? "flex items-start gap-2 rounded border-2 border-brand-600 bg-brand-50 p-3 text-[13px] text-text-primary"
                  : "flex items-start gap-2 rounded border border-surface-border bg-surface-panel p-3 text-[13px] text-text-primary hover:bg-surface-sunken"
              }
            >
              <input
                type="radio"
                name="amount-mode"
                checked={props.amountMode === "signed"}
                onChange={() => props.onAmountModeChange("signed")}
                className="mt-1"
              />
              <span>
                <strong>Single signed amount column</strong>
                <span className="block text-[11px] text-text-subtle">
                  Negative = expense, positive = revenue.
                </span>
              </span>
            </label>
            <label
              className={
                props.amountMode === "debit_credit"
                  ? "flex items-start gap-2 rounded border-2 border-brand-600 bg-brand-50 p-3 text-[13px] text-text-primary"
                  : "flex items-start gap-2 rounded border border-surface-border bg-surface-panel p-3 text-[13px] text-text-primary hover:bg-surface-sunken"
              }
            >
              <input
                type="radio"
                name="amount-mode"
                checked={props.amountMode === "debit_credit"}
                onChange={() => props.onAmountModeChange("debit_credit")}
                className="mt-1"
              />
              <span>
                <strong>Separate debit &amp; credit columns</strong>
                <span className="block text-[11px] text-text-subtle">
                  Debit = outflow, credit = inflow.
                </span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldSelect
          label="Date"
          required
          headers={props.parsed.headers}
          value={props.mapping.date}
          onChange={(v) => update({ date: v })}
          help="Which column contains the transaction date?"
        />
        <FieldSelect
          label="Description"
          required
          headers={props.parsed.headers}
          value={props.mapping.description}
          onChange={(v) => update({ description: v })}
          help="Which column best describes the transaction?"
        />
        {props.amountMode === "signed" ? (
          <FieldSelect
            label="Amount (signed)"
            required
            headers={props.parsed.headers}
            value={props.mapping.amount}
            onChange={(v) => update({ amount: v })}
            help="Negative = expense, positive = revenue."
          />
        ) : (
          <>
            <FieldSelect
              label="Debit (outflow)"
              required
              headers={props.parsed.headers}
              value={props.mapping.debit}
              onChange={(v) => update({ debit: v })}
              help="Money out — withdrawals, charges, expenses."
            />
            <FieldSelect
              label="Credit (inflow)"
              required
              headers={props.parsed.headers}
              value={props.mapping.credit}
              onChange={(v) => update({ credit: v })}
              help="Money in — deposits, payments, revenue."
            />
          </>
        )}
        <FieldSelect
          label="Merchant"
          headers={props.parsed.headers}
          value={props.mapping.merchant}
          onChange={(v) => update({ merchant: v })}
          help="Optional. We'll extract from the description if blank."
        />
        <FieldSelect
          label="Memo"
          headers={props.parsed.headers}
          value={props.mapping.memo}
          onChange={(v) => update({ memo: v })}
          help="Optional. Folded into the description on import."
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onBack}
          className="rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
        >
          ← Back to preview
        </button>
        <button
          type="button"
          disabled={!props.mappingComplete}
          onClick={props.onNext}
          className="rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          Validate rows →
        </button>
      </div>
    </section>
  );
}

function FieldSelect(props: {
  label: string;
  required?: boolean;
  headers: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  help?: string;
}) {
  return (
    <label className="block rounded border border-surface-border bg-surface-page p-3">
      <span className="text-[12px] font-medium text-text-primary">
        {props.label}
        {props.required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <select
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value || null)}
        className="mt-1 w-full rounded border border-surface-border-strong bg-surface-panel px-2 py-1.5 text-[13px] text-text-primary"
      >
        <option value="">
          — {props.required ? "select a column —" : "(not used) —"}
        </option>
        {props.headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      {props.help && <p className="mt-1 text-[11px] text-text-subtle">{props.help}</p>}
    </label>
  );
}

// ── Validate step ────────────────────────────────────────────────────────

function ValidateStep(props: {
  normalization: NormalizationSummary;
  onBack: () => void;
  onImport: () => void;
  submitting: boolean;
  importError: unknown;
}) {
  const { rows, totalRows, validRows, invalidRows, blankRowsSkipped } = props.normalization;
  return (
    <section className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total rows" value={totalRows} />
        <StatTile label="Valid rows" value={validRows} tone="good" />
        <StatTile label="Need attention" value={invalidRows} tone={invalidRows > 0 ? "warn" : "neutral"} />
        <StatTile label="Blank rows skipped" value={blankRowsSkipped} />
      </div>

      {invalidRows > 0 && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900"
        >
          <p className="font-medium">
            {invalidRows} row{invalidRows === 1 ? "" : "s"} need attention before import.
          </p>
          <p className="mt-1 text-[12px]">
            Only the {validRows} valid rows will be sent. Go back to fix the mapping if these
            errors look wrong, or import the valid ones now and re-upload the rest later.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-surface-border bg-surface-page">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-surface-border bg-surface-panel">
            <tr>
              <th className="px-3 py-2 font-medium text-text-primary">Row</th>
              <th className="px-3 py-2 font-medium text-text-primary">Date</th>
              <th className="px-3 py-2 font-medium text-text-primary">Description</th>
              <th className="px-3 py-2 text-right font-medium text-text-primary">Amount</th>
              <th className="px-3 py-2 font-medium text-text-primary">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((r) => (
              <tr
                key={r.sourceRow}
                className={
                  r.status === "valid"
                    ? "border-b border-surface-border last:border-0"
                    : "border-b border-amber-200/60 bg-amber-50/60 last:border-0"
                }
              >
                <td className="mono px-3 py-1.5 text-text-subtle">{r.sourceRow}</td>
                <td className="mono px-3 py-1.5 text-text-secondary">{r.date || "—"}</td>
                <td className="px-3 py-1.5 text-text-primary">
                  {r.description || <span className="text-text-subtle">—</span>}
                  {r.errors.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-amber-900">
                      {r.errors.join(" · ")}
                    </p>
                  )}
                </td>
                <td className="mono px-3 py-1.5 text-right text-text-primary">
                  {r.amount !== null ? formatAmount(Math.round(r.amount * 100), "USD") : "—"}
                </td>
                <td className="px-3 py-1.5">
                  {r.status === "valid" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
                      <Check className="h-3 w-3" aria-hidden="true" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800">
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Needs attention
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length > 50 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center text-[11px] text-text-subtle">
                  Showing the first 50 rows; all {rows.length} rows will be evaluated.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        role="alert"
        className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900"
      >
        Reminder: this public demo has no authentication or tenant isolation.
        Do not import real financial data. If you uploaded a real bank
        export by accident, go back and choose a different file.
      </div>

      {props.importError !== null && (
        <ErrorState
          error={props.importError}
          message={
            props.importError instanceof ApiError
              ? props.importError.userMessage
              : props.importError instanceof Error
                ? props.importError.message
                : String(props.importError)
          }
        />
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.submitting}
          className="rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken disabled:opacity-50"
        >
          ← Back to mapping
        </button>
        <button
          type="button"
          onClick={props.onImport}
          disabled={props.submitting || validRows === 0}
          className="rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {props.submitting ? "Importing…" : `Import ${validRows} valid row${validRows === 1 ? "" : "s"}`}
        </button>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "neutral";
}) {
  const valueClass =
    tone === "good"
      ? "text-brand-700"
      : tone === "warn"
        ? "text-amber-800"
        : "text-text-primary";
  return (
    <div className="rounded border border-surface-border bg-surface-page p-3">
      <p className="field-label">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}

// ── Done step ────────────────────────────────────────────────────────────

function DoneStep(props: { result: CsvImportSummary; fileName: string; onReset: () => void }) {
  const errorCount = props.result.errors?.length ?? 0;
  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-lg border-2 border-brand-600 bg-brand-100 p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-1 h-6 w-6 text-brand-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] font-medium text-text-primary">
              Imported {props.result.created} row{props.result.created === 1 ? "" : "s"}.
            </h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              {props.fileName} · received {props.result.received_rows} row
              {props.result.received_rows === 1 ? "" : "s"} · {errorCount} backend error
              {errorCount === 1 ? "" : "s"}.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/cleanup"
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Start monthly cleanup →
              </Link>
              <Link
                href="/transactions"
                className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
              >
                Review transactions
              </Link>
              <button
                type="button"
                onClick={props.onReset}
                className="inline-flex items-center text-[12px] font-medium text-text-secondary hover:text-text-primary"
              >
                Import another file
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorCount > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900">
          <p className="font-medium">Backend reported {errorCount} row error{errorCount === 1 ? "" : "s"}:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px]">
            {props.result.errors.slice(0, 10).map((e, i) => (
              <li key={i}>
                Row {e.row}: {e.message ?? e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
