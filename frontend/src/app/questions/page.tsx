"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/DataState";
import {
  ApiError,
  approveReview,
  correctReview,
  getReviewQueue,
  markUncategorizable,
} from "@/lib/api/client";
import type { ReviewQueueItem } from "@/lib/api/types";
import { formatAmount } from "@/lib/format";

/**
 * Owner Questions — plain-English projection of the review queue.
 *
 * For each review item we pick a small question template and 4–6 multiple-
 * choice answers. The chosen answer is recorded as a `reviewer_note` on the
 * resulting ReviewDecision so the handoff page surfaces it verbatim to the
 * accountant. When the answer maps to a specific category code, the row is
 * corrected via `/review-queue/{tx}/correct`; otherwise it's approved with
 * the answer as the note ("Not sure / needs accountant review" still
 * resolves the queue item but tags it for follow-up).
 */

type Answer = {
  label: string;
  // The plain-English answer recorded as reviewer_note (kept for backward
  // compat — the handoff still surfaces this string verbatim).
  note: string;
  // Optional category code. When set, we use /correct; otherwise /approve.
  categoryCode?: string;
  // Owner Answers v2 — structured metadata persisted on ReviewDecision.
  // `accountantFollowUp: true` lights up the inline warning + flags the row
  // in the handoff. `suggestedResolution` is a small enum hint surfaced in
  // the markdown export ("vendor_payment", "owner_draw", etc.).
  accountantFollowUp?: boolean;
  suggestedResolution?: string;
};

type QuestionTemplate = {
  key: string;
  match: (item: ReviewQueueItem) => boolean;
  question: string;
  answers: Answer[];
};

