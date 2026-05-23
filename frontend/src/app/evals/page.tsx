import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { ComparisonChart } from "@/components/evals/ComparisonChart";
import { ReliabilityChart } from "@/components/evals/ReliabilityChart";
import { Logomark } from "@/components/ui/Logomark";
import {
  adversarialDeepDive,
  loadDataset,
  loadLatestComparison,
  loadLatestEvalRun,
  loadStubBaseline,
  summarizePerBusiness,
} from "@/lib/evals";

const REPO_URL = "https://github.com/mpalmer79/LedgerLens";
const ARCHITECTURE_URL = `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`;

function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function dollars(v: number, digits = 2): string {
  return `$${v.toFixed(digits)}`;
}

function amountFromCents(cents: number): string {
  const v = cents / 100;
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
}

export default function EvalsPage() {
  const run = loadLatestEvalRun();
  const stub = loadStubBaseline();
  const dataset = run ? loadDataset(run.run_metadata.dataset_version) : null;
  const comparison = loadLatestComparison();
  const routing = run?.metrics.overall.routing;
  const calibration = run?.metrics.overall.calibration;
  const calibrationWarning =
    calibration?.model_only?.warning ?? calibration?.overall?.warning ?? null;
  const topConfusions = run?.metrics.overall.top_confusions ?? [];

  return (
    <div className="bg-surface-page text-text-primary min-h-screen">
      {/* Top nav (mirrors landing) */}
      <nav className="border-b border-surface-border px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Logomark size={24} className="text-brand-600" />
            <span className="font-display text-[18px] font-medium">LedgerLens</span>
          </Link>
          <div className="flex items-center gap-6 text-[13px]">
            <Link
              href="/evals"
              className="text-text-primary"
              aria-current="page"
            >
              Eval results
            </Link>
            <a
              href={ARCHITECTURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary"
            >
              Architecture
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-8 pt-12 pb-24">
        {/* a. Header */}
        <header>
          <h1 className="font-display text-[36px] font-medium text-text-primary">Eval results</h1>
          {run ? (
            <>
              <p className="mt-2 text-[15px] text-text-secondary">
                {run.run_metadata.categorizer_name} vs stub baseline ·{" "}
                {run.run_metadata.dataset_version} dataset ·{" "}
                {run.metrics.overall.transaction_count} transactions
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-surface-border pt-4 text-[12px] text-text-subtle">
                <span>
                  <span className="field-label mr-2">Run timestamp</span>
                  <span className="mono">{run.run_metadata.timestamp_utc}</span>
                </span>
                <span>
                  <span className="field-label mr-2">Dataset</span>
                  <span className="mono">{run.run_metadata.dataset_version}</span>
                </span>
                <span>
                  <span className="field-label mr-2">Artifact</span>
                  <a
                    className="mono text-brand-600 hover:text-brand-500"
                    href={`${REPO_URL}/blob/main/evals/runs/${run.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {run.filename}
                  </a>
                </span>
                {run.run_metadata.git_sha && (
                  <span>
                    <span className="field-label mr-2">Git SHA</span>
                    <span className="mono">{run.run_metadata.git_sha.slice(0, 10)}</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-severity-high">
              No eval run found. Trigger the &quot;Run eval&quot; workflow from the Actions tab
              to populate this page.
            </p>
          )}
        </header>

        {run && (
          <>
            {/* Layered pipeline summary */}
            <section className="mt-8 rounded-md border border-brand-200 bg-brand-100 p-4">
              <p className="text-[14px] font-medium text-text-primary">
                Production categorization pipeline
              </p>
              <ol className="mono mt-2 list-decimal space-y-1 pl-5 text-[12px] text-text-secondary">
                <li>
                  correction memory <span className="text-text-subtle">(zero cost, exact-key)</span>
                </li>
                <li>
                  deterministic rules <span className="text-text-subtle">(zero cost, curated)</span>
                </li>
                <li>
                  model fallback <span className="text-text-subtle">(Claude Haiku 4.5)</span>
                </li>
                <li>
                  confidence routing → human review → audit
                </li>
              </ol>
              <p className="mt-2 text-[12px] text-text-subtle">
                The eval below scores categorizer modes against the synthetic v0 dataset. Rule
                accuracy on this dataset is bounded by tenant-COA mismatch (see notes below) — the
                rule layer&apos;s value in production is cost reduction, not accuracy on this
                benchmark.
              </p>
            </section>

            {/* Mode comparison */}
            {comparison && comparison.runs.length > 0 && (
              <section className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="font-display text-[18px] font-medium text-text-primary">
                    Mode comparison
                  </h2>
                  <span className="text-[11px] text-text-subtle">
                    generated {comparison.generated_at}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead className="border-b border-surface-border">
                      <tr>
                        <th className="field-label py-1.5 pr-3">Mode</th>
                        <th className="field-label py-1.5 pr-3 text-right">Overall</th>
                        <th className="field-label py-1.5 pr-3 text-right">Non-adv</th>
                        <th className="field-label py-1.5 pr-3 text-right">Adv</th>
                        <th className="field-label py-1.5 pr-3 text-right">Cost / 100</th>
                        <th className="field-label py-1.5 pr-3 text-right">Auto-approve</th>
                        <th className="field-label py-1.5 pr-3 text-right">Auto acc</th>
                        <th className="field-label py-1.5 text-right">Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.runs.map((r) => (
                        <tr key={r.categorizer} className="border-b border-surface-border/40 last:border-0">
                          <td className="mono py-1.5 pr-3 text-text-primary">{r.categorizer}</td>
                          <td className="mono py-1.5 pr-3 text-right">{pct(r.overall_accuracy)}</td>
                          <td className="mono py-1.5 pr-3 text-right">{pct(r.non_adversarial_accuracy)}</td>
                          <td className="mono py-1.5 pr-3 text-right">{pct(r.adversarial_accuracy)}</td>
                          <td className="mono py-1.5 pr-3 text-right">{dollars(r.cost_per_100, 4)}</td>
                          <td className="mono py-1.5 pr-3 text-right">
                            {r.routing?.auto_approved_rate !== undefined
                              ? pct(r.routing.auto_approved_rate)
                              : "—"}
                          </td>
                          <td className="mono py-1.5 pr-3 text-right">
                            {r.routing?.auto_approved_accuracy !== undefined
                              ? pct(r.routing.auto_approved_accuracy)
                              : "—"}
                          </td>
                          <td className="mono py-1.5 text-right">
                            {r.routing?.review_rate !== undefined
                              ? pct(r.routing.review_rate)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {comparison.notes?.length > 0 && (
                  <ul className="mt-3 space-y-1 pl-5 text-[11px] text-text-subtle list-disc">
                    {comparison.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Routing summary for the latest run */}
            {routing && routing.total ? (
              <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                  label="Auto-approved"
                  value={pct(routing.auto_approved_rate ?? 0)}
                  caption={`${routing.auto_approved ?? 0} / ${routing.total}`}
                />
                <MetricCard
                  label="Auto-approved accuracy"
                  value={pct(routing.auto_approved_accuracy ?? 0)}
                  caption="trust ceiling for this run"
                />
                <MetricCard
                  label="Review rate"
                  value={pct(routing.review_rate ?? 0)}
                  caption={`${routing.needs_review ?? 0} need review`}
                />
                <MetricCard
                  label="Zero-cost share"
                  value={pct(routing.zero_cost_rate ?? 0)}
                  caption={`${routing.zero_cost ?? 0} predictions cost $0`}
                />
              </section>
            ) : null}

            {/* Calibration warning */}
            {calibrationWarning && (
              <section className="mt-6 rounded-md border border-severity-high/40 bg-severity-high/10 p-4">
                <p className="text-[14px] font-medium text-severity-high">Calibration warning</p>
                <p className="mt-1 text-[13px] text-text-primary">{calibrationWarning}</p>
                {calibration?.model_only && calibration.model_only.count > 0 && (
                  <p className="mt-2 text-[12px] text-text-secondary">
                    Model-only ECE{" "}
                    <span className="mono">{calibration.model_only.ece.toFixed(3)}</span> ·
                    MCE <span className="mono">{calibration.model_only.mce.toFixed(3)}</span>{" "}
                    (n = <span className="mono">{calibration.model_only.count}</span>).
                    Deterministic-layer confidence is rule-curated, not a probability, and is
                    reported separately.
                  </p>
                )}
              </section>
            )}

            {/* Top confusions */}
            {topConfusions.length > 0 && (
              <section className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-4">
                <h2 className="font-display text-[16px] font-medium text-text-primary">
                  Top category confusions
                </h2>
                <p className="mt-1 text-[12px] text-text-subtle">
                  Off-diagonal cells from the confusion matrix, ranked by count. These are the
                  cases the categorizer most often misroutes — and where rules / human review pay
                  off.
                </p>
                <ul className="mt-3 space-y-1 text-[13px]">
                  {topConfusions.slice(0, 5).map((c, i) => (
                    <li key={i} className="mono text-text-secondary">
                      [{c.actual}] → [{c.predicted}]:{" "}
                      <span className="text-text-primary">{c.count}</span> ·{" "}
                      {pct(c.percentage_of_actual)} of actual {c.actual}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Honesty callout — model isn't production-ready, and that's the point. */}
            <section className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-[14px] font-medium text-amber-900">
                These numbers are not production-ready — and that&apos;s why the product is
                designed the way it is.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-amber-900">
                <li>
                  Adversarial accuracy is{" "}
                  <span className="mono">{pct(run.metrics.adversarial.accuracy)}</span> — by-design
                  ambiguous cases need a human, not the model alone.
                </li>
                <li>
                  Confidence calibration is the next eval-harness upgrade; high-confidence accuracy
                  is currently lower than the displayed confidence on a meaningful share of
                  predictions.
                </li>
                <li>
                  This is exactly why the app routes low- and mid-confidence predictions to the
                  review queue, and why every prediction is one click from the underlying rationale
                  on the transaction detail page.
                </li>
              </ul>
            </section>

            {/* b. Headline metric cards */}
            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Overall accuracy"
                value={pct(run.metrics.overall.accuracy)}
                caption={`${run.run_metadata.model ?? run.run_metadata.categorizer_name} on ${run.run_metadata.dataset_version}`}
              />
              <MetricCard
                label="Non-adversarial accuracy"
                value={pct(run.metrics.non_adversarial.accuracy)}
                caption={`${run.metrics.non_adversarial.transaction_count} transactions`}
              />
              <MetricCard
                label="Adversarial accuracy"
                value={pct(run.metrics.adversarial.accuracy)}
                caption={`${run.metrics.adversarial.transaction_count} transactions, by-design ambiguous`}
              />
              <MetricCard
                label="Cost per 100 tx"
                value={dollars(run.metrics.overall.cost_per_100)}
                caption={`total ${dollars(run.metrics.overall.total_cost)} for this run`}
              />
            </section>

            {/* c. Stub vs Haiku comparison */}
            {stub && (
              <section className="mt-16">
                <h2 className="font-display text-[24px] font-medium text-text-primary">
                  Stub baseline vs Claude Haiku 4.5
                </h2>
                <p className="mt-2 text-[14px] text-text-secondary">
                  The stub baseline always predicts the first expense account in each business&apos;s
                  chart — establishing the floor any real model must beat. Haiku lifts overall
                  accuracy roughly{" "}
                  {(run.metrics.overall.accuracy / Math.max(stub.metrics.overall.accuracy, 0.001)).toFixed(1)}×
                  and shows real signal on adversarial cases.
                </p>
                <div className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
                  <ComparisonChart
                    data={[
                      {
                        slice: "Overall",
                        stub: stub.metrics.overall.accuracy,
                        haiku: run.metrics.overall.accuracy,
                      },
                      {
                        slice: "Non-adversarial",
                        stub: stub.metrics.non_adversarial.accuracy,
                        haiku: run.metrics.non_adversarial.accuracy,
                      },
                      {
                        slice: "Adversarial",
                        stub: stub.metrics.adversarial.accuracy,
                        haiku: run.metrics.adversarial.accuracy,
                      },
                    ]}
                  />
                </div>
              </section>
            )}

            {/* d. Reliability diagram */}
            <section className="mt-16">
              <h2 className="font-display text-[24px] font-medium text-text-primary">Calibration</h2>
              <p className="mt-2 text-[14px] text-text-secondary">
                Points on the diagonal indicate well-calibrated confidence — predicted probability
                matches the empirical accuracy in that bucket. Above the line means under-confident;
                below means over-confident. The dashed verticals mark the auto-post threshold (0.90)
                and the review-queue threshold (0.60). Bubble size scales with the number of
                predictions in each bucket.
              </p>
              <div className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
                <ReliabilityChart data={run.metrics.overall.reliability_diagram} />
              </div>
            </section>

            {/* e. Per-business breakdown table */}
            {dataset && (
              <section className="mt-16">
                <h2 className="font-display text-[24px] font-medium text-text-primary">
                  Per-business breakdown
                </h2>
                <p className="mt-2 text-[14px] text-text-secondary">
                  Same model, three distinct charts of accounts. Each business stresses a different
                  categorization corner — COGS-heavy, software-heavy, parts-and-labor.
                </p>
                <div className="mt-6 overflow-x-auto rounded-lg border border-brand-200 bg-brand-100">
                  <table className="w-full text-left">
                    <thead className="border-b border-surface-border">
                      <tr>
                        <th className="field-label px-4 py-3">Business</th>
                        <th className="field-label px-4 py-3 text-right">Transactions</th>
                        <th className="field-label px-4 py-3 text-right">Overall</th>
                        <th className="field-label px-4 py-3 text-right">Adversarial</th>
                        <th className="field-label px-4 py-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summarizePerBusiness(run, dataset).map((b, i) => (
                        <tr
                          key={b.business_id}
                          className={i % 2 === 1 ? "bg-surface-sunken/30" : ""}
                        >
                          <td className="px-4 py-3 text-[14px] text-text-primary">
                            {b.business_name}{" "}
                            <span className="mono ml-2 text-text-subtle">{b.business_id}</span>
                          </td>
                          <td className="mono px-4 py-3 text-right text-text-primary">
                            {b.transaction_count}
                          </td>
                          <td className="mono px-4 py-3 text-right text-text-primary">
                            {pct(b.overall_accuracy)}
                          </td>
                          <td className="mono px-4 py-3 text-right text-text-primary">
                            {b.adversarial_count > 0 ? pct(b.adversarial_accuracy) : "—"}
                            {b.adversarial_count > 0 && (
                              <span className="ml-1 text-[11px] text-text-subtle">
                                ({b.adversarial_count})
                              </span>
                            )}
                          </td>
                          <td className="mono px-4 py-3 text-right text-text-primary">
                            {dollars(b.total_cost, 3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* f. Adversarial deep-dive */}
            {dataset && (
              <section className="mt-16">
                <h2 className="font-display text-[24px] font-medium text-text-primary">
                  Where it struggles
                </h2>
                <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
                  Adversarial cases are designed to be ambiguous — they test whether the model
                  knows when to ask for help instead of guessing. Five from the{" "}
                  {run.run_metadata.dataset_version} run, sorted by how interesting the disagreement is.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {adversarialDeepDive(run, dataset, 5).map((tx) => (
                    <AdversarialCard key={tx.transaction_id} item={tx} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* g. Footer */}
        <footer className="mt-24 border-t border-surface-border pt-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            {run && (
              <a
                href={`${REPO_URL}/blob/main/evals/runs/${run.filename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-500"
              >
                Raw JSON artifact
                <ExternalLink size={12} />
              </a>
            )}
            <a
              href={`${REPO_URL}/blob/main/docs/ARCHITECTURE.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-brand-600 hover:text-brand-500"
            >
              Architecture spec
              <ExternalLink size={12} />
            </a>
            <Link href="/" className="text-text-secondary hover:text-text-primary">
              ← Back to project
            </Link>
          </div>
          {run && (
            <p className="mono mt-4 text-[11px] text-text-subtle">
              run: {run.filename}
              {run.run_metadata.git_sha
                ? ` · committed at ${run.run_metadata.git_sha.slice(0, 10)}`
                : ""}
            </p>
          )}
        </footer>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-6">
      <p className="field-label text-brand-700">{label}</p>
      <p className="mt-2 font-display text-[32px] font-medium text-text-primary">{value}</p>
      <p className="mt-1 text-[12px] text-text-subtle">{caption}</p>
    </div>
  );
}

function AdversarialCard({
  item,
}: {
  item: ReturnType<typeof adversarialDeepDive>[number];
}) {
  const badge =
    item.status === "correct"
      ? { label: "Correct", className: "bg-brand-100 text-brand-800" }
      : item.status === "routed-to-review"
        ? { label: "Routed to review", className: "bg-amber-100 text-amber-800" }
        : { label: "Incorrect", className: "bg-red-50 text-red-700" };

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[16px] font-medium text-text-primary">
            {item.raw_description}
          </p>
          <p className="mono mt-1 text-[12px] text-text-subtle">
            {amountFromCents(item.amount_cents)} · {item.business_id} · {item.transaction_id}
          </p>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <p className="field-label">Ground truth</p>
          <p className="mono mt-1 text-text-primary">
            [{item.ground_truth_code}] {item.ground_truth_name}
          </p>
        </div>
        <div>
          <p className="field-label">Predicted</p>
          <p className="mono mt-1 text-text-primary">
            [{item.predicted_code}] {item.predicted_name}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${item.confidence * 100}%` }}
            />
          </div>
          <span className="mono text-[12px] text-text-secondary">
            {item.confidence.toFixed(2)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[12px] italic leading-relaxed text-text-secondary">
        {item.reasoning}
      </p>
    </div>
  );
}
