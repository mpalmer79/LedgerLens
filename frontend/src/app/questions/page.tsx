"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
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
  // The plain-English answer recorded as reviewer_note.
  note: string;
  // Optional category code. When set, we use /correct; otherwise /approve.
  categoryCode?: string;
};

type QuestionTemplate = {
  match: (item: ReviewQueueItem) => boolean;
  question: string;
  answers: Answer[];
};

const TEMPLATES: QuestionTemplate[] = [
  {
    // Deposits / customer payments — revenue side, not expense.
    match: (item) =>
      /customer\s+check\s+deposit|cash\s+deposit|deposit\s+payout|square\s+deposit|stripe\s+deposit/i.test(
        item.transaction.description,
      ),
    question: "Is this a customer deposit or other revenue?",
    answers: [
      { label: "Customer payment (revenue)", note: "Owner: customer payment.", categoryCode: "4010" },
      { label: "Service revenue", note: "Owner: service revenue.", categoryCode: "4020" },
      { label: "Refund of a business expense", note: "Owner: refund — confirm with accountant." },
      { label: "Personal deposit / non-business", note: "Owner: personal deposit — exclude from books." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
  {
    // Owner-side transfers — owner draws, contributions, ATM cash.
    match: (item) =>
      /owner\s+transfer|venmo\s+payment|atm\s+withdrawal/i.test(item.transaction.description),
    question: "What was this transfer?",
    answers: [
      { label: "Owner draw", note: "Owner: owner draw / distribution.", categoryCode: "3030" },
      { label: "Owner contribution", note: "Owner: owner contribution.", categoryCode: "3010" },
      { label: "Reimbursement for a business expense", note: "Owner: reimbursement — confirm receipt with accountant." },
      { label: "Personal / non-business", note: "Owner: personal — exclude from books." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
  {
    match: (item) =>
      /ach\s+transfer|ach\s+debit|wire\s+transfer|check\s*#/i.test(item.transaction.description) ||
      !item.transaction.merchant,
    question: "What was this transfer for?",
    answers: [
      { label: "Vendor payment", note: "Owner: vendor payment.", categoryCode: "6080" },
      { label: "Loan payment", note: "Owner: loan payment — needs accountant review." },
      { label: "Owner draw", note: "Owner: owner draw / distribution.", categoryCode: "3030" },
      { label: "Payroll-related", note: "Owner: payroll-related.", categoryCode: "6030" },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
      { label: "Not sure", note: "Owner: not sure — flagged for review." },
    ],
  },
  {
    // Auto-shop parts vendors — common monthly cleanup item.
    match: (item) =>
      /napa|autozone|o'?reilly|advance\s+auto|lkq|tire\s+dist/i.test(
        item.transaction.merchant ?? item.transaction.description,
      ),
    question: "What were these parts for?",
    answers: [
      { label: "Shop inventory", note: "Owner: shop parts inventory.", categoryCode: "5010" },
      { label: "Customer job", note: "Owner: parts for a customer job.", categoryCode: "5010" },
      { label: "Tools / equipment", note: "Owner: shop tools / equipment.", categoryCode: "6170" },
      { label: "Personal / non-business", note: "Owner: personal — exclude from books." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
  {
    // Home improvement stores — shop supplies vs personal building repair.
    match: (item) =>
      /home\s*depot|lowe'?s/i.test(item.transaction.merchant ?? item.transaction.description),
    question: "What was this purchase mainly for?",
    answers: [
      { label: "Shop supplies", note: "Owner: shop supplies.", categoryCode: "6180" },
      { label: "Equipment", note: "Owner: equipment.", categoryCode: "6170" },
      { label: "Building repair", note: "Owner: building repair.", categoryCode: "6140" },
      { label: "Personal / non-business", note: "Owner: personal — exclude from books." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
  {
    match: (item) =>
      /amazon|costco|walmart|target|sams\s*club/i.test(
        item.transaction.merchant ?? item.transaction.description,
      ),
    question: "What was this purchase mainly for?",
    answers: [
      { label: "Office supplies", note: "Owner: office supplies.", categoryCode: "6060" },
      { label: "Equipment", note: "Owner: equipment.", categoryCode: "6170" },
      { label: "Inventory", note: "Owner: inventory — confirm with accountant." },
      { label: "Meals or staff expense", note: "Owner: meals / staff expense.", categoryCode: "6120" },
      { label: "Personal / non-business", note: "Owner: personal — exclude from books." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
  {
    match: (item) =>
      /fuel|gas|shell|exxon|chevron|mobil|bp/i.test(
        item.transaction.merchant ?? item.transaction.description,
      ),
    question: "Was this vehicle expense business-related?",
    answers: [
      { label: "Business fuel", note: "Owner: business fuel.", categoryCode: "6130" },
      { label: "Vehicle maintenance", note: "Owner: vehicle maintenance.", categoryCode: "6140" },
      { label: "Personal / non-business", note: "Owner: personal vehicle expense — exclude." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
  {
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
      },
      {
        label: "Internet / telecom",
        note: "Owner: business internet / telecom.",
        categoryCode: "6150",
      },
      {
        label: "Advertising / marketing tool",
        note: "Owner: marketing / advertising tool.",
        categoryCode: "6090",
      },
      { label: "Personal / non-business", note: "Owner: personal — exclude from books." },
      { label: "Needs accountant review", note: "Owner: needs accountant review." },
    ],
  },
];

const DEFAULT_TEMPLATE: QuestionTemplate = {
  match: () => true,
  question: "How would you classify this transaction?",
  answers: [
    { label: "It's a normal business expense — approve the predicted category", note: "Owner: approved predicted category." },
    {
      label: "Personal / non-business",
      note: "Owner: personal — exclude from books.",
    },
    {
      label: "Needs accountant review",
      note: "Owner: needs accountant review.",
    },
    {
      label: "Not sure",
      note: "Owner: not sure — flagged for review.",
    },
  ],
};

function pickTemplate(item: ReviewQueueItem): QuestionTemplate {
  return TEMPLATES.find((t) => t.match(item)) ?? DEFAULT_TEMPLATE;
}

type State = {
  loading: boolean;
  error: string | null;
  items: ReviewQueueItem[];
  busyId: string | null;
};

export default function QuestionsPage() {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    items: [],
    busyId: null,
  });

  const load = useCallback(async () => {
    try {
      const queue = await getReviewQueue({ limit: 50 });
      setState((s) => ({
        ...s,
        loading: false,
        error: null,
        items: queue.items,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error:
          err instanceof ApiError
            ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
            : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAnswer(item: ReviewQueueItem, answer: Answer) {
    setState((s) => ({ ...s, busyId: item.transaction.id, error: null }));
    try {
      if (answer.categoryCode) {
        await correctReview(item.transaction.id, answer.categoryCode, answer.note);
      } else {
        // No specific category mapping — approve with the answer recorded as
        // a note so the accountant sees the explanation in the handoff.
        await approveReview(item.transaction.id, answer.note);
      }
      await load();
      setState((s) => ({ ...s, busyId: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        busyId: null,
        error:
          err instanceof ApiError
            ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
            : String(err),
      }));
    }
  }

  async function handleSkip(item: ReviewQueueItem) {
    setState((s) => ({ ...s, busyId: item.transaction.id, error: null }));
    try {
      await markUncategorizable(item.transaction.id, "Owner: skipped — exclude from books.");
      await load();
      setState((s) => ({ ...s, busyId: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        busyId: null,
        error:
          err instanceof ApiError
            ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
            : String(err),
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

      {state.error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {state.error}
        </div>
      )}

      {state.loading && (
        <p className="mt-6 text-[14px] text-text-subtle">Loading…</p>
      )}

      {!state.loading && state.items.length === 0 && !state.error && (
        <section className="mt-8 rounded-lg border border-brand-200 bg-brand-100 p-6 text-center">
          <p className="font-display text-[18px] font-medium text-text-primary">
            No open questions.
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">
            Everything is either auto-categorized or already reviewed.{" "}
            <Link href="/handoff" className="text-brand-700 underline">
              Open the accountant handoff →
            </Link>
          </p>
        </section>
      )}

      {!state.loading && state.items.length > 0 && (
        <ol className="mt-6 space-y-4">
          {state.items.map((item) => {
            const tmpl = pickTemplate(item);
            const busy = state.busyId === item.transaction.id;
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
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tmpl.answers.map((answer) => (
                    <button
                      key={answer.label}
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAnswer(item, answer)}
                      className="rounded border border-surface-border bg-surface-page px-3 py-2 text-left text-[13px] text-text-primary hover:bg-brand-100 disabled:opacity-50"
                    >
                      {answer.label}
                    </button>
                  ))}
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
                    onClick={() => void handleSkip(item)}
                    className="text-[12px] text-text-subtle underline hover:text-text-primary disabled:opacity-50"
                  >
                    Skip — exclude from books
                  </button>
                </div>
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
