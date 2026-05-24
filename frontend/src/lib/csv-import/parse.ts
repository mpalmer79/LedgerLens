/**
 * Client-side CSV parsing for the import wizard.
 *
 * Backed by Papa Parse. The wizard caps the file at 1 MB before parsing so
 * a runaway upload can't freeze the browser; the backend's 5 MB cap is the
 * downstream backstop.
 */

import Papa, { type ParseError, type ParseResult } from "papaparse";

export const CSV_MAX_BYTES = 1_000_000; // 1 MB
export const CSV_MAX_ROWS = 5_000; // matches the backend cap

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
};

export class CsvParseError extends Error {
  readonly userMessage: string;

  constructor(message: string, userMessage: string) {
    super(message);
    this.name = "CsvParseError";
    this.userMessage = userMessage;
  }
}

function looksLikeCsv(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  // Browsers report CSV as `text/csv`, but Excel exports may use
  // `application/vnd.ms-excel` for .csv too. Accept by extension as the
  // safety net.
  if (name.endsWith(".csv")) return true;
  if (type === "text/csv" || type === "application/csv") return true;
  return false;
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  if (!looksLikeCsv(file)) {
    throw new CsvParseError(
      `unsupported file type: ${file.type || file.name}`,
      "That file doesn't look like a CSV. Please choose a .csv file or download the sample below.",
    );
  }
  if (file.size > CSV_MAX_BYTES) {
    const mb = (file.size / 1_000_000).toFixed(1);
    throw new CsvParseError(
      `file too large: ${file.size} bytes`,
      `That file is ${mb} MB. The public demo accepts CSV files up to 1 MB. Please use a smaller file or the sample CSV below.`,
    );
  }
  const text = await file.text();
  return parseCsvText(text);
}

export function parseCsvText(text: string): ParsedCsv {
  const result: ParseResult<Record<string, string>> = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h: string) => h.trim(),
  });

  const warnings: string[] = [];
  if (result.errors && result.errors.length > 0) {
    for (const err of result.errors as ParseError[]) {
      // Friendly warnings instead of crash: row-level parse errors are
      // surfaced; row counts continue.
      if (typeof err.row === "number") {
        warnings.push(`Row ${err.row + 1}: ${err.message}`);
      } else {
        warnings.push(err.message);
      }
    }
  }

  const headers = (result.meta?.fields ?? []).map((h) => h.trim()).filter((h) => h.length > 0);
  if (headers.length === 0) {
    throw new CsvParseError(
      "no headers detected",
      "We couldn't find any column headers in your CSV. Make sure the first row contains column names.",
    );
  }

  // Detect duplicate headers — Papa Parse silently keeps the last one,
  // which can hide bugs. Warn instead.
  const seen = new Set<string>();
  for (const h of headers) {
    const key = h.toLowerCase();
    if (seen.has(key)) warnings.push(`Duplicate header detected: "${h}".`);
    seen.add(key);
  }

  const rows = (result.data ?? []).filter((r) => {
    if (!r || typeof r !== "object") return false;
    // Filter out rows where every value is blank (Papa sometimes leaks these
    // even with skipEmptyLines on).
    return Object.values(r).some((v) => (v ?? "").toString().trim().length > 0);
  });

  if (rows.length > CSV_MAX_ROWS) {
    throw new CsvParseError(
      `too many rows: ${rows.length}`,
      `That CSV has ${rows.length.toLocaleString()} rows. The public demo accepts up to ${CSV_MAX_ROWS.toLocaleString()} rows per import.`,
    );
  }

  return { headers, rows, warnings };
}
