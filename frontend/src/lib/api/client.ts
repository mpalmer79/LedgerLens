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
  LedgerRow,
  LedgerTrust,
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
  /** Whether the failure is plausibly transient (network blip, 503, 504, timeout). */
  readonly retryable: boolean;
  /** Plain-English message safe to render to a small-business owner. */
  readonly userMessage: string;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, unknown>,
    opts?: { retryable?: boolean; userMessage?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = opts?.retryable ?? isRetryableStatus(status, code);
    this.userMessage = opts?.userMessage ?? userMessageFor(status, code, message);
  }
}

function isRetryableStatus(status: number, code: string | undefined): boolean {
  if (code === "network_error" || code === "timeout") return true;
  // 408 Request Timeout, 425 Too Early, 429 Too Many, 5xx server errors.
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function userMessageFor(status: number, code: string | undefined, fallback: string): string {
  if (code === "network_error") {
    return "LedgerLens could not reach the demo backend. Please try again in a moment.";
  }
  if (code === "timeout") {
    return "The demo backend is taking longer than expected to respond. Please try again.";
  }
  if (status === 503) {
    return "The demo backend is temporarily unavailable. Please try again in a moment.";
  }
  if (status === 404) {
    return "We couldn’t find what you were looking for.";
  }
  if (status >= 500) {
    return "The backend responded with an error. Please try again, or open the technical story.";
  }
  if (status === 400 || status === 422) {
    // Most validation errors carry a useful backend message; surface that.
    return fallback;
  }
  return fallback;
}

/** Defaults for the public demo deploy. Generous, not infinite. */
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 600;

export type ApiFetchOptions = RequestInit & {
  /** Timeout in milliseconds. Default 10s. Pass 0 to disable. */
  timeoutMs?: number;
  /**
   * Max retries on transient failures (network error, timeout, 5xx, 408, 425,
   * 429). Default 1 for GET / HEAD, 0 for everything else — mutations are
   * never retried automatically.
   */
  retries?: number;
  /** Delay between retries. Default 600ms. */
  retryDelayMs?: number;
  /** External abort signal; merged with the internal timeout signal. */
  signal?: AbortSignal;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function methodOf(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const method = methodOf(init);
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts =
    1 + (init?.retries ?? (isSafeMethod(method) ? DEFAULT_RETRY_COUNT : 0));
  const retryDelay = init?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: ApiError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiFetchOnce<T>(url, init, timeoutMs);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      lastError = err;
      // Stop on non-retryable failures, on the last attempt, or if the caller's
      // signal was aborted (e.g. the user navigated away).
      if (!err.retryable || attempt === maxAttempts) throw err;
      if (init?.signal?.aborted) throw err;
      await sleep(retryDelay);
    }
  }
  // Unreachable — the loop above either returns or throws — but TS doesn't see it.
  throw lastError ?? new ApiError("Unknown error", 0);
}

async function apiFetchOnce<T>(
  url: string,
  init: ApiFetchOptions | undefined,
  timeoutMs: number,
): Promise<T> {
  // Compose a timeout signal with the caller's signal (if any).
  const timeoutController = new AbortController();
  const timer =
    timeoutMs > 0
      ? setTimeout(() => timeoutController.abort(), timeoutMs)
      : undefined;
  const externalSignal = init?.signal;
  const onExternalAbort = () => timeoutController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) timeoutController.abort();
    else externalSignal.addEventListener("abort", onExternalAbort);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: timeoutController.signal,
      headers: {
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    // Differentiate timeout-induced abort from a "real" network error.
    if (timeoutController.signal.aborted && !externalSignal?.aborted) {
      throw new ApiError(
        `Request timed out after ${timeoutMs}ms: ${url}`,
        0,
        "timeout",
      );
    }
    throw new ApiError(
      `Network error: could not reach ${url}. Is the backend running?`,
      0,
      "network_error",
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
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

/** Owner Answers v2 — structured fields the /questions UI attaches to
 *  review-queue submissions. All optional so /review (v1 callers) keep
 *  working without sending any of them. */
export type OwnerAnswerFields = {
  owner_question_key?: string | null;
  owner_question_text?: string | null;
  owner_answer_label?: string | null;
  owner_note?: string | null;
  suggested_resolution?: string | null;
  accountant_follow_up_required?: boolean;
};

export const approveReview = (
  transactionId: string,
  note?: string,
  ownerFields: OwnerAnswerFields = {},
) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewer_note: note ?? null, ...ownerFields }),
  });

