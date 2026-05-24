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
  zero_cost?: number;
  total_cost_usd: number;
  results: CategorizationResult[];
};

export type Rule = {
  id: string;
  name: string;
  active: boolean;
  priority: number;
  match_type:
    | "exact_merchant"
    | "merchant_contains"
    | "description_contains"
    | "keyword_any"
    | "keyword_all";
  merchant_patterns: string[];
  description_patterns: string[];
  category_code: string;
  category_name: string;
  confidence: number;
  explanation: string;
  // Per-business rule intent mapping — null when the rule has no intent.
  intent: string | null;
  mapped_category_code: string | null;
  mapped_category_name: string | null;
};

export type BusinessRuleMapEntry = {
  intent: string;
  category_code: string;
  category_name: string | null;
};

export type BusinessRuleMap = {
  business_id: string;
  business_name: string | null;
  entries: BusinessRuleMapEntry[];
  block_fallback_intents?: string[];
  unmapped_intents?: string[];
};

export type RuleList = {
  total: number;
  items: Rule[];
  mapping: BusinessRuleMap | null;
};

export type RuleVerdict = "apply" | "conflict" | "none";

export type RuleMatch = {
  verdict: RuleVerdict;
  reason: string;
  merchant_text: string;
  description_text: string;
  rule: Rule | null;
  candidates: Rule[];
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
  model_provider: string | null;
};

export type LedgerTrust = {
  finalized_count: number;
  verified_count: number;
  unverified_finalized_count: number;
  review_required_count: number;
  deterministic_count: number;
  human_reviewed_count: number;
  verification_rate: number;
};

export type Ledger = {
  total: number;
  unresolved: number;
  rows: LedgerRow[];
  trust: LedgerTrust;
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
    anthropic: {
      configured: boolean;
      model_primary: string;
      required_for_current_mode?: boolean;
    };
    categorizer?: {
      mode: "demo_stub" | "anthropic";
      demo_mode: boolean;
    };
  };
};

export type CorrectionMemory = {
  id: string;
  merchant_key: string;
  description_key: string;
  selected_category_code: string;
  source_transaction_id: string;
  source_review_decision_id: string;
  match_count: number;
  last_used_at: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CorrectionMemoryList = {
  total: number;
  items: CorrectionMemory[];
};

export type CorrectionMemoryPatch = {
  active?: boolean;
  selected_category_code?: string;
  notes?: string;
};

export type MemoryMatchVerdict = "apply" | "conflict" | "none";

export type MemoryMatch = {
  verdict: MemoryMatchVerdict;
  reason: string;
  merchant_key: string;
  description_key: string;
  record: CorrectionMemory | null;
  candidates: CorrectionMemory[];
};