const TEMPLATES: QuestionTemplate[] = [
  {
    key: "customer_deposit",
    // Deposits / customer payments — revenue side, not expense.
    match: (item) =>
      /customer\s+check\s+deposit|cash\s+deposit|deposit\s+payout|square\s+deposit|stripe\s+deposit/i.test(
        item.transaction.description,
      ),
    question: "Is this a customer deposit or other revenue?",
    answers: [
      {
        label: "Customer payment (revenue)",
        note: "Owner: customer payment.",
        categoryCode: "4010",
        suggestedResolution: "customer_revenue",
      },
      {
        label: "Service revenue",
        note: "Owner: service revenue.",
        categoryCode: "4020",
        suggestedResolution: "service_revenue",
      },
      {
        label: "Refund of a business expense",
        note: "Owner: refund — confirm with accountant.",
        accountantFollowUp: true,
        suggestedResolution: "expense_refund",
      },
      {
        label: "Personal deposit / non-business",
        note: "Owner: personal deposit — exclude from books.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "owner_transfer",
    // Owner-side transfers — owner draws, contributions, ATM cash.
    match: (item) =>
      /owner\s+transfer|venmo\s+payment|atm\s+withdrawal/i.test(item.transaction.description),
    question: "What was this transfer?",
    answers: [
      {
        label: "Owner draw",
        note: "Owner: owner draw / distribution.",
        categoryCode: "3030",
        suggestedResolution: "owner_draw",
      },
      {
        label: "Owner contribution",
        note: "Owner: owner contribution.",
        categoryCode: "3010",
        suggestedResolution: "owner_contribution",
      },
      {
        label: "Reimbursement for a business expense",
        note: "Owner: reimbursement — confirm receipt with accountant.",
        accountantFollowUp: true,
        suggestedResolution: "reimbursement",
      },
      {
        label: "Personal / non-business",
        note: "Owner: personal — exclude from books.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "unknown_ach_transfer",
    match: (item) =>
      /ach\s+transfer|ach\s+debit|wire\s+transfer|check\s*#/i.test(item.transaction.description) ||
      !item.transaction.merchant,
    question: "What was this transfer for?",
    answers: [
      {
        label: "Vendor payment",
        note: "Owner: vendor payment.",
        categoryCode: "6080",
        suggestedResolution: "vendor_payment",
      },
      {
        label: "Loan payment",
        note: "Owner: loan payment — needs accountant review.",
        accountantFollowUp: true,
        suggestedResolution: "loan_payment",
      },
      {
        label: "Owner draw",
        note: "Owner: owner draw / distribution.",
        categoryCode: "3030",
        suggestedResolution: "owner_draw",
      },
      {
        label: "Payroll-related",
        note: "Owner: payroll-related.",
        categoryCode: "6030",
        suggestedResolution: "payroll",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
      {
        label: "Not sure",
        note: "Owner: not sure — flagged for review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "parts_vendor",
    // Auto-shop parts vendors — common monthly cleanup item.
    match: (item) =>
      /napa|autozone|o'?reilly|advance\s+auto|lkq|tire\s+dist/i.test(
        item.transaction.merchant ?? item.transaction.description,
      ),
    question: "What were these parts for?",
    answers: [
      {
        label: "Shop inventory",
        note: "Owner: shop parts inventory.",
        categoryCode: "5010",
        suggestedResolution: "parts_inventory",
      },
      {
        label: "Customer job",
        note: "Owner: parts for a customer job.",
        categoryCode: "5010",
        suggestedResolution: "parts_inventory",
      },
      {
        label: "Tools / equipment",
        note: "Owner: shop tools / equipment.",
        categoryCode: "6170",
        suggestedResolution: "tools_equipment",
      },
      {
        label: "Personal / non-business",
        note: "Owner: personal — exclude from books.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "home_improvement_store",
    // Home improvement stores — shop supplies vs personal building repair.
    match: (item) =>
      /home\s*depot|lowe'?s/i.test(item.transaction.merchant ?? item.transaction.description),
    question: "What was this purchase mainly for?",
    answers: [
      {
        label: "Shop supplies",
        note: "Owner: shop supplies.",
        categoryCode: "6180",
        suggestedResolution: "supplies_general",
      },
      {
        label: "Equipment",
        note: "Owner: equipment.",
        categoryCode: "6170",
        suggestedResolution: "tools_equipment",
      },
      {
        label: "Building repair",
        note: "Owner: building repair.",
        categoryCode: "6140",
        suggestedResolution: "repairs_maintenance",
      },
      {
        label: "Personal / non-business",
        note: "Owner: personal — exclude from books.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "marketplace_purchase",
    match: (item) =>
      /amazon|costco|walmart|target|sams\s*club/i.test(
        item.transaction.merchant ?? item.transaction.description,
      ),
    question: "What was this purchase mainly for?",
    answers: [
      {
        label: "Office supplies",
        note: "Owner: office supplies.",
        categoryCode: "6060",
        suggestedResolution: "office_supplies",
      },
      {
        label: "Equipment",
        note: "Owner: equipment.",
        categoryCode: "6170",
        suggestedResolution: "tools_equipment",
      },
      {
        label: "Inventory",
        note: "Owner: inventory — confirm with accountant.",
        accountantFollowUp: true,
        suggestedResolution: "parts_inventory",
      },
      {
        label: "Meals or staff expense",
        note: "Owner: meals / staff expense.",
        categoryCode: "6120",
        suggestedResolution: "meals_entertainment",
      },
      {
        label: "Personal / non-business",
        note: "Owner: personal — exclude from books.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "fuel_or_vehicle",
    match: (item) =>
      /fuel|gas|shell|exxon|chevron|mobil|bp/i.test(
        item.transaction.merchant ?? item.transaction.description,
      ),
    question: "Was this vehicle expense business-related?",
    answers: [
      {
        label: "Business fuel",
        note: "Owner: business fuel.",
        categoryCode: "6130",
        suggestedResolution: "fuel_vehicle",
      },
      {
        label: "Vehicle maintenance",
        note: "Owner: vehicle maintenance.",
        categoryCode: "6140",
        suggestedResolution: "vehicle_maintenance",
      },
      {
        label: "Personal / non-business",
        note: "Owner: personal vehicle expense — exclude.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
  {
    key: "subscription_or_telecom",
    match: (item) =>
      /subscription|monthly|annual|saas|software|comcast|verizon|att|t-?mobile/i.test(
        item.transaction.description,
      ),
    question: "Is this a business software or service subscription?",
    answers: [
      {
        label: "Software subscription",
        note: "Owner: business software subscription.",
        categoryCode: "6070",
        suggestedResolution: "software_subscription",
      },
      {
        label: "Internet / telecom",
        note: "Owner: business internet / telecom.",
        categoryCode: "6150",
        suggestedResolution: "internet_telecom",
      },
      {
        label: "Advertising / marketing tool",
        note: "Owner: marketing / advertising tool.",
        categoryCode: "6090",
        suggestedResolution: "marketing_advertising",
      },
      {
        label: "Personal / non-business",
        note: "Owner: personal — exclude from books.",
        suggestedResolution: "personal",
      },
      {
        label: "Needs accountant review",
        note: "Owner: needs accountant review.",
        accountantFollowUp: true,
      },
    ],
  },
];

const DEFAULT_TEMPLATE: QuestionTemplate = {
  key: "default_uncertain_transaction",
  match: () => true,
  question: "How would you classify this transaction?",
  answers: [
    {
      label: "It's a normal business expense — approve the predicted category",
      note: "Owner: approved predicted category.",
    },
    {
      label: "Personal / non-business",
      note: "Owner: personal — exclude from books.",
      suggestedResolution: "personal",
    },
    {
      label: "Needs accountant review",
      note: "Owner: needs accountant review.",
      accountantFollowUp: true,
    },
    {
      label: "Not sure",
      note: "Owner: not sure — flagged for review.",
      accountantFollowUp: true,
    },
  ],
};

function pickTemplate(item: ReviewQueueItem): QuestionTemplate {
  return TEMPLATES.find((t) => t.match(item)) ?? DEFAULT_TEMPLATE;
}

type State = {
  loading: boolean;
  error: unknown;
  items: ReviewQueueItem[];
  busyId: string | null;
  /** Per-item save errors so one bad save doesn't blank the page. */
  saveErrors: Record<string, unknown>;
  /** Owner free-text note typed into the per-card textarea, keyed by tx id. */
  ownerNotes: Record<string, string>;
};

export default function QuestionsPage() {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    items: [],
    busyId: null,
    saveErrors: {},
    ownerNotes: {},
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const queue = await getReviewQueue({ limit: 50 });
      setState((s) => ({
        ...s,
        loading: false,
        error: null,
        items: queue.items,
      }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function clearSaveError(id: string) {
    setState((s) => {
      if (!(id in s.saveErrors)) return s;
      const next = { ...s.saveErrors };
      delete next[id];
      return { ...s, saveErrors: next };
    });
  }

  function setOwnerNote(id: string, value: string) {
    setState((s) => ({ ...s, ownerNotes: { ...s.ownerNotes, [id]: value } }));
  }

  async function handleAnswer(
    item: ReviewQueueItem,
    template: QuestionTemplate,
    answer: Answer,
  ) {
    const id = item.transaction.id;
    setState((s) => ({ ...s, busyId: id }));
    clearSaveError(id);
    const trimmedNote = (state.ownerNotes[id] ?? "").trim();
    const ownerFields = {
      owner_question_key: template.key,
      owner_question_text: template.question,
      owner_answer_label: answer.label,
      owner_note: trimmedNote ? trimmedNote : null,
      suggested_resolution: answer.suggestedResolution ?? null,
      accountant_follow_up_required: Boolean(answer.accountantFollowUp),
    };
    try {
      if (answer.categoryCode) {
        await correctReview(id, answer.categoryCode, answer.note, ownerFields);
      } else {
        // No specific category mapping — approve with the answer recorded as
        // a note so the accountant sees the explanation in the handoff.
        await approveReview(id, answer.note, ownerFields);
      }
      await load();
      // Clear the per-card textarea after a successful save.
      setState((s) => {
        const nextNotes = { ...s.ownerNotes };
        delete nextNotes[id];
        return { ...s, busyId: null, ownerNotes: nextNotes };
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        busyId: null,
        saveErrors: { ...s.saveErrors, [id]: err },
      }));
    }
  }

  async function handleSkip(item: ReviewQueueItem, template: QuestionTemplate) {
    const id = item.transaction.id;
    setState((s) => ({ ...s, busyId: id }));
    clearSaveError(id);
    const trimmedNote = (state.ownerNotes[id] ?? "").trim();
    try {
      await markUncategorizable(id, "Owner: skipped — exclude from books.", {
        owner_question_key: template.key,
        owner_question_text: template.question,
        owner_answer_label: "Skip — exclude from books",
        owner_note: trimmedNote ? trimmedNote : null,
        accountant_follow_up_required: false,
      });
      await load();
      setState((s) => {
        const nextNotes = { ...s.ownerNotes };
        delete nextNotes[id];
        return { ...s, busyId: null, ownerNotes: nextNotes };
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        busyId: null,
        saveErrors: { ...s.saveErrors, [id]: err },
      }));
    }
  }

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Owner questions
        </p>
        <h1 className="mt-2 font-display text-[clamp(24px,5vw,32px)] font-medium leading-tight text-text-primary">
          A few questions about this month
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          Plain-English questions for the transactions LedgerLens can&apos;t safely classify
          on its own. Your answer is recorded as a note for your accountant; if it maps to a
          category, the row is corrected automatically.
        </p>
      </header>

      {state.error !== null && (
        <ErrorState
          error={state.error}
          onRetry={() => void load()}
          secondaryAction={
            <Link
              href="/cleanup"
              className="text-[13px] font-medium text-text-secondary hover:text-text-primary"
            >
              Back to cleanup checklist →
            </Link>
          }
        />
      )}

      {state.loading && <LoadingState label="Loading owner questions…" />}

      {!state.loading && state.items.length === 0 && state.error === null && (
        <EmptyState
          title="No owner questions right now"
          message="Everything is either auto-categorized or already reviewed."
          action={
            <Link
              href="/handoff"
              className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
            >
              View accountant handoff →
            </Link>
          }
          secondaryAction={
            <Link
              href="/cleanup"
              className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
            >
              Open cleanup checklist
            </Link>
          }
        />
      )}

      {!state.loading && state.items.length > 0 && (
        <ol className="mt-6 space-y-4">
          {state.items.map((item) => {
            const tmpl = pickTemplate(item);
            const busy = state.busyId === item.transaction.id;
            const saveError = state.saveErrors[item.transaction.id];
            const saveMessage =
              saveError instanceof ApiError
                ? saveError.userMessage
                : saveError instanceof Error
                  ? saveError.message
                  : null;
            return (
              <li
                key={item.transaction.id}
                className="rounded-lg border border-surface-border bg-surface-panel p-4"
              >
                <p className="mono text-[12px] text-text-subtle">
                  {item.transaction.transaction_date} ·{" "}
                  {formatAmount(item.transaction.amount_cents, item.transaction.currency)}
                  {item.transaction.merchant && ` · ${item.transaction.merchant}`}
                </p>
                <p className="mt-1 text-[15px] font-medium text-text-primary">
                  {item.transaction.description}
                </p>
                <p className="mt-3 font-display text-[16px] font-medium text-brand-900">
                  {tmpl.question}
                </p>
                <p className="mt-1 text-[11px] text-text-subtle">
                  Your answer will be saved in the accountant handoff package. It adds
                  business context but does not blindly finalize the accounting category.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tmpl.answers.map((answer) => (
                    <button
                      key={answer.label}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAnswer(item, tmpl, answer)}
                      title={
                        answer.accountantFollowUp
                          ? "This will be flagged for accountant review."
                          : undefined
                      }
                      className={
                        answer.accountantFollowUp
                          ? "rounded border border-amber-300 bg-amber-50 px-3 py-2 text-left text-[13px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                          : "rounded border border-surface-border bg-surface-page px-3 py-2 text-left text-[13px] text-text-primary hover:bg-brand-100 disabled:opacity-50"
                      }
                    >
                      {answer.label}
                      {answer.accountantFollowUp && (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700">
                          · accountant review
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label
                    htmlFor={`owner-note-${item.transaction.id}`}
                    className="text-[12px] font-medium text-text-secondary"
                  >
                    Optional note for your accountant
                  </label>
                  <textarea
                    id={`owner-note-${item.transaction.id}`}
                    value={state.ownerNotes[item.transaction.id] ?? ""}
                    onChange={(e) => setOwnerNote(item.transaction.id, e.target.value)}
                    placeholder="Add context for your accountant, if helpful."
                    rows={2}
                    disabled={busy}
                    className="mt-1 w-full resize-y rounded border border-surface-border bg-surface-page px-2 py-1.5 text-[13px] text-text-primary placeholder:text-text-subtle disabled:opacity-50"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-text-subtle">
                    Predicted:{" "}
                    <span className="mono">
                      [{item.latest_result.predicted_category_code}]{" "}
                    </span>
                    {item.latest_result.predicted_category_name || "—"} · confidence{" "}
                    <span className="mono">
                      {(item.latest_result.confidence * 100).toFixed(0)}%
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSkip(item, tmpl)}
                    className="text-[12px] text-text-subtle underline hover:text-text-primary disabled:opacity-50"
                  >
                    Skip — exclude from books
                  </button>
                </div>
                {saveMessage && (
                  <div
                    role="alert"
                    className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800"
                  >
                    Could not save this answer: {saveMessage}{" "}
                    <button
                      type="button"
                      onClick={() => clearSaveError(item.transaction.id)}
                      className="underline"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-8 text-[12px] text-text-subtle">
        Looking for the full review queue with category dropdowns?{" "}
        <Link href="/review" className="text-brand-700 underline">
          Open /review →
        </Link>
      </p>
    </AppShell>
  );
}
