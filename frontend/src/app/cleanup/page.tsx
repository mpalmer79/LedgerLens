"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Clock3 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { CleanupImpactSummary } from "@/components/app/CleanupImpactSummary";
import { ErrorState, LoadingState } from "@/components/ui/DataState";
import {
  getHandoff,
  getReviewQueue,
  listTransactions,
  type HandoffResponse,
} from "@/lib/api/client";

type Step = {
  key: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  statusText: string;
  explainer: string;
  actionLabel: string;
  actionHref: string;
};

type State = {
  loading: boolean;
  error: unknown;
  transactionsTotal: number;
  reviewTotal: number;
  ownerAnswersOpen: number;
  handoff: HandoffResponse | null;
};

const INITIAL: State = {
  loading: true,
  error: null,
  transactionsTotal: 0,
  reviewTotal: 0,
  ownerAnswersOpen: 0,
  handoff: null,
};

export default function CleanupPage() {
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [tx, queue, handoff] = await Promise.all([
        listTransactions({ limit: 1 }),
        getReviewQueue({ limit: 1 }),
        getHandoff(),
      ]);
      setState({
        loading: false,
        error: null,
        transactionsTotal: tx.total,
        reviewTotal: queue.total,
        ownerAnswersOpen: queue.total,
        handoff,
      });
    } catch (err) {
      setState({ ...INITIAL, loading: false, error: err });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handoff = state.handoff;
  const trust = handoff?.trust;
  const verifiedAll =
    trust !== undefined &&
    trust.finalized_count > 0 &&
    trust.unverified_finalized_count === 0;

  const steps: Step[] = [
    {
      key: "import",
      title: "Import this month's transactions",
      status:
        state.transactionsTotal === 0
          ? "todo"
          : "done",
      statusText:
        state.transactionsTotal === 0
          ? "Nothing imported yet."
          : `${state.transactionsTotal} transaction${
              state.transactionsTotal === 1 ? "" : "s"
            } imported.`,
      explainer:
        "Upload a CSV from your bank — or use the guided demo's bundled sample set.",
      actionLabel:
        state.transactionsTotal === 0 ? "Import transactions" : "Open transactions",
      actionHref:
        state.transactionsTotal === 0 ? "/transactions/import" : "/transactions",
    },
    {
      key: "classify",
      title: "Classify obvious vendors",
      status:
        state.transactionsTotal === 0
          ? "todo"
          : trust && trust.deterministic_count > 0
            ? "done"
            : "in_progress",
      statusText:
        state.transactionsTotal === 0
          ? "Waiting for transactions."
          : trust
            ? `${trust.deterministic_count} categorized by rules or memory.`
            : "Run categorization on the transactions list.",
      explainer:
        "LedgerLens checks correction memory and deterministic rules first — most obvious vendors never reach the model.",
      actionLabel: "Run categorization",
      actionHref: "/transactions",
    },
    {
      key: "review",
      title: "Review uncertain items",
      status:
        state.reviewTotal === 0
          ? state.transactionsTotal === 0
            ? "todo"
            : "done"
          : "in_progress",
      statusText:
        state.reviewTotal === 0
          ? state.transactionsTotal === 0
            ? "Nothing to review yet."
            : "Review queue is clear."
          : `${state.reviewTotal} transaction${
              state.reviewTotal === 1 ? "" : "s"
            } need review.`,
      explainer:
        "Anything correction memory and rules can't safely decide lands in the review queue. You approve, correct, or mark uncategorizable.",
      actionLabel: "Open review queue",
      actionHref: "/review",
    },
    {
      key: "questions",
      title: "Answer owner questions",
      status:
        state.ownerAnswersOpen === 0
          ? state.transactionsTotal === 0
            ? "todo"
            : "done"
          : "in_progress",
      statusText:
        state.ownerAnswersOpen === 0
          ? "No open questions."
          : `${state.ownerAnswersOpen} question${
              state.ownerAnswersOpen === 1 ? "" : "s"
            } in plain English.`,
      explainer:
        "Uncertain transactions presented as plain-English questions. Your answers become accountant-readable notes.",
      actionLabel: "Answer questions",
      actionHref: "/questions",
    },
    {
      key: "verify",
      title: "Verify the ledger",
      status: verifiedAll
        ? "done"
        : state.transactionsTotal === 0
          ? "todo"
          : "in_progress",
      statusText: trust
        ? trust.finalized_count === 0
          ? "Nothing finalized yet."
          : `${trust.verification_rate * 100}% of finalized rows verified (${
              trust.verified_count
            } of ${trust.finalized_count}).`
        : "Open the ledger to see the trust panel.",
      explainer:
        "A finalized row counts as verified only when it came from a rule, a correction-memory replay, or a human review.",
      actionLabel: "View ledger",
      actionHref: "/ledger",
    },
    {
      key: "handoff",
      title: "Export accountant handoff package",
      status: verifiedAll ? "done" : "todo",
      statusText: verifiedAll
        ? "Ready to export."
        : trust && trust.unverified_finalized_count > 0
          ? `${trust.unverified_finalized_count} unverified finalized row${
              trust.unverified_finalized_count === 1 ? "" : "s"
            } first.`
          : "Finish the steps above first.",
      explainer:
        "A markdown summary you can paste into an email to your bookkeeper or accountant.",
      actionLabel: "Open handoff",
      actionHref: "/handoff",
    },
  ];

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Monthly cleanup assistant
        </p>
        <h1 className="mt-2 font-display text-[clamp(24px,5vw,32px)] font-medium leading-tight text-text-primary">
          Monthly bookkeeping cleanup
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          Use this checklist once a month to move from messy bank activity to a verified
          handoff package. LedgerLens handles the obvious rows, turns uncertain ones into
          plain-English questions, and remembers your corrections for next month.
        </p>
        {state.handoff?.scenario && (
          <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-md border border-surface-border bg-surface-panel px-3 py-1.5 text-[12px] text-text-secondary">
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
              Sample data
            </span>
            Cleaning up {state.handoff.scenario.cleanup_month} books for{" "}
            <span className="font-medium text-text-primary">
              {state.handoff.scenario.business_name}
            </span>
            .
          </p>
        )}
      </header>

      {state.error !== null && (
        <ErrorState
          error={state.error}
          onRetry={() => void load()}
          secondaryAction={
            <Link
              href="/technical-story"
              className="text-[13px] font-medium text-text-secondary hover:text-text-primary"
            >
              Read the technical story →
            </Link>
          }
        />
      )}

      {state.loading && <LoadingState label="Loading cleanup status…" />}

      {/* Empty-state shortcut for first-time visitors */}
      {!state.loading && state.transactionsTotal === 0 && !state.error && (
        <section className="mt-6 rounded-lg border-2 border-brand-600 bg-brand-100 p-5">
          <h2 className="font-display text-[18px] font-medium text-text-primary">
            New here?
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            Try the{" "}
            <span className="font-medium text-text-primary">Granite State Auto Repair</span>{" "}
            sample scenario — a fictional independent auto repair shop cleaning up March 2026
            books. Or import your own bank CSV.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
            >
              Try the sample scenario →
            </Link>
            <Link
              href="/transactions/import"
              className="rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
            >
              Import a CSV
            </Link>
          </div>
        </section>
      )}

      <ol className="mt-8 space-y-3">
        {steps.map((step, idx) => (
          <li
            key={step.key}
            className="rounded-lg border border-surface-border bg-surface-panel p-4"
          >
            <div className="flex items-start gap-3">
              <StatusDot status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12px] uppercase tracking-wide text-text-subtle">
                    Step {idx + 1}
                  </p>
                  <span
                    className={
                      step.status === "done"
                        ? "text-[12px] font-medium text-brand-700"
                        : step.status === "in_progress"
                          ? "text-[12px] font-medium text-amber-700"
                          : "text-[12px] text-text-subtle"
                    }
                  >
                    {step.status === "done"
                      ? "✓ done"
                      : step.status === "in_progress"
                        ? "in progress"
                        : "to do"}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-[16px] font-medium text-text-primary">
                  {step.title}
                </h2>
                <p className="mt-1 text-[13px] text-text-secondary">{step.statusText}</p>
                <p className="mt-2 text-[12px] text-text-subtle">{step.explainer}</p>
                <Link
                  href={step.actionHref}
                  className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500"
                >
                  {step.actionLabel}
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {handoff && (
        <div className="mt-8">
          <CleanupImpactSummary impact={handoff.impact} />
        </div>
      )}
    </AppShell>
  );
}

function StatusDot({ status }: { status: Step["status"] }) {
  if (status === "done") {
    return <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />;
  }
  if (status === "in_progress") {
    return <Clock3 size={20} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />;
  }
  return <Circle size={20} className="mt-0.5 shrink-0 text-text-subtle" aria-hidden="true" />;
}
