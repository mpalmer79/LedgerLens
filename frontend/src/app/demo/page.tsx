"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { TrustPanel } from "@/components/app/TrustPanel";
import {
  ApiError,
  categorize,
  categorizeBatch,
  correctReview,
  getDemoSampleTransactions,
  getDemoScenario,
  getDemoStatus,
  getLedger,
  getLedgerExportUrl,
  getReviewQueue,
  resetDemo,
  seedDemo,
  type DemoSampleTransaction,
  type DemoScenario,
  type DemoStatus,
} from "@/lib/api/client";
import type {
  CategorizationResult,
  Ledger,
  ReviewQueue,
  Transaction,
} from "@/lib/api/types";
import { formatAmount, formatConfidence } from "@/lib/format";

type StepStatus = "idle" | "running" | "done" | "error";

type StepState = {
  status: StepStatus;
  error: string | null;
};

type DemoState = {
  status: DemoStatus | null;
  scenario: DemoScenario | null;
  samples: DemoSampleTransaction[] | null;
  seeded: Transaction[];
  batchResults: CategorizationResult[];
  reviewQueue: ReviewQueue | null;
  memorySource: { source: Transaction; resultId: string } | null;
  memoryRepeat: { transaction: Transaction; result: CategorizationResult } | null;
  ledger: Ledger | null;
  steps: {
    seed: StepState;
    categorize: StepState;
    correct: StepState;
    rerun: StepState;
    ledger: StepState;
  };
};

const INITIAL: DemoState = {
  status: null,
  scenario: null,
  samples: null,
  seeded: [],
  batchResults: [],
  reviewQueue: null,
  memorySource: null,
  memoryRepeat: null,
  ledger: null,
  steps: {
    seed: { status: "idle", error: null },
    categorize: { status: "idle", error: null },
    correct: { status: "idle", error: null },
    rerun: { status: "idle", error: null },
    ledger: { status: "idle", error: null },
  },
};

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    return `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`;
  }
  return String(err);
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "correction_memory":
      return "Memory";
    case "rule_categorizer":
      return "Rule";
    case "demo_stub":
      return "Demo Stub";
    case "anthropic":
      return "Model";
    default:
      return provider;
  }
}

function providerTone(provider: string): string {
  switch (provider) {
    case "correction_memory":
    case "rule_categorizer":
      return "bg-brand-200 text-brand-800";
    case "demo_stub":
      return "bg-amber-100 text-amber-900";
    case "anthropic":
      return "bg-surface-sunken text-text-secondary";
    default:
      return "bg-surface-sunken text-text-secondary";
  }
}

