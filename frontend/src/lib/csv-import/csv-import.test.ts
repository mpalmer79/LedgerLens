/**
 * Contract tests for the CSV import wizard's parsing, detection, and
 * normalization layers. These run client-side; they don't hit the backend.
 */

import { describe, expect, it } from "vitest";

import {
  detectAmount,
  detectCredit,
  detectDate,
  detectDebit,
  detectDescription,
  detectMerchant,
  suggestAmountMode,
} from "./detect";
import { CSV_MAX_BYTES, CsvParseError, parseCsvText } from "./parse";
import { buildNormalizedCsv, normalizeAmount, normalizeDate, normalizeRows } from "./normalize";
import type { ColumnMapping } from "./types";

const blankMapping = (): ColumnMapping => ({
  date: null,
  description: null,
  amount: null,
  debit: null,
  credit: null,
  merchant: null,
  memo: null,
  reference: null,
  account: null,
});

// ── Parsing ──────────────────────────────────────────────────────────────

describe("parseCsvText", () => {
  it("parses CSV with quoted descriptions containing commas", () => {
    const text = `date,description,amount\n2026-03-01,"NAPA AUTO PARTS, INV 88421",-342.50`;
    const out = parseCsvText(text);
    expect(out.headers).toEqual(["date", "description", "amount"]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].description).toBe("NAPA AUTO PARTS, INV 88421");
  });

  it("rejects empty / header-less CSV with a friendly error", () => {
    expect(() => parseCsvText("")).toThrow(CsvParseError);
  });

  it("dedupes / renames duplicate headers without crashing", () => {
    const text = `date,description,amount,amount\n2026-03-01,X,1,2`;
    const out = parseCsvText(text);
    // Papa Parse renames duplicate headers to keep the data accessible. The
    // important contract is that the parse doesn't crash and rows make it
    // through.
    expect(out.headers.length).toBeGreaterThanOrEqual(3);
    expect(out.rows).toHaveLength(1);
  });

  it("skips fully blank rows", () => {
    const text = `date,description,amount\n2026-03-01,X,1\n,,\n2026-03-02,Y,2`;
    const out = parseCsvText(text);
    expect(out.rows).toHaveLength(2);
  });

  it("exposes CSV_MAX_BYTES as a 1 MB cap", () => {
    expect(CSV_MAX_BYTES).toBe(1_000_000);
  });
});

// ── Header detection ─────────────────────────────────────────────────────

describe("header detection", () => {
  it("detects date column from common header names", () => {
    expect(detectDate(["Posted Date", "Description", "Amount"])).toBe("Posted Date");
    expect(detectDate(["transaction_date", "desc", "amt"])).toBe("transaction_date");
    expect(detectDate(["TRANS DATE", "details", "value"])).toBe("TRANS DATE");
  });

  it("detects description column from common header names", () => {
    expect(detectDescription(["Posted Date", "Description", "Amount"])).toBe("Description");
    expect(detectDescription(["date", "details", "amount"])).toBe("details");
    expect(detectDescription(["date", "Payee", "amount"])).toBe("Payee");
  });

  it("detects signed amount column when no debit/credit pair exists", () => {
    expect(detectAmount(["Date", "Description", "Amount"])).toBe("Amount");
    // When a debit AND credit column exist and no explicit "amount" column,
    // detectAmount returns null so the user picks the mode.
    expect(detectAmount(["Date", "Description", "Debit", "Credit"])).toBeNull();
  });

  it("detects debit and credit columns separately", () => {
    expect(detectDebit(["Date", "Description", "Debit", "Credit"])).toBe("Debit");
    expect(detectCredit(["Date", "Description", "Debit", "Credit"])).toBe("Credit");
    expect(detectDebit(["Posted Date", "Description", "Withdrawal", "Deposit"])).toBe(
      "Withdrawal",
    );
    expect(detectCredit(["Posted Date", "Description", "Withdrawal", "Deposit"])).toBe(
      "Deposit",
    );
  });

  it("does not confuse merchant with description when both are present", () => {
    // Description column should win on "payee"; merchant detector skips it.
    const headers = ["Posted Date", "Payee", "Merchant", "Amount"];
    expect(detectDescription(headers)).toBe("Payee");
    expect(detectMerchant(headers)).toBe("Merchant");
  });

  it("suggests debit_credit mode when only debit+credit columns exist", () => {
    expect(
      suggestAmountMode(["Date", "Description", "Debit", "Credit"]),
    ).toBe("debit_credit");
    expect(suggestAmountMode(["Date", "Description", "Amount"])).toBe("signed");
  });
});

