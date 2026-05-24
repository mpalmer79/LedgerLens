"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { CleanupImpactSummary } from "@/components/app/CleanupImpactSummary";
import { TrustPanel } from "@/components/app/TrustPanel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/DataState";
import {
  getHandoff,
  getHandoffMarkdownUrl,
  getLedgerExportUrl,
  type HandoffResponse,
} from "@/lib/api/client";
import { formatAmount } from "@/lib/format";

type State = {
  loading: boolean;
  error: unknown;
  handoff: HandoffResponse | null;
  /** "markdown" | "csv" — set when the user clicks a download link. */
  downloadStatus: { kind: "markdown" | "csv"; ok: boolean | null } | null;
};

export default function HandoffPage() {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    handoff: null,
    downloadStatus: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await getHandoff();
      setState({ loading: false, error: null, handoff: data, downloadStatus: null });
    } catch (err) {
      setState({ loading: false, error: err, handoff: null, downloadStatus: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Probe the export URL with a HEAD request so we can show an inline error
   *  if the backend would 500 instead of letting the browser silently fail. */
  const handleDownload = useCallback(
    async (kind: "markdown" | "csv", url: string) => {
      setState((s) => ({ ...s, downloadStatus: { kind, ok: null } }));
      try {
        const probe = await fetch(url, { method: "HEAD" });
        if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
        // Trigger the actual download in a new tab/window so the browser
        // handles Content-Disposition.
        window.location.assign(url);
        setState((s) => ({ ...s, downloadStatus: { kind, ok: true } }));
      } catch {
        setState((s) => ({ ...s, downloadStatus: { kind, ok: false } }));
      }
    },
    [],
  );

  const handoff = state.handoff;

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Accountant handoff package
        </p>
        <h1 className="mt-2 font-display text-[clamp(24px,5vw,32px)] font-medium leading-tight text-text-primary">
          {handoff?.scenario
            ? `${handoff.scenario.business_name} — ${handoff.scenario.cleanup_month} handoff`
            : (handoff?.cleanup_period_label ?? "Accountant handoff package")}
        </h1>
        {handoff?.scenario && (
          <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-md border border-surface-border bg-surface-panel px-3 py-1.5 text-[12px] text-text-secondary">
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
              Sample data
            </span>
            <span>
              {handoff.scenario.business_type} · {handoff.scenario.location}
            </span>
          </p>
        )}
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          {handoff?.scenario
            ? "This demo handoff shows how procedurally verified rows, owner answers, unresolved items, and learned corrections would be packaged for accountant review."
            : "A reviewed categorization summary with unresolved questions, review notes, and the correction memory you saved this month. Paste it into an email or download the markdown to forward to your bookkeeper or accountant for substantive review."}
        </p>
        <p className="mt-2 max-w-3xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          This is a <strong>handoff package</strong>, not CPA-reviewed books.
          &ldquo;Verified&rdquo; means a defensible authority (rule, correction memory,
          or human review) signed off on each row procedurally — it is not a guarantee
          of accounting or tax correctness, and it is not a substitute for accounting
          review.
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

      {state.loading && <LoadingState label="Loading the handoff package…" />}

      {/* No-handoff empty state when the DB is empty (zero finalized rows AND
       *  zero needs-review items). The trust block still renders fine, but
       *  the "0 of 0" reads as broken to a casual visitor. */}
      {!state.loading &&
        state.error === null &&
        handoff !== null &&
        handoff.trust.finalized_count === 0 &&
        handoff.needs_review.length === 0 && (
          <EmptyState
            title="No handoff package yet"
            message="Seed the sample scenario or import a CSV to produce a verified handoff package."
            action={
              <Link
                href="/cleanup"
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Start monthly cleanup →
              </Link>
            }
            secondaryAction={
              <Link
                href="/demo"
                className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
              >
                Try the sample scenario
              </Link>
            }
          />
        )}

      {handoff && (
        <>
          <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrustPanel trust={handoff.trust} />
            <CleanupImpactSummary impact={handoff.impact} variant="compact" />
          </section>

          <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-surface-border bg-surface-panel p-4">
              <button
                type="button"
                onClick={() => void handleDownload("markdown", getHandoffMarkdownUrl())}
                disabled={state.downloadStatus?.kind === "markdown" && state.downloadStatus.ok === null}
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-60"
              >
                Download handoff summary (markdown)
              </button>
              <p className="mt-2 text-[12px] text-text-secondary">
                Use this for accountant context or email handoff. Includes the cleanup
                summary, ready-for-accountant rows, unresolved items, owner answers, and
                corrections learned.
              </p>
              {state.downloadStatus?.kind === "markdown" && state.downloadStatus.ok === false && (
                <p
                  role="alert"
                  className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800"
                >
                  Could not download the markdown handoff. Please try again, or use the CSV
                  export.
                </p>
              )}
            </div>
            <div className="rounded-md border border-surface-border bg-surface-panel p-4">
              <button
                type="button"
                onClick={() => void handleDownload("csv", getLedgerExportUrl())}
                disabled={state.downloadStatus?.kind === "csv" && state.downloadStatus.ok === null}
                className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken disabled:opacity-60"
              >
                Download full ledger CSV
              </button>
              <p className="mt-2 text-[12px] text-text-secondary">
                Use this for ledger import or spreadsheet review. Every row carries a
                per-row <span className="mono">verified</span> column so downstream tooling
                can filter unverified rows.
              </p>
              {state.downloadStatus?.kind === "csv" && state.downloadStatus.ok === false && (
                <p
                  role="alert"
                  className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800"
                >
                  Could not download the ledger CSV. Please try again, or use the markdown
                  handoff.
                </p>
              )}
            </div>
          </section>

          <p className="mt-3 text-[12px] text-text-subtle">
            This is not tax advice or a substitute for accounting review. It is a cleanup
            and handoff aid.
          </p>

          {/* Ready for accountant */}
          <Section
            title="Ready for accountant"
            subtitle="Verified finalized rows — backed by review, correction memory, or a deterministic rule."
            count={handoff.ready_for_accountant.length}
          >
            {handoff.ready_for_accountant.length === 0 ? (
              <p className="text-[13px] text-text-subtle">
                No finalized verified rows yet. Finish review and verification first.
              </p>
            ) : (
              <ul className="divide-y divide-surface-border overflow-hidden rounded border border-surface-border">
                {handoff.ready_for_accountant.slice(0, 25).map((r) => (
                  <li key={r.transaction_id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      <span className="mono text-text-subtle">{r.transaction_date}</span>{" "}
                      {r.description}
                    </span>
                    <span className="mono text-text-subtle">
                      [{r.category_code}] {r.category_name}
                    </span>
                    <span className="mono text-text-primary">
                      {formatAmount(r.amount_cents, r.currency)}
                    </span>
                  </li>
                ))}
                {handoff.ready_for_accountant.length > 25 && (
                  <li className="px-3 py-2 text-[12px] text-text-subtle">
                    …and {handoff.ready_for_accountant.length - 25} more. Use the markdown
                    export or CSV for the full list.
                  </li>
                )}
              </ul>
            )}
          </Section>

          {/* Needs review */}
          <Section
            title="Needs owner / accountant review"
            subtitle="Transactions LedgerLens could not safely finalize. Resolve in the questions or review queue."
            count={handoff.needs_review.length}
            tone={handoff.needs_review.length > 0 ? "warn" : "default"}
          >
            {handoff.needs_review.length === 0 ? (
              <p className="text-[13px] text-text-subtle">
                No outstanding review items. Nothing blocking the handoff.
              </p>
            ) : (
              <ul className="divide-y divide-amber-200/60 overflow-hidden rounded border border-amber-300 bg-amber-50/50">
                {handoff.needs_review.slice(0, 25).map((r) => (
                  <li
                    key={r.transaction_id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-[13px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      <span className="mono text-text-subtle">{r.transaction_date}</span>{" "}
                      {r.description}
                    </span>
                    <span className="mono text-text-primary">
                      {formatAmount(r.amount_cents, r.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/questions"
                className="text-[12px] text-brand-700 underline hover:text-brand-800"
              >
                Open the questions workflow →
              </Link>
              <Link
                href="/review"
                className="text-[12px] text-brand-700 underline hover:text-brand-800"
              >
                Open the review queue →
              </Link>
            </div>
          </Section>

          {/* Owner answers */}
          <Section
            title="Questions answered by owner"
            subtitle="Plain-English answers captured during review. v2 answers show the question, the chosen answer, and the optional free-text note. Forward these with the export so the accountant has context."
            count={handoff.owner_answers.length}
          >
            {handoff.owner_answers.length === 0 ? (
              <p className="text-[13px] text-text-subtle">
                No owner notes captured this period.
              </p>
            ) : (
              <ul className="space-y-2">
                {handoff.owner_answers.map((a) => {
                  const isV2 = a.owner_question_key != null;
                  const followUp = a.accountant_follow_up_required;
                  return (
                    <li
                      key={a.transaction_id + (a.owner_question_key ?? a.answer)}
                      className={
                        followUp
                          ? "rounded border border-amber-300 bg-amber-50 p-3 text-[13px]"
                          : "rounded border border-surface-border bg-surface-page p-3 text-[13px]"
                      }
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-text-primary">
                          <span className="mono text-[11px] text-text-subtle">
                            {a.transaction_date}
                          </span>{" "}
                          {a.transaction_description}
                        </p>
                        <p className="mono text-[12px] text-text-primary">
                          {formatAmount(a.amount_cents, a.currency)}
                        </p>
                      </div>
                      {followUp && (
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-amber-700">
                          Needs accountant follow-up
                        </p>
                      )}
                      {isV2 ? (
                        <>
                          {a.owner_question_text && (
                            <p className="mt-1 text-[12px] text-text-secondary">
                              <span className="font-medium">Question:</span>{" "}
                              {a.owner_question_text}
                            </p>
                          )}
                          {a.owner_answer_label && (
                            <p className="mt-1 text-[13px] text-text-primary">
                              <span className="font-medium">Owner answer:</span>{" "}
                              {a.owner_answer_label}
                            </p>
                          )}
                          {a.owner_note && a.owner_note.trim() && (
                            <p className="mt-1 text-[12px] text-text-secondary">
                              <span className="font-medium">Owner note:</span>{" "}
                              {a.owner_note}
                            </p>
                          )}
                          {a.suggested_resolution && (
                            <p className="mt-1 text-[11px] text-text-subtle">
                              Suggested resolution:{" "}
                              <span className="mono">{a.suggested_resolution}</span>
                            </p>
                          )}
                          {a.selected_category_code && (
                            <p className="mt-1 text-[11px] text-text-subtle">
                              Resolved category:{" "}
                              <span className="mono">[{a.selected_category_code}]</span>{" "}
                              {a.selected_category_name}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-text-secondary">
                          {a.selected_category_code ? (
                            <>
                              <span className="mono text-text-subtle">
                                [{a.selected_category_code}]
                              </span>{" "}
                              {a.selected_category_name}{" "}
                              <span className="text-text-subtle">·</span>{" "}
                            </>
                          ) : null}
                          <em>{a.answer}</em>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Corrections */}
          <Section
            title="Corrections learned this month"
            subtitle="Each row is a deterministic (merchant → category) rule the system will reuse for similar future transactions at zero model cost."
            count={handoff.corrections_learned.length}
          >
            {handoff.corrections_learned.length === 0 ? (
              <p className="text-[13px] text-text-subtle">
                No new correction-memory rules saved this period.
              </p>
            ) : (
              <ul className="divide-y divide-surface-border overflow-hidden rounded border border-surface-border">
                {handoff.corrections_learned.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-[13px]"
                  >
                    <span className="mono text-text-primary">
                      {c.merchant_key || "—"}
                    </span>
                    <span className="mono text-text-subtle">
                      → [{c.selected_category_code}] · {c.match_count} matches
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Honesty footer */}
          <section className="mt-8 rounded-md border border-surface-border bg-surface-panel p-4 text-[12px] text-text-secondary">
            <p>
              <strong>Trust metric is workflow-level, not raw model accuracy.</strong> A
              row counts as verified only when it came from a rule auto-approval, a
              correction-memory replay, or an explicit human review. Raw model
              performance is reported separately on{" "}
              <Link href="/evals" className="text-brand-700 underline">
                /evals
              </Link>
              .
            </p>
            <p className="mt-2">
              Estimated owner time saved is a conservative figure (1.5 min per
              deterministic auto-approval, 2.0 min per memory replay). It is not a
              financial guarantee.
            </p>
          </section>
        </>
      )}
    </AppShell>
  );
}

function Section({
  title,
  subtitle,
  count,
  tone = "default",
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  tone?: "default" | "warn";
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[18px] font-medium text-text-primary">{title}</h2>
        <span
          className={
            tone === "warn"
              ? "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
              : "rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800"
          }
        >
          {count}
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[13px] text-text-secondary">{subtitle}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}