export default function DemoPage() {
  const [state, setState] = useState<DemoState>(INITIAL);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const setStep = useCallback(
    (key: keyof DemoState["steps"], patch: Partial<StepState>) => {
      setState((s) => ({
        ...s,
        steps: { ...s.steps, [key]: { ...s.steps[key], ...patch } },
      }));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Status + samples are critical (the guided demo needs them). Scenario
      // is decorative — surface it only if it loads. If it fails the rest of
      // the page still works.
      try {
        const [status, samples] = await Promise.all([
          getDemoStatus(),
          getDemoSampleTransactions(),
        ]);
        if (!cancelled) setState((s) => ({ ...s, status, samples }));
      } catch (err) {
        if (!cancelled) setGlobalError(describeError(err));
        return;
      }
      try {
        const scenario = await getDemoScenario();
        if (!cancelled) setState((s) => ({ ...s, scenario }));
      } catch {
        // Scenario card just won't render. Not blocking.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReset = async () => {
    if (resetting) return; // double-click guard
    setResetting(true);
    setGlobalError(null);
    try {
      await resetDemo();
      const status = await getDemoStatus();
      setState({ ...INITIAL, samples: state.samples, scenario: state.scenario, status });
    } catch (err) {
      setGlobalError(describeError(err));
    } finally {
      setResetting(false);
    }
  };

  const handleSeed = async () => {
    if (state.steps.seed.status === "running") return; // double-click guard
    setStep("seed", { status: "running", error: null });
    try {
      const seed = await seedDemo();
      const status = await getDemoStatus();
      setState((s) => ({ ...s, seeded: seed.created, status }));
      setStep("seed", { status: "done" });
    } catch (err) {
      setStep("seed", { status: "error", error: describeError(err) });
    }
  };

  const handleCategorize = async () => {
    setStep("categorize", { status: "running", error: null });
    try {
      const ids = state.seeded.map((tx) => tx.id);
      const batch = await categorizeBatch(ids);
      const queue = await getReviewQueue({ limit: 25 });
      setState((s) => ({ ...s, batchResults: batch.results, reviewQueue: queue }));
      setStep("categorize", { status: "done" });
    } catch (err) {
      setStep("categorize", { status: "error", error: describeError(err) });
    }
  };

  const reviewItem = useMemo(() => state.reviewQueue?.items?.[0] ?? null, [state.reviewQueue]);

  const handleCorrect = async () => {
    if (!reviewItem) return;
    setStep("correct", { status: "running", error: null });
    try {
      // Correct the first review item to Office Supplies (6060) — that's a
      // safe, demo-friendly category that exists in the seed COA. The
      // narrative is "a human stepped in and decided"; the actual category
      // is illustrative.
      await correctReview(
        reviewItem.transaction.id,
        "6060",
        "Demo correction: shipping receipts get filed as office supplies.",
      );
      setState((s) => ({
        ...s,
        memorySource: {
          source: reviewItem.transaction,
          resultId: reviewItem.latest_result.id,
        },
      }));
      setStep("correct", { status: "done" });
    } catch (err) {
      setStep("correct", { status: "error", error: describeError(err) });
    }
  };

  const handleMemoryReplay = async () => {
    if (!state.memorySource) return;
    setStep("rerun", { status: "running", error: null });
    try {
      // Re-categorize the same transaction. The system should now hit
      // correction memory and skip the demo stub entirely — same merchant
      // key as the prior correction, so memory wins.
      const result = await categorize(state.memorySource.source.id);
      setState((s) => ({
        ...s,
        memoryRepeat: { transaction: state.memorySource!.source, result },
      }));
      setStep("rerun", { status: "done" });
    } catch (err) {
      setStep("rerun", { status: "error", error: describeError(err) });
    }
  };

  const handleLoadLedger = async () => {
    setStep("ledger", { status: "running", error: null });
    try {
      const ledger = await getLedger();
      setState((s) => ({ ...s, ledger }));
      setStep("ledger", { status: "done" });
    } catch (err) {
      setStep("ledger", { status: "error", error: describeError(err) });
    }
  };

  const inDemoMode = state.status?.demo_mode ?? false;

  return (
    <AppShell>
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-[28px] font-medium text-text-primary">
            Guided 3-minute demo
          </h1>
          <button
            type="button"
            onClick={handleReset}
            className="text-[12px] text-text-subtle hover:text-text-primary disabled:opacity-50"
            disabled={!inDemoMode || resetting}
          >
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
        </div>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          A scripted walk-through of LedgerLens for small-business bookkeeping cleanup. Every
          step calls the real backend. No mocked data, no fake state. By the end you will have a
          reviewed, exportable ledger.
        </p>
        {state.status && !inDemoMode && (
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            This backend is configured for{" "}
            <span className="mono">{state.status.categorizer_mode}</span> mode. The guided demo
            uses the demo-stub fallback; the seed and reset endpoints will return 503 here. Set{" "}
            <span className="mono">CATEGORIZER_MODE=demo_stub</span> to walk the demo locally.
          </p>
        )}
        {globalError && (
          <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {globalError}
          </p>
        )}
      </header>

      {/* Sample cleanup scenario card — names the fictional business. */}
      {state.scenario && (
        <section className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
              Sample cleanup scenario
            </p>
            <span className="rounded-full border border-surface-border bg-surface-page px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-subtle">
              Fictional sample data
            </span>
          </div>
          <h2 className="mt-2 font-display text-[20px] font-medium text-text-primary">
            {state.scenario.business_name} · {state.scenario.cleanup_month}
          </h2>
          <p className="mt-1 text-[13px] text-text-secondary">
            {state.scenario.business_type} · {state.scenario.location}
          </p>
          <p className="mt-3 max-w-3xl text-[13px] text-text-secondary">
            {state.scenario.scenario_summary}
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-1 text-[12px] text-text-secondary md:grid-cols-2">
            <li>· {state.samples?.length ?? 42} imported transactions</li>
            <li>· repeat vendors handled by rules or correction memory</li>
            <li>· ambiguous rows routed to plain-English owner questions</li>
            <li>· unresolved items flagged for accountant review</li>
            <li>· handoff package created at the end</li>
          </ul>
          <p className="mt-3 text-[11px] text-text-subtle">{state.scenario.demo_disclaimer}</p>
        </section>
      )}

      {/* What to look for — first-time-visitor framing. */}
      <section className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
          What to look for
        </p>
        <p className="mt-1 text-[13px] text-brand-900">
          In this demo, watch how LedgerLens <strong>avoids blind automation</strong>: obvious
          rows are handled by rules or correction memory, uncertain rows are routed to review,
          and only verified rows should be treated as final. The trust panel in step 6 reflects
          the persisted database — no mocked numbers.
        </p>
      </section>

      {/* Step 1: the mess */}
      <Step
        n={1}
        title="The bookkeeping mess"
        explainer={
          <>
            Every month a small-business owner sees lines like these. Some are obvious. Others
            are ambiguous or risky. A blind AI guess on a payroll run or an unfamiliar ACH
            transfer can quietly land in the wrong account and stay there until tax season.
          </>
        }
      >
        {state.samples ? (
          <ul className="mt-3 divide-y divide-surface-border rounded border border-surface-border bg-surface-panel text-[13px]">
            {state.samples.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="mono text-text-secondary">{s.transaction_date}</span>
                <span className="mr-auto pl-3 text-text-primary">{s.description}</span>
                <span className="mono text-text-primary">{formatAmount(s.amount_cents, "USD")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-text-subtle">Loading sample…</p>
        )}
      </Step>

      {/* Step 2: import */}
      <Step
        n={2}
        title="Import the messy transactions"
        explainer={
          <>
            Real call to <span className="mono">POST /demo/seed</span>. The same write path the
            CSV importer uses, just with a bundled payload tagged{" "}
            <span className="mono">source=&quot;demo&quot;</span> so the reset button can clean
            up later without touching anything else.
          </>
        }
      >
        <StepActionRow
          step={state.steps.seed}
          actionLabel={state.seeded.length > 0 ? "Imported" : "Load sample transactions"}
          onClick={handleSeed}
          disabled={state.steps.seed.status === "done" || !inDemoMode}
        />
        {state.seeded.length > 0 && (
          <p className="mt-2 text-[12px] text-text-secondary">
            Created <span className="mono">{state.seeded.length}</span> transactions. Total
            in database now: <span className="mono">{state.status?.transaction_count ?? "—"}</span>
            .
          </p>
        )}
      </Step>

      {/* Step 3: layered categorization */}
      <Step
        n={3}
        title="Layered categorization, not a single AI call"
        explainer={
          <>
            LedgerLens runs three deterministic layers before any model fires:{" "}
            <strong>correction memory → rules → demo stub (or model in anthropic mode)</strong>.
            The grouping below shows which layer decided each transaction. Most obvious vendors
            never reach the model.
          </>
        }
      >
        <StepActionRow
          step={state.steps.categorize}
          actionLabel="Run categorization"
          onClick={handleCategorize}
          disabled={
            state.seeded.length === 0 || state.steps.categorize.status === "done" || !inDemoMode
          }
        />
        {state.batchResults.length > 0 && (
          <ResultGrouping results={state.batchResults} />
        )}
      </Step>

      {/* Step 4: trust + review */}
      <Step
        n={4}
        title="Trust and review — uncertainty is a feature"
        explainer={
          <>
            Ambiguous transactions are not silently accepted. The Amazon order, the unknown ACH
            transfer, and any vendor the deterministic layer cannot place safely land in{" "}
            <Link href="/review" className="text-brand-700 underline">
              /review
            </Link>{" "}
            so a human makes the final call.
          </>
        }
      >
        {state.reviewQueue && (
          <p className="mt-2 text-[13px] text-text-secondary">
            <span className="mono">{state.reviewQueue.total}</span> transaction
            {state.reviewQueue.total === 1 ? "" : "s"} routed to review.
            {reviewItem && (
              <>
                {" "}
                Example: <span className="mono">{reviewItem.transaction.description}</span> —{" "}
                <span className="text-text-subtle">
                  {reviewItem.latest_result.explanation.slice(0, 140)}…
                </span>
              </>
            )}
          </p>
        )}
      </Step>

      {/* Step 5: correct → memory */}
      <Step
        n={5}
        title="Human correction becomes reusable bookkeeping memory"
        explainer={
          <>
            When a reviewer corrects a transaction, LedgerLens stores a deterministic{" "}
            <span className="mono">(merchant, description) → category</span> rule. The next
            matching transaction is categorized from that memory at <strong>zero model cost</strong>.
            This is rule lookup, not model training.
          </>
        }
      >
        <StepActionRow
          step={state.steps.correct}
          actionLabel="Correct the top review item"
          onClick={handleCorrect}
          disabled={
            !reviewItem || state.steps.correct.status === "done" || !inDemoMode
          }
        />
        {state.memorySource && (
          <div className="mt-3 rounded border border-surface-border bg-surface-panel p-3 text-[13px]">
            <p className="text-text-primary">
              Corrected{" "}
              <span className="mono">{state.memorySource.source.description}</span> →{" "}
              <span className="mono">[6060] Office Supplies</span>.
            </p>
            <p className="mt-1 text-[12px] text-text-secondary">
              A correction-memory row is now active for this merchant key. Replay the same
              transaction through the pipeline and watch memory win without calling the
              fallback.
            </p>
            <div className="mt-3">
              <StepActionRow
                step={state.steps.rerun}
                actionLabel="Re-categorize the same transaction"
                onClick={handleMemoryReplay}
                disabled={state.steps.rerun.status === "done"}
              />
            </div>
            {state.memoryRepeat && (
              <p className="mt-2 text-[13px] text-text-primary">
                Result:{" "}
                <ProviderBadge provider={state.memoryRepeat.result.model_provider} />{" "}
                <span className="mono">
                  [{state.memoryRepeat.result.predicted_category_code}]
                </span>{" "}
                {state.memoryRepeat.result.predicted_category_name}, confidence{" "}
                <span className="mono">
                  {formatConfidence(state.memoryRepeat.result.confidence)}
                </span>
                , cost{" "}
                <span className="mono">
                  ${state.memoryRepeat.result.estimated_cost_usd.toFixed(4)}
                </span>
                .
              </p>
            )}
          </div>
        )}
      </Step>

      {/* Step 6: ledger */}
      <Step
        n={6}
        title="The final output is a procedurally verified categorization, not an AI answer"
        explainer={
          <>
            LedgerLens does not claim the model is perfect.{" "}
            <strong>It verifies what becomes final.</strong> Auto-approved and corrected
            transactions are finalized; unresolved review items are explicitly flagged and
            excluded. The trust panel below reflects the persisted database — no mocked
            numbers.
          </>
        }
      >
        <StepActionRow
          step={state.steps.ledger}
          actionLabel="Load the ledger"
          onClick={handleLoadLedger}
          disabled={state.steps.ledger.status === "done"}
        />
        {state.ledger && (
          <>
            <TrustPanel trust={state.ledger.trust} variant="demo" />
            <DemoOutcome ledger={state.ledger} />
            <div className="mt-3 rounded border border-surface-border bg-surface-panel p-3 text-[13px]">
              <p>
                Finalized rows:{" "}
                <span className="mono">{state.ledger.total - state.ledger.unresolved}</span>{" "}
                · Unresolved:{" "}
                <span className="mono text-amber-800">{state.ledger.unresolved}</span> · Total:{" "}
                <span className="mono">{state.ledger.total}</span>
              </p>
              <p className="mt-1 text-[12px] text-text-secondary">
                The CSV export carries the same verification status per row, so a
                bookkeeper downstream can filter unverified rows before posting.
              </p>
              <a
                href={getLedgerExportUrl()}
                className="mt-2 inline-block rounded bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Export ledger CSV ↓
              </a>
            </div>
          </>
        )}
      </Step>

      {/* Step 7: engineering proof */}
      <Step
        n={7}
        title="What this demonstrates"
        explainer={
          <>
            The same demo, viewed from an engineering lens.
          </>
        }
      >
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProofCard
            title="Full-stack workflow"
            body="FastAPI + SQLAlchemy models, SQLite for the public demo (Postgres-compatible in principle), Next.js + typed client, Railway-deployed Dockerfile builds."
          />
          <ProofCard
            title="AI-safe routing"
            body="Three deterministic layers before any model. Confidence routing. Sentinel for UNCATEGORIZABLE. Auto-approved accuracy reported separately from raw accuracy."
          />
          <ProofCard
            title="Cost control by design"
            body="Demo-stub mode runs the whole workflow at zero paid spend. Provider attribution per result. Audit event names which layer decided."
          />
          <ProofCard
            title="Human-in-the-loop"
            body="Review queue, correction memory built from real human decisions, internal state-change audit log on every action, categorization export reflects review state."
          />
          <ProofCard
            title="Eval awareness"
            body="Routing, calibration (ECE / MCE / high-confidence warning), confusion-pair reporting, separated model-only vs deterministic calibration."
          />
          <ProofCard
            title="Honest scope"
            body="Rules-only accuracy on the synthetic dataset is 0% by design (tenant-COA mismatch), and the eval report says so. The project does not overclaim production readiness."
          />
        </ul>
        <p className="mt-4 text-[13px] text-text-secondary">
          More:{" "}
          <Link href="/evals" className="text-brand-700 underline">
            eval evidence
          </Link>{" "}
          ·{" "}
          <Link href="/rules" className="text-brand-700 underline">
            rule layer
          </Link>{" "}
          ·{" "}
          <Link href="/corrections" className="text-brand-700 underline">
            learned corrections
          </Link>
        </p>
      </Step>
    </AppShell>
  );
}

function Step({
  n,
  title,
  explainer,
  children,
}: {
  n: number;
  title: string;
  explainer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 rounded-lg border border-brand-200 bg-brand-100 p-5">
      <div className="flex items-baseline gap-3">
        <span className="mono rounded bg-brand-600 px-2 py-0.5 text-[12px] font-medium text-white">
          Step {n}
        </span>
        <h2 className="font-display text-[18px] font-medium text-text-primary">{title}</h2>
      </div>
      <p className="mt-2 max-w-3xl text-[13px] text-text-secondary">{explainer}</p>
      {children}
    </section>
  );
}

function StepActionRow({
  step,
  actionLabel,
  onClick,
  disabled,
}: {
  step: StepState;
  actionLabel: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || step.status === "running"}
        className="rounded bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
      >
        {step.status === "running" ? "Working…" : actionLabel}
      </button>
      {step.status === "done" && (
        <span className="text-[12px] text-brand-700">✓ done</span>
      )}
      {step.error && (
        <span className="text-[12px] text-red-700">{step.error}</span>
      )}
    </div>
  );
}

function ResultGrouping({ results }: { results: CategorizationResult[] }) {
  const groups = useMemo(() => {
    const m: Record<string, CategorizationResult[]> = {};
    for (const r of results) {
      const k = r.model_provider;
      if (!m[k]) m[k] = [];
      m[k].push(r);
    }
    return m;
  }, [results]);
  const order = ["correction_memory", "rule_categorizer", "demo_stub", "anthropic"];
  const sortedProviders = Object.keys(groups).sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  return (
    <div className="mt-3 space-y-3">
      {sortedProviders.map((p) => (
        <div
          key={p}
          className="rounded border border-surface-border bg-surface-panel p-3"
        >
          <p className="mb-2 flex items-baseline gap-2 text-[13px]">
            <ProviderBadge provider={p} />
            <span className="text-text-secondary">
              {groups[p].length} transaction{groups[p].length === 1 ? "" : "s"}
            </span>
          </p>
          <ul className="space-y-1 text-[12px] text-text-secondary">
            {groups[p].slice(0, 5).map((r) => (
              <li key={r.id} className="mono">
                [{r.predicted_category_code}] {r.predicted_category_name} ·{" "}
                {formatConfidence(r.confidence)} · ${r.estimated_cost_usd.toFixed(4)}
              </li>
            ))}
            {groups[p].length > 5 && (
              <li className="text-text-subtle">…and {groups[p].length - 5} more</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${providerTone(provider)}`}
    >
      {providerLabel(provider)}
    </span>
  );
}

function ProofCard({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded border border-surface-border bg-surface-panel p-3 text-[13px]">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-text-secondary">{body}</p>
    </li>
  );
}

function DemoOutcome({ ledger }: { ledger: Ledger }) {
  const trust = ledger.trust;
  const allVerified = trust.unverified_finalized_count === 0 && trust.finalized_count > 0;
  const tone = allVerified
    ? "border-brand-600 bg-brand-100"
    : trust.finalized_count === 0
      ? "border-surface-border bg-surface-panel"
      : "border-amber-400 bg-amber-50";
  return (
    <div className={`mt-3 rounded-lg border-2 p-4 ${tone}`}>
      <p className="font-display text-[15px] font-medium text-text-primary">
        {allVerified
          ? "Every finalized row in this demo ledger is verified before export."
          : trust.finalized_count === 0
            ? "Nothing finalized yet."
            : "Finish review to reach a fully verified demo ledger."}
      </p>
      <p className="mt-1 text-[12px] text-text-secondary">
        {allVerified
          ? "Verification rate is 100% — every row is backed by a deterministic rule, a correction-memory replay, or a human review."
          : trust.finalized_count === 0
            ? "Run categorization and review the uncertain items above to populate the procedurally verified categorization."
            : `${trust.unverified_finalized_count} finalized row${
                trust.unverified_finalized_count === 1 ? "" : "s"
              } still need human sign-off before the ledger can be considered verified.`}
      </p>
    </div>
  );
}
