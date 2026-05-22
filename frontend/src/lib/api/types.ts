// Mirror of backend/src/ledgerlens/api/schemas.py. Update both when fields change.

export type Category = {
  code: string;
  name: string;
  description: string;
  type: string;
  active: boolean;
};

export type Transaction = {
  id: string;
  transaction_date: string;
  description: string;
  raw_description: string;
  normalized_description: string;
  merchant: string | null;
  amount_cents: number;
  currency: string;
  source: string;
  created_at: string;
  updated_at: string;
};

export type TransactionList = {
  total: number;
  items: Transaction[];
};

export type TransactionBatchIn = {
  transactions: TransactionCreate[];
};

export type TransactionCreate = {
  transaction_date: string;
  description: string;
  amount_cents: number;
  currency?: string;
  merchant?: string | null;
  source?: string;
};

export type TransactionBatchOut = {
  created: Transaction[];
  errors: Array<{ index: number; error: string; message: string }>;
};

export type CsvImportSummary = {
  received_rows: number;
  created: number;
  errors: Array<{ row: number; error: string; message?: string }>;
  transactions: Transaction[];
};

export type CategorizationStatus =
  | "auto_approved"
  | "needs_review"
  | "uncategorizable"
  | "corrected"
  | "rejected"
  | "failed";

export type CategorizationResult = {
  id: string;
  transaction_id: string;
  predicted_category_code: string;
  predicted_category_name: string;
  confidence: number;
  explanation: string;
  alternative_category_code: string | null;
  model_provider: string;
  model_name: string | null;
  latency_ms: number;
  estimated_cost_usd: number;
  status: CategorizationStatus;
  created_at: string;
};

export type CategorizeBatchOut = {
  total: number;
  auto_approved: number;
  needs_review: number;
  uncategorizable: number;
  failed: number;
  total_cost_usd: number;
  results: CategorizationResult[];
};

export type ReviewQueueItem = {
  transaction: Transaction;
  latest_result: CategorizationResult;
};

export type ReviewQueue = {
  total: number;
  items: ReviewQueueItem[];
};

export type ReviewDecision = {
  id: string;
  transaction_id: string;
  categorization_result_id: string;
  reviewer_action: "approve" | "correct" | "mark_uncategorizable";
  selected_category_code: string | null;
  reviewer_note: string | null;
  created_at: string;
};

export type LedgerRow = {
  transaction_id: string;
  transaction_date: string;
  description: string;
  amount_cents: number;
  currency: string;
  category_code: string | null;
  category_name: string | null;
  categorization_status: string;
  confidence: number | null;
  reviewed: boolean;
  reviewer_note: string | null;
  source: string;
};

export type Ledger = {
  total: number;
  unresolved: number;
  rows: LedgerRow[];
};

export type AuditEvent = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type HealthResponse = {
  status: string;
  service: string;
};

export type ReadyResponse = {
  ready: boolean;
  version: string;
  checks: {
    database: { ok: boolean; error?: string };
    anthropic: { configured: boolean; model_primary: string };
  };
};
