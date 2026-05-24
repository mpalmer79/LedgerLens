/**
 * Normalize parsed CSV rows against the user's column mapping.
 *
 * Output is shaped for the existing `/transactions/import` endpoint:
 *   - `date` → ISO YYYY-MM-DD
 *   - `description` → non-empty trimmed string
 *   - `amount` → signed dollars; negative = expense, positive = revenue
 *
 * Conventions match the backend's existing CSV parser:
 *   - Parentheses around numbers mean negative ((150.00) → -150.00).
 *   - Currency symbols + thousands commas are stripped.
 *   - Debit-mode column values become negative; credit-mode column values
 *     become positive. Backend convention.
 */

import type { AmountMode, ColumnMapping, NormalizationSummary, NormalizedRow } from "./types";

const DATE_FORMATS: ((s: string) => string | null)[] = [
  // YYYY-MM-DD
  (s) => {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? `${m[1]}-${pad2(m[2])}-${pad2(m[3])}` : null;
  },
  // MM/DD/YYYY
  (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${pad2(m[1])}-${pad2(m[2])}` : null;
  },
  // MM/DD/YY → 20YY (matches backend %m/%d/%y behavior)
  (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    return m ? `20${m[3]}-${pad2(m[1])}-${pad2(m[2])}` : null;
  },
  // DD/MM/YYYY (ambiguous with MM/DD/YYYY; matches backend %d/%m/%Y after %m/%d/%Y so a 31/12/2026 date works)
  (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    if (dd > 12 && mm <= 12) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
    return null;
  },
];

function pad2(s: string): string {
  return s.padStart(2, "0");
}

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  for (const fmt of DATE_FORMATS) {
    const out = fmt(s);
    if (out) {
      // Sanity check: month 1–12, day 1–31, year 1900–2100.
      const [y, mo, d] = out.split("-").map((n) => Number(n));
      if (mo < 1 || mo > 12) continue;
      if (d < 1 || d > 31) continue;
      if (y < 1900 || y > 2100) continue;
      return out;
    }
  }
  return null;
}

export function normalizeAmount(raw: string): number | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.toString().trim();
  if (!s) return null;
  // Parentheses → negative.
  let negate = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negate = true;
    s = s.slice(1, -1).trim();
  }
  // Strip currency symbols (anything that isn't digit, sign, dot, or comma).
  s = s.replace(/[^0-9.,-]/g, "");
  // Drop thousands separators. Assumes . is decimal (US locale, matches
  // the synthetic eval data + Granite State sample).
  s = s.replace(/,/g, "");
  if (!s) return null;
  // Allow a single leading minus sign.
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negate ? -Math.abs(n) : n;
}

function getCell(row: Record<string, string>, column: string | null): string {
  if (!column) return "";
  const v = row[column];
  return v === undefined || v === null ? "" : v.toString().trim();
}

export function normalizeRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  amountMode: AmountMode,
): NormalizationSummary {
  const out: NormalizedRow[] = [];
  let blankRowsSkipped = 0;

  rows.forEach((rawRow, idx) => {
    const sourceRow = idx + 2; // +2: header is row 1, data starts at row 2 in the user's CSV
    const errors: string[] = [];

    // Treat all-blank rows as "skipped" silently.
    const anyCell = Object.values(rawRow).some((v) => (v ?? "").toString().trim().length > 0);
    if (!anyCell) {
      blankRowsSkipped += 1;
      return;
    }

    const dateRaw = getCell(rawRow, mapping.date);
    const date = normalizeDate(dateRaw);
    if (!mapping.date) {
      errors.push("Date column not mapped.");
    } else if (!dateRaw) {
      errors.push("Date is blank.");
    } else if (!date) {
      errors.push(
        `Date "${dateRaw}" doesn't look like YYYY-MM-DD, MM/DD/YYYY, MM/DD/YY, or DD/MM/YYYY.`,
      );
    }

    const description = getCell(rawRow, mapping.description);
    if (!mapping.description) {
      errors.push("Description column not mapped.");
    } else if (!description) {
      errors.push("Description is blank.");
    }

    let amount: number | null = null;
    if (amountMode === "signed") {
      const amountRaw = getCell(rawRow, mapping.amount);
      if (!mapping.amount) {
        errors.push("Amount column not mapped.");
      } else if (!amountRaw) {
        errors.push("Amount is blank.");
      } else {
        amount = normalizeAmount(amountRaw);
        if (amount === null) {
          errors.push(`Amount "${amountRaw}" doesn't look like a number.`);
        }
      }
    } else {
      // debit_credit
      if (!mapping.debit) errors.push("Debit column not mapped.");
      if (!mapping.credit) errors.push("Credit column not mapped.");
      if (mapping.debit && mapping.credit) {
        const debitRaw = getCell(rawRow, mapping.debit);
        const creditRaw = getCell(rawRow, mapping.credit);
        const debit = debitRaw ? normalizeAmount(debitRaw) : null;
        const credit = creditRaw ? normalizeAmount(creditRaw) : null;

        if (debit !== null && credit !== null) {
          errors.push(
            "Both debit and credit are populated on this row — pick one or split the row before importing.",
          );
        } else if (debit !== null) {
          // Debit = outflow → negative. Take absolute value first so an
          // accidentally-already-negative debit column doesn't flip back.
          amount = -Math.abs(debit);
        } else if (credit !== null) {
          amount = Math.abs(credit);
        } else if (debitRaw || creditRaw) {
          errors.push(
            `Debit/credit values aren't numbers: debit="${debitRaw}", credit="${creditRaw}".`,
          );
        } else {
          errors.push("Both debit and credit are blank on this row.");
        }
      }
    }

    out.push({
      sourceRow,
      rawValues: rawRow,
      date: date ?? "",
      description,
      amount,
      merchant: getCell(rawRow, mapping.merchant),
      memo: getCell(rawRow, mapping.memo),
      reference: getCell(rawRow, mapping.reference),
      account: getCell(rawRow, mapping.account),
      status: errors.length === 0 ? "valid" : "invalid",
      errors,
    });
  });

  const validRows = out.filter((r) => r.status === "valid").length;
  return {
    rows: out,
    totalRows: rows.length,
    validRows,
    invalidRows: out.length - validRows,
    blankRowsSkipped,
  };
}

/** Build a normalized CSV blob in the exact column shape the backend's
 *  existing /transactions/import endpoint expects. Only valid rows are
 *  included. */
export function buildNormalizedCsv(rows: NormalizedRow[]): Blob {
  const header = "transaction_date,description,amount,merchant,currency,source";
  const lines = [header];
  for (const r of rows) {
    if (r.status !== "valid") continue;
    const desc = csvEscape(r.description);
    const merchant = csvEscape(r.merchant);
    const memo = r.memo ? ` (${r.memo.trim()})` : "";
    // Fold memo into description if present so it doesn't get dropped.
    const descWithMemo = memo ? csvEscape(`${r.description}${memo}`) : desc;
    const amount = (r.amount ?? 0).toFixed(2);
    lines.push(`${r.date},${descWithMemo},${amount},${merchant},USD,wizard`);
  }
  return new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
