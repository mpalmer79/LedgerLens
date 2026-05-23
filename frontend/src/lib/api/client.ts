/**
 * Typed client for the LedgerLens backend.
 *
 * One `apiFetch<T>()` helper handles JSON envelope, base URL, and error
 * parsing. All public functions wrap it. Pages should never call `fetch`
 * directly.
 */

import type {
  AuditEvent,
  CategorizationResult,
  CategorizeBatchOut,
  Category,
  CorrectionMemory,
  CorrectionMemoryList,
  CorrectionMemoryPatch,
  CsvImportSummary,
  HealthResponse,
  Ledger,
  MemoryMatch,
  ReadyResponse,
  ReviewDecision,
  ReviewQueue,
  RuleList,
  RuleMatch,
  Transaction,
  TransactionBatchOut,
  TransactionCreate,
  TransactionList,
} from "./types";

const DEFAULT_BASE = "http://localhost:8000";

export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv && fromEnv !== "unset" && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  return DEFAULT_BASE;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new ApiError(
      `Network error: could not reach ${url}. Is the backend running?`,
      0,
      "network_error",
    );
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Non-JSON body — keep as-is for the error path.
    }
  }

  if (!res.ok) {
    // FastAPI HTTPException returns `{ detail: <our error object | string> }`.
    const detail =
      (parsed as { detail?: unknown } | undefined)?.detail ?? parsed ?? text;
    if (detail && typeof detail === "object") {
      const obj = detail as Record<string, unknown>;
      const message =
        typeof obj.message === "string"
          ? obj.message
          : typeof obj.error === "string"
            ? obj.error
            : res.statusText || `Request failed (${res.status})`;
      const code = typeof obj.error === "string" ? obj.error : undefined;
      throw new ApiError(message, res.status, code, obj);
    }
    throw new ApiError(
      typeof detail === "string" ? detail : res.statusText || `Request failed (${res.status})`,
      res.status,
    );
  }

  return parsed as T;
}

// ── Health / readiness ─────────────────────────────────────────────────────

export const getHealth = () => apiFetch<HealthResponse>("/health");
export const getReady = () => apiFetch<ReadyResponse>("/ready");

// ── Categories ─────────────────────────────────────────────────────────────

export const listCategories = () => apiFetch<Category[]>("/categories");

// ── Transactions ───────────────────────────────────────────────────────────

export const listTransactions = (params: { limit?: number; offset?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<TransactionList>(`/transactions${qs ? `?${qs}` : ""}`);
};

export const getTransaction = (id: string) => apiFetch<Transaction>(`/transactions/${id}`);

export const createTransaction = (body: TransactionCreate) =>
  apiFetch<Transaction>("/transactions", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createTransactionBatch = (body: { transactions: TransactionCreate[] }) =>
  apiFetch<TransactionBatchOut>("/transactions/batch", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const importCsv = (file: File | Blob, filename = "import.csv") => {
  const form = new FormData();
  form.append("file", file, filename);
  return apiFetch<CsvImportSummary>("/transactions/import", {
    method: "POST",
    body: form,
  });
};

// ── Categorize ─────────────────────────────────────────────────────────────

export const categorize = (transactionId: string) =>
  apiFetch<CategorizationResult>("/categorize", {
    method: "POST",
    body: JSON.stringify({ transaction_id: transactionId }),
  });

export const categorizeBatch = (transactionIds: string[]) =>
  apiFetch<CategorizeBatchOut>("/categorize/batch", {
    method: "POST",
    body: JSON.stringify({ transaction_ids: transactionIds }),
  });

export const getCategorizationResult = (id: string) =>
  apiFetch<CategorizationResult>(`/categorization-results/${id}`);

export const listCategorizationResults = (transactionId: string) =>
  apiFetch<CategorizationResult[]>(
    `/transactions/${transactionId}/categorization-results`,
  );

// ── Review queue ───────────────────────────────────────────────────────────

export const getReviewQueue = (params: { limit?: number; offset?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<ReviewQueue>(`/review-queue${qs ? `?${qs}` : ""}`);
};

export const approveReview = (transactionId: string, note?: string) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewer_note: note ?? null }),
  });