export const correctReview = (
  transactionId: string,
  selectedCategoryCode: string,
  note?: string,
  ownerFields: OwnerAnswerFields = {},
) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/correct`, {
    method: "POST",
    body: JSON.stringify({
      selected_category_code: selectedCategoryCode,
      reviewer_note: note ?? null,
      ...ownerFields,
    }),
  });

export const markUncategorizable = (
  transactionId: string,
  note?: string,
  ownerFields: OwnerAnswerFields = {},
) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/uncategorizable`, {
    method: "POST",
    body: JSON.stringify({ reviewer_note: note ?? null, ...ownerFields }),
  });

/**
 * Defer a row to an accountant. The categorization result transitions to
 * `accountant_review_required`. No predicted category is adopted. The row
 * is not finalized and not counted as verified by the trust metric.
 */
export const markForAccountantReview = (
  transactionId: string,
  note?: string,
  ownerFields: OwnerAnswerFields = {},
) =>
  apiFetch<ReviewDecision>(`/review-queue/${transactionId}/accountant-review`, {
    method: "POST",
    body: JSON.stringify({
      reviewer_note: note ?? null,
      ...ownerFields,
      accountant_follow_up_required: true,
    }),
  });

// ── Ledger ─────────────────────────────────────────────────────────────────

export const getLedger = () => apiFetch<Ledger>("/ledger");

export const getLedgerExportUrl = () => `${getApiBaseUrl()}/ledger/export.csv`;

/**
 * Download an export file via fetch → blob → programmatic download.
 *
 * Supports CSV, Markdown, and JSON exports. Validates status and
 * content-type before saving. Works reliably on mobile Chrome.
 */