// ── Normalize date + amount ──────────────────────────────────────────────

describe("normalizeDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(normalizeDate("2026-03-14")).toBe("2026-03-14");
  });

  it("accepts MM/DD/YYYY", () => {
    expect(normalizeDate("3/14/2026")).toBe("2026-03-14");
    expect(normalizeDate("03/14/2026")).toBe("2026-03-14");
  });

  it("accepts MM/DD/YY and expands to 20YY", () => {
    expect(normalizeDate("3/14/26")).toBe("2026-03-14");
  });

  it("accepts DD/MM/YYYY when day > 12 (unambiguous)", () => {
    expect(normalizeDate("31/12/2026")).toBe("2026-12-31");
  });

  it("returns null for unparseable dates", () => {
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("13/13/2026")).toBeNull();
  });
});

describe("normalizeAmount", () => {
  it("preserves signed positive and negative amounts", () => {
    expect(normalizeAmount("150.00")).toBe(150);
    expect(normalizeAmount("-150.00")).toBe(-150);
    expect(normalizeAmount("0")).toBe(0);
  });

  it("interprets parentheses as negative", () => {
    expect(normalizeAmount("(150.00)")).toBe(-150);
    expect(normalizeAmount("(1,234.56)")).toBe(-1234.56);
  });

  it("strips currency symbols and thousands commas", () => {
    expect(normalizeAmount("$1,234.56")).toBe(1234.56);
    expect(normalizeAmount("USD 999.99")).toBe(999.99);
    expect(normalizeAmount("-$100")).toBe(-100);
  });

  it("returns null for blank or non-numeric input", () => {
    expect(normalizeAmount("")).toBeNull();
    expect(normalizeAmount("abc")).toBeNull();
  });
});

// ── normalizeRows ────────────────────────────────────────────────────────

describe("normalizeRows — signed amount mode", () => {
  const mapping = (): ColumnMapping => ({
    ...blankMapping(),
    date: "Date",
    description: "Description",
    amount: "Amount",
    merchant: "Merchant",
  });

  it("normalizes a valid signed-amount row", () => {
    const rows = [{ Date: "2026-03-01", Description: "NAPA", Amount: "-342.50", Merchant: "NAPA" }];
    const out = normalizeRows(rows, mapping(), "signed");
    expect(out.validRows).toBe(1);
    expect(out.invalidRows).toBe(0);
    expect(out.rows[0]).toMatchObject({
      sourceRow: 2, // header is row 1
      date: "2026-03-01",
      description: "NAPA",
      amount: -342.5,
      merchant: "NAPA",
      status: "valid",
    });
  });

  it("flags missing date", () => {
    const rows = [{ Date: "", Description: "X", Amount: "1", Merchant: "" }];
    const out = normalizeRows(rows, mapping(), "signed");
    expect(out.invalidRows).toBe(1);
    expect(out.rows[0].errors.join(" ")).toContain("Date is blank");
  });

  it("flags missing description", () => {
    const rows = [{ Date: "2026-03-01", Description: "", Amount: "1", Merchant: "" }];
    const out = normalizeRows(rows, mapping(), "signed");
    expect(out.rows[0].errors.some((e) => e.includes("Description"))).toBe(true);
  });

  it("flags invalid amount", () => {
    const rows = [{ Date: "2026-03-01", Description: "X", Amount: "abc", Merchant: "" }];
    const out = normalizeRows(rows, mapping(), "signed");
    expect(out.rows[0].errors.some((e) => e.includes("Amount"))).toBe(true);
  });

  it("preserves source row numbers for debugging", () => {
    const rows = [
      { Date: "2026-03-01", Description: "X", Amount: "1", Merchant: "" },
      { Date: "2026-03-02", Description: "Y", Amount: "2", Merchant: "" },
    ];
    const out = normalizeRows(rows, mapping(), "signed");
    expect(out.rows[0].sourceRow).toBe(2);
    expect(out.rows[1].sourceRow).toBe(3);
  });

  it("skips fully blank rows silently", () => {
    const rows = [
      { Date: "2026-03-01", Description: "X", Amount: "1", Merchant: "" },
      { Date: "", Description: "", Amount: "", Merchant: "" },
    ];
    const out = normalizeRows(rows, mapping(), "signed");
    expect(out.blankRowsSkipped).toBe(1);
    expect(out.totalRows).toBe(2);
    expect(out.rows).toHaveLength(1);
  });
});