export const correctReview = (
  transactionId: string,
  selectedCategoryCode: string,
  note?: string,
) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/correct`, {
    method: "POST",
    body: JSON.stringify({
      selected_category_code: selectedCategoryCode,
      reviewer_note: note ?? null,
    }),
  });

export const markUncategorizable = (transactionId: string, note?: string) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/uncategorizable`, {
    method: "POST",
    body: JSON.stringify({ reviewer_note: note ?? null }),
  });

// ── Ledger ─────────────────────────────────────────────────────────────────

export const getLedger = () => apiFetch<Ledger>("/ledger");

export const getLedgerExportUrl = () => `${getApiBaseUrl()}/ledger/export.csv`;

// ── Audit ──────────────────────────────────────────────────────────────────

export const listAuditEvents = (params: {
  entity_type?: string;
  entity_id?: string;
  limit?: number;
} = {}) => {
  const q = new URLSearchParams();
  if (params.entity_type) q.set("entity_type", params.entity_type);
  if (params.entity_id) q.set("entity_id", params.entity_id);
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  const qs = q.toString();
  return apiFetch<AuditEvent[]>(`/audit/events${qs ? `?${qs}` : ""}`);
};

// ── Correction memory ──────────────────────────────────────────────────────

export const listCorrections = (params: {
  active?: boolean;
  category_code?: string;
  q?: string;
  limit?: number;
  offset?: number;
} = {}) => {
  const q = new URLSearchParams();
  if (params.active !== undefined) q.set("active", String(params.active));
  if (params.category_code) q.set("category_code", params.category_code);
  if (params.q) q.set("q", params.q);
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.offset !== undefined) q.set("offset", String(params.offset));
  const qs = q.toString();
  return apiFetch<CorrectionMemoryList>(`/corrections${qs ? `?${qs}` : ""}`);
};

export const getCorrection = (id: string) => apiFetch<CorrectionMemory>(`/corrections/${id}`);

export const patchCorrection = (id: string, patch: CorrectionMemoryPatch) =>
  apiFetch<CorrectionMemory>(`/corrections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deactivateCorrection = (id: string) =>
  apiFetch<CorrectionMemory>(`/corrections/${id}`, { method: "DELETE" });

export const getMemoryMatches = (transactionId: string) =>
  apiFetch<MemoryMatch>(`/transactions/${transactionId}/memory-matches`);

// ── Deterministic rules ────────────────────────────────────────────────────

export const listRules = () => apiFetch<RuleList>("/rules");

export const getRuleMatches = (transactionId: string) =>
  apiFetch<RuleMatch>(`/transactions/${transactionId}/rule-matches`);

// ── Guided demo ───────────────────────────────────────────────────────────

export type DemoStatus = {
  demo_mode: boolean;
  categorizer_mode: string;
  transaction_count: number;
  demo_transaction_count: number;
  categorization_result_count: number;
  review_decision_count: number;
  correction_memory_count: number;
};

export type DemoSampleTransaction = {
  transaction_date: string;
  description: string;
  merchant: string | null;
  amount_cents: number;
};

export type DemoSeedResult = {
  count: number;
  created: Transaction[];
};

export type DemoResetResult = {
  deleted_transactions: number;
  deleted_results?: number;
  deleted_decisions?: number;
  deleted_memories?: number;
};

export const getDemoStatus = () => apiFetch<DemoStatus>("/demo/status");

export const getDemoSampleTransactions = () =>
  apiFetch<DemoSampleTransaction[]>("/demo/sample-transactions");

export const seedDemo = () =>
  apiFetch<DemoSeedResult>("/demo/seed", { method: "POST" });

export const resetDemo = () =>
  apiFetch<DemoResetResult>("/demo/reset", { method: "POST" });