export async function downloadExport(
  path: string,
  opts?: { filename?: string; accept?: string },
): Promise<void> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers: Record<string, string> = {};
  if (opts?.accept) headers["Accept"] = opts.accept;
  const res = await fetch(url, { credentials: "omit", headers });
  if (!res.ok) {
    throw new ApiError(
      `Export failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const blob = await res.blob();
  if (blob.size === 0) {
    throw new ApiError("Export returned an empty file", res.status);
  }
  const date = new Date().toISOString().slice(0, 10);
  const name = opts?.filename ?? `ledgerlens-export-${date}`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadCsvExport(
  path: string,
  filename?: string,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return downloadExport(path, {
    filename: filename ?? `ledgerlens-demo-ledger-${date}.csv`,
  });
}

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

// ── Splits ──────────────────────────────────────────────────────────────────

export type SplitLine = {
  id: string;
  transaction_id: string;
  line_index: number;
  amount_cents: number;
  category_code: string | null;
  category_name: string | null;
  note: string | null;
  source: string;
};

export type SplitValidation = {
  transaction_amount_cents: number;
  split_total_cents: number;
  is_complete: boolean;
  remainder_cents: number;
  line_count: number;
};

export type SplitListOut = {
  lines: SplitLine[];
  validation: SplitValidation;
};

export const getSplits = (transactionId: string) =>
  apiFetch<SplitListOut>(`/transactions/${transactionId}/splits`);

export const replaceSplits = (
  transactionId: string,
  lines: { amount_cents: number; category_code: string | null; note?: string | null }[],
) =>
  apiFetch<SplitListOut>(`/transactions/${transactionId}/splits`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
    headers: { "Content-Type": "application/json" },
  });

export const deleteSplits = (transactionId: string) =>
  apiFetch<{ deleted_lines: number }>(`/transactions/${transactionId}/splits`, {
    method: "DELETE",
  });

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

export type DemoScenario = {
  business_name: string;
  business_type: string;
  location: string;
  cleanup_month: string;
  cleanup_period_start: string;
  cleanup_period_end: string;
  scenario_summary: string;
  accountant_handoff_goal: string;
  demo_disclaimer: string;
  handoff_filename: string;
};

export const getDemoStatus = () => apiFetch<DemoStatus>("/demo/status");

export const getDemoScenario = () => apiFetch<DemoScenario>("/demo/scenario");

export const getDemoSampleTransactions = () =>
  apiFetch<DemoSampleTransaction[]>("/demo/sample-transactions");

export const seedDemo = () =>
  apiFetch<DemoSeedResult>("/demo/seed", { method: "POST" });

export const resetDemo = () =>
  apiFetch<DemoResetResult>("/demo/reset", { method: "POST" });

// ── Handoff (small-business cleanup report) ────────────────────────────────

export type CleanupImpact = {
  transactions_imported: number;
  handled_by_rules_or_memory: number;
  handled_by_correction_memory: number;
  routed_to_review: number;
  corrections_learned: number;
  estimated_minutes_saved: number;
};

export type HandoffOwnerAnswer = {
  transaction_id: string;
  transaction_date: string;
  transaction_description: string;
  amount_cents: number;
  currency: string;
  answer: string;
  selected_category_code: string | null;
  selected_category_name: string | null;
  reviewer_action: string;
  // Owner Answers v2 — null on legacy v1 rows.
  owner_question_key: string | null;
  owner_question_text: string | null;
  owner_answer_label: string | null;
  owner_note: string | null;
  suggested_resolution: string | null;
  accountant_follow_up_required: boolean;
};

export type HandoffScenario = {
  business_name: string;
  business_type: string;
  location: string;
  cleanup_month: string;
  handoff_filename: string;
  demo_disclaimer: string;
};

export type HandoffResponse = {
  generated_at: string;
  cleanup_period_label: string;
  trust: LedgerTrust;
  impact: CleanupImpact;
  ready_for_accountant: LedgerRow[];
  needs_review: LedgerRow[];
  owner_answers: HandoffOwnerAnswer[];
  corrections_learned: CorrectionMemory[];
  scenario: HandoffScenario | null;
};

export const getHandoff = () => apiFetch<HandoffResponse>("/handoff");

export const getHandoffMarkdownUrl = () =>
  `${getApiBaseUrl()}/handoff/export.md`;

/** CSV of finalized + verified rows formatted for accountant review.
 * Not a QuickBooks / QBO / IIF import file. */
export const getHandoffReviewedCsvUrl = () =>
  `${getApiBaseUrl()}/handoff/export.reviewed.csv`;

/** CSV of rows that still need follow-up — owner-flagged accountant
 * reviews and rows the model could not finalize. Kept separate from
 * the reviewed CSV so the accountant doesn't have to filter. */
export const getHandoffFollowupCsvUrl = () =>
  `${getApiBaseUrl()}/handoff/export.followup.csv`;

// ── Admin / foundation status ─────────────────────────────────────────────

export type FoundationStatus = {
  auth_implemented: boolean;
  tenant_models_present: boolean;
  tenant_enforcement_complete: boolean;
  demo_tenant_available: boolean;
  demo_business_available: boolean;
  production_ready: boolean;
  user_count: number;
  tenant_count: number;
  membership_count: number;
  business_count: number;
  warnings: string[];
};

export const getFoundationStatus = () =>
  apiFetch<FoundationStatus>("/admin/foundation/status");

// ── Category mapping (editable) ───────────────────────────────────────────

export type MappingEntry = {
  intent: string;
  category_code: string | null;
  category_name: string | null;
  block_fallback: boolean;
  notes: string | null;
  status: "mapped" | "unmapped" | "fallback_blocked";
};

export type CategoryOption = {
  code: string;
  name: string;
};

export type MappingProfile = {
  profile_id: string;
  profile_name: string;
  business_id: string;
  business_name: string | null;
  source: string;
  entries: MappingEntry[];
  missing_intents: string[];
  available_categories: CategoryOption[];
  warnings: string[];
};

export const getMappingProfile = () => apiFetch<MappingProfile>("/mapping/profile");

export const updateMappingEntry = (
  intent: string,
  payload: { category_code: string | null; block_fallback: boolean; notes?: string | null },
) =>
  apiFetch<MappingProfile>(`/mapping/profile/entries/${encodeURIComponent(intent)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const resetMappingProfile = () =>
  apiFetch<MappingProfile>("/mapping/profile/reset", { method: "POST" });

// ── Demo readiness ────────────────────────────────────────────────────────

export type DemoReadiness = {
  ready: boolean;
  checks: Record<string, Record<string, unknown>>;
  warnings: string[];
  version: string;
};

export const getDemoReady = () => apiFetch<DemoReadiness>("/demo/ready");

// ── Saved CSV import profiles ─────────────────────────────────────────────

export type CsvImportProfile = {
  id: string;
  business_id: string;
  name: string;
  source: string;
  amount_mode: "signed" | "debit_credit";
  date_column: string;
  description_column: string;
  amount_column: string | null;
  debit_column: string | null;
  credit_column: string | null;
  merchant_column: string | null;
  account_column: string | null;
  memo_column: string | null;
  reference_column: string | null;
  expected_headers: string[];
};

export type CsvImportProfileList = {
  business_id: string;
  business_name: string | null;
  profiles: CsvImportProfile[];
  warnings: string[];
};

export type CsvImportProfilePayload = {
  name: string;
  amount_mode: "signed" | "debit_credit";
  date_column: string;
  description_column: string;
  amount_column?: string | null;
  debit_column?: string | null;
  credit_column?: string | null;
  merchant_column?: string | null;
  account_column?: string | null;
  memo_column?: string | null;
  reference_column?: string | null;
  expected_headers: string[];
};

export type CsvImportProfileValidation = {
  profile_id: string;
  profile_name: string;
  matched_headers: string[];
  missing_headers: string[];
  extra_headers: string[];
  profile_applicable: boolean;
  warnings: string[];
};

export const listImportProfiles = () =>
  apiFetch<CsvImportProfileList>("/import-profiles");

export const createImportProfile = (payload: CsvImportProfilePayload) =>
  apiFetch<CsvImportProfile>("/import-profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const validateImportProfileHeaders = (
  profileId: string,
  headers: string[],
) =>
  apiFetch<CsvImportProfileValidation>(
    `/import-profiles/${encodeURIComponent(profileId)}/validate`,
    {
      method: "POST",
      body: JSON.stringify({ headers }),
    },
  );

// ── Mapping recategorization preview ──────────────────────────────────────

export type MappingPreviewRow = {
  transaction_id: string;
  transaction_date: string;
  description: string;
  merchant: string | null;
  amount_cents: number;
  current_category_code: string | null;
  current_category_name: string | null;
  proposed_category_code: string | null;
  proposed_category_name: string | null;
  matched_intent: string | null;
  status: string;
  eligible: boolean;
  reason: string | null;
};

export type MappingPreview = {
  intent: string;
  proposed_category_code: string | null;
  block_fallback: boolean;
  affected_count: number;
  eligible_count: number;
  ineligible_count: number;
  would_route_to_review_count: number;
  rows: MappingPreviewRow[];
  warnings: string[];
};

export const previewMappingChange = (payload: {
  intent: string;
  proposed_category_code: string | null;
  block_fallback: boolean;
  limit?: number;
}) =>
  apiFetch<MappingPreview>("/mapping/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ── Session ──────────────────────────────────────────────────────────────

export type SessionResponse = {
  authenticated: boolean;
  mode: string;
  user: { id: string; display_name: string; role_hint: string };
  business: { id: string; name: string; slug: string; is_demo: boolean };
  warnings: string[];
};

export const getSession = () => apiFetch<SessionResponse>("/session");
export const createDemoSession = () =>
  apiFetch<SessionResponse>("/session/demo", { method: "POST" });

// ── Audit events ─────────────────────────────────────────────────────────

export type AuditEventRow = {
  id: string;
  business_id: string | null;
  actor_user_id: string | null;
  actor_display_name: string | null;
  request_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type AuditEventList = {
  total: number;
  business_id: string;
  events: AuditEventRow[];
  warnings: string[];
};

export const listAuditEventsScoped = (params: {
  limit?: number;
  entity_type?: string;
  action?: string;
} = {}) => {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  if (params.entity_type) q.set("entity_type", params.entity_type);
  if (params.action) q.set("action", params.action);
  const qs = q.toString();
  return apiFetch<AuditEventList>(`/audit-events${qs ? `?${qs}` : ""}`);
};

// ── Mapping apply (selected eligible rows) ──────────────────────────────

export type MappingApplyRejection = {
  transaction_id: string;
  reason: string;
};

export type MappingApplyResult = {
  intent: string;
  requested_count: number;
  applied_count: number;
  rejected_count: number;
  rejected_rows: MappingApplyRejection[];
  audit_event_id: string | null;
  warnings: string[];
};

export const applyMappingPreview = (payload: {
  intent: string;
  proposed_category_code: string | null;
  block_fallback: boolean;
  selected_transaction_ids: string[];
}) =>
  apiFetch<MappingApplyResult>("/mapping/apply-preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
