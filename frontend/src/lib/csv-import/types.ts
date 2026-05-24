/** Normalized field the LedgerLens import endpoint understands. */
export type NormalizedField = "date" | "description" | "amount" | "merchant" | "memo" | "reference" | "account";

/** Amount column mode — single signed column or split debit/credit. */
export type AmountMode = "signed" | "debit_credit";

/** Mapping the wizard builds from the user's CSV. */
export type ColumnMapping = {
  date: string | null;
  description: string | null;
  /** Used when amountMode === "signed". */
  amount: string | null;
  /** Used when amountMode === "debit_credit". */
  debit: string | null;
  credit: string | null;
  merchant: string | null;
  memo: string | null;
  reference: string | null;
  account: string | null;
};

/** Per-row outcome from the normalization pass. */
export type NormalizedRow = {
  sourceRow: number;
  rawValues: Record<string, string>;
  /** ISO date string (YYYY-MM-DD) when valid; "" when not. */
  date: string;
  description: string;
  /** Signed amount in dollars; negative = outflow, positive = inflow. */
  amount: number | null;
  merchant: string;
  memo: string;
  reference: string;
  account: string;
  status: "valid" | "invalid";
  errors: string[];
};

/** Summary returned by `normalizeRows`. */
export type NormalizationSummary = {
  rows: NormalizedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  blankRowsSkipped: number;
};

/** Header-detection result for a single normalized field. */
export type FieldDetection = {
  field: NormalizedField | "debit" | "credit";
  bestMatch: string | null;
  candidates: string[];
};