describe("normalizeRows — debit/credit mode", () => {
  const mapping = (): ColumnMapping => ({
    ...blankMapping(),
    date: "Posted Date",
    description: "Description",
    debit: "Debit",
    credit: "Credit",
  });

  it("treats a populated debit as a negative amount (outflow)", () => {
    const rows = [{ "Posted Date": "2026-03-02", Description: "NAPA", Debit: "342.50", Credit: "" }];
    const out = normalizeRows(rows, mapping(), "debit_credit");
    expect(out.validRows).toBe(1);
    expect(out.rows[0].amount).toBe(-342.5);
  });

  it("treats a populated credit as a positive amount (inflow)", () => {
    const rows = [{ "Posted Date": "2026-03-04", Description: "Stripe", Debit: "", Credit: "4284.00" }];
    const out = normalizeRows(rows, mapping(), "debit_credit");
    expect(out.validRows).toBe(1);
    expect(out.rows[0].amount).toBe(4284);
  });

  it("flags rows with BOTH debit and credit populated", () => {
    const rows = [{ "Posted Date": "2026-03-04", Description: "X", Debit: "1", Credit: "1" }];
    const out = normalizeRows(rows, mapping(), "debit_credit");
    expect(out.invalidRows).toBe(1);
    expect(
      out.rows[0].errors.some((e) => e.toLowerCase().includes("both debit and credit")),
    ).toBe(true);
  });

  it("flags rows with NEITHER debit nor credit populated", () => {
    const rows = [{ "Posted Date": "2026-03-04", Description: "X", Debit: "", Credit: "" }];
    const out = normalizeRows(rows, mapping(), "debit_credit");
    expect(out.invalidRows).toBe(1);
    expect(out.rows[0].errors.some((e) => e.toLowerCase().includes("blank"))).toBe(true);
  });

  it("flips an accidentally-negative debit value back to a single negative", () => {
    // Some banks export debits as already-negative values; the wizard should
    // normalize to a single negative, not flip the sign back.
    const rows = [{ "Posted Date": "2026-03-02", Description: "NAPA", Debit: "-342.50", Credit: "" }];
    const out = normalizeRows(rows, mapping(), "debit_credit");
    expect(out.rows[0].amount).toBe(-342.5);
  });
});

// ── buildNormalizedCsv ───────────────────────────────────────────────────

describe("buildNormalizedCsv", () => {
  it("emits the exact header the existing /transactions/import endpoint expects", async () => {
    const blob = buildNormalizedCsv([
      {
        sourceRow: 2,
        rawValues: {},
        date: "2026-03-01",
        description: "NAPA AUTO PARTS",
        amount: -342.5,
        merchant: "NAPA",
        memo: "",
        reference: "",
        account: "",
        status: "valid",
        errors: [],
      },
    ]);
    const text = await blob.text();
    expect(text.split("\n")[0]).toBe(
      "transaction_date,description,amount,merchant,currency,source",
    );
    expect(text).toContain("2026-03-01,NAPA AUTO PARTS,-342.50,NAPA,USD,wizard");
  });

  it("escapes descriptions that contain commas or quotes", async () => {
    const blob = buildNormalizedCsv([
      {
        sourceRow: 2,
        rawValues: {},
        date: "2026-03-01",
        description: 'NAPA, "premium" parts',
        amount: -100,
        merchant: "",
        memo: "",
        reference: "",
        account: "",
        status: "valid",
        errors: [],
      },
    ]);
    const text = await blob.text();
    expect(text).toContain('"NAPA, ""premium"" parts"');
  });

  it("drops invalid rows from the emitted CSV", async () => {
    const blob = buildNormalizedCsv([
      {
        sourceRow: 2,
        rawValues: {},
        date: "2026-03-01",
        description: "VALID",
        amount: -10,
        merchant: "",
        memo: "",
        reference: "",
        account: "",
        status: "valid",
        errors: [],
      },
      {
        sourceRow: 3,
        rawValues: {},
        date: "",
        description: "INVALID",
        amount: null,
        merchant: "",
        memo: "",
        reference: "",
        account: "",
        status: "invalid",
        errors: ["bad"],
      },
    ]);
    const text = await blob.text();
    expect(text).toContain("VALID");
    expect(text).not.toContain("INVALID");
  });

  it("folds memo into description when present", async () => {
    const blob = buildNormalizedCsv([
      {
        sourceRow: 2,
        rawValues: {},
        date: "2026-03-01",
        description: "ACH TRANSFER",
        amount: -200,
        merchant: "",
        memo: "Ref 998",
        reference: "",
        account: "",
        status: "valid",
        errors: [],
      },
    ]);
    const text = await blob.text();
    expect(text).toContain("ACH TRANSFER (Ref 998)");
  });
});
