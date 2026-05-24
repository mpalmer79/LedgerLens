"use client";

import Link from "next/link";

/**
 * Static accountant-handoff sample preview.
 *
 * Rendered by /handoff when the backend is unavailable so the money
 * shot is never blank. Every row is hard-coded from the Granite
 * State Auto Repair fictional sample scenario. The "Static sample
 * preview" badge + retry button keep the source of truth obvious.
 */
export function StaticHandoffSamplePreview({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <article
      data-testid="static-handoff-sample"
      className="mt-6 rounded-lg border border-surface-border bg-surface-panel"
    >
      <header className="border-b border-surface-border bg-surface-page p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800">
            Static sample preview — live backend temporarily unavailable
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[36px] rounded border border-surface-border bg-surface-panel px-3 py-1 text-[12px] font-medium text-text-primary hover:bg-surface-sunken"
            data-testid="static-handoff-retry"
          >
            Retry live handoff
          </button>
        </div>
        <h2 className="mt-2 font-display text-[20px] font-medium text-text-primary">
          Granite State Auto Repair — March 2026 handoff
        </h2>
        <p className="mt-1 text-[12px] text-text-secondary">
          <span className="mr-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
            Sample data
          </span>
          Fictional independent auto repair shop in New Hampshire. The data
          below is hard-coded for the static preview; the live page renders
          the same shape from the backend.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <SummaryStat label="Transactions imported" value="42" />
        <SummaryStat label="Procedurally verified" value="28" />
        <SummaryStat label="Owner-answered" value="6" />
        <SummaryStat label="Accountant follow-up" value="4" />
      </section>

      <section className="border-t border-surface-border p-4">
        <h3 className="font-display text-[16px] font-medium text-text-primary">
          Reviewed categorization summary
        </h3>
        <p className="mt-1 text-[12px] text-text-subtle">
          Rows backed by rule auto-approval, correction-memory replay, or
          explicit human review.
        </p>
        <ul className="mt-3 divide-y divide-surface-border rounded border border-surface-border">
          {SAMPLE_READY_ROWS.map((r) => (
            <li
              key={r.description}
              className="grid grid-cols-1 gap-1 p-3 text-[13px] sm:grid-cols-[6em_1fr_8em_10em] sm:items-center"
            >
              <span className="mono text-text-subtle">{r.date}</span>
              <span className="text-text-primary">{r.description}</span>
              <span className="mono text-right text-text-secondary">{r.amount}</span>
              <span className="text-text-secondary">{r.category}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-surface-border p-4">
        <h3 className="font-display text-[16px] font-medium text-text-primary">
          Questions answered by owner
        </h3>
        <ul className="mt-3 space-y-2 text-[13px]">
          {SAMPLE_OWNER_ANSWERS.map((a) => (
            <li
              key={a.description}
              className="rounded border border-surface-border bg-surface-page p-3"
            >
              <p className="font-medium text-text-primary">
                {a.date} · {a.description}
              </p>
              <p className="mt-1 text-text-subtle">
                Question: <span className="text-text-secondary">{a.question}</span>
              </p>
              <p className="mt-1 text-text-subtle">
                Owner answer:{" "}
                <span className="font-medium text-text-primary">{a.answer}</span>
              </p>
              {a.note && (
                <p className="mt-1 text-text-subtle">
                  Owner note: <span className="text-text-secondary">{a.note}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-surface-border p-4">
        <h3 className="font-display text-[16px] font-medium text-text-primary">
          Owner flagged for accountant review
        </h3>
        <ul className="mt-3 space-y-2 text-[13px]">
          {SAMPLE_ACCOUNTANT_FOLLOWUP.map((r) => (
            <li
              key={r.description}
              className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900"
            >
              <p className="font-medium">
                {r.date} · {r.description} ({r.amount})
              </p>
              <p className="mt-1 text-amber-900">
                Owner answer: <strong>{r.label}</strong>
              </p>
              {r.note && <p className="mt-1">Note: {r.note}</p>}
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-surface-border p-4">
        <h3 className="font-display text-[16px] font-medium text-text-primary">
          Accountant CSV exports
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li className="rounded border border-surface-border bg-surface-page p-3 text-[13px]">
            <p className="font-medium text-text-primary">
              Reviewed categorization CSV
            </p>
            <p className="mt-1 text-text-subtle">
              Finalized + verified rows formatted for accountant review.
              Includes owner answers and verification source inline.
              <strong> Not a QuickBooks import file.</strong>
            </p>
          </li>
          <li className="rounded border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900">
            <p className="font-medium">Follow-up / unresolved CSV</p>
            <p className="mt-1">
              Owner-flagged accountant-review rows + rows the model could not
              finalize. Kept separate so the accountant doesn&apos;t have to
              filter.
            </p>
          </li>
        </ul>
      </section>

      <footer className="border-t border-surface-border bg-surface-page p-4 text-[12px] text-text-subtle">
        <p>
          This handoff package is <strong>not tax advice</strong> and is not a
          substitute for accounting review. The trust metric is workflow-level
          (rule, memory, or human review on each row); it is not a guarantee of
          CPA or tax correctness.
        </p>
        <p className="mt-2">
          Static preview rendered because the backend is temporarily
          unavailable. The same shape is produced from live data when the
          backend is healthy.
        </p>
        <p className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
          >
            Retry live handoff
          </button>
          <Link
            href="/start"
            className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-panel px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
          >
            Owner: where do I start?
          </Link>
          <Link
            href="/technical-story"
            className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-panel px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
          >
            Technical story
          </Link>
        </p>
      </footer>
    </article>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-surface-border bg-surface-page p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </p>
      <p className="mt-1 mono text-[20px] font-medium text-text-primary">{value}</p>
    </div>
  );
}

const SAMPLE_READY_ROWS = [
  {
    date: "2026-03-01",
    description: "NH PROPERTY MGMT MAR RENT - SHOP",
    amount: "-$3,850.00",
    category: "[6010] Rent",
  },
  {
    date: "2026-03-02",
    description: "NAPA AUTO PARTS INV 88421",
    amount: "-$342.50",
    category: "[5010] Cost of Goods Sold",
  },
  {
    date: "2026-03-04",
    description: "STRIPE DEPOSIT PAYOUT",
    amount: "+$4,284.00",
    category: "[4010] Sales Revenue",
  },
  {
    date: "2026-03-06",
    description: "ADP PAYROLL BI-WEEKLY",
    amount: "-$7,842.30",
    category: "[6030] Wages & Salaries",
  },
  {
    date: "2026-03-11",
    description: "GOOGLE WORKSPACE BUSINESS",
    amount: "-$18.00",
    category: "[6070] Software Subscriptions",
  },
];

const SAMPLE_OWNER_ANSWERS = [
  {
    date: "2026-03-07",
    description: "ACH TRANSFER VENDOR REF 41281",
    question: "What was this transfer for?",
    answer: "Vendor payment",
    note: "Wholesale parts from a new supplier — see receipt #221.",
  },
  {
    date: "2026-03-18",
    description: "COSTCO WHOLESALE #341",
    question: "What was this purchase mainly for?",
    answer: "Shop inventory",
    note: null,
  },
  {
    date: "2026-03-24",
    description: "HOME DEPOT #2841 CONCORD",
    question: "What was this purchase mainly for?",
    answer: "Shop supplies",
    note: "Replacement bay shelving.",
  },
];

const SAMPLE_ACCOUNTANT_FOLLOWUP = [
  {
    date: "2026-03-15",
    description: "TD BANK BUSINESS LOAN PMT",
    amount: "-$1,482.00",
    label: "Needs accountant review",
    note: "Confirm split between interest and principal.",
  },
  {
    date: "2026-03-23",
    description: "VENMO PAYMENT - JON",
    amount: "-$250.00",
    label: "Needs accountant review",
    note: "Could be a subcontractor — verify W-9 on file.",
  },
];
