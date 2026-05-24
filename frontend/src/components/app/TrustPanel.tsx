import type { LedgerTrust } from "@/lib/api/types";

type Variant = "default" | "demo";

function formatRate(rate: number): string {
  // The verification rate is 1.0 by definition when there are no finalized
  // rows — render that as "—" instead of a misleading 100%.
  return `${(rate * 100).toFixed(0)}%`;
}

export function TrustPanel({
  trust,
  variant = "default",
}: {
  trust: LedgerTrust;
  variant?: Variant;
}) {
  const hasFinalized = trust.finalized_count > 0;
  const allVerified = trust.unverified_finalized_count === 0;
  const headlineRate = hasFinalized ? formatRate(trust.verification_rate) : "—";
  const tone = !hasFinalized
    ? "border-surface-border bg-surface-panel"
    : allVerified
      ? "border-brand-600 bg-brand-100"
      : "border-amber-400 bg-amber-50";

  return (
    <section className={`mt-4 rounded-lg border-2 p-5 ${tone}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-[18px] font-medium text-text-primary">
          {variant === "demo"
            ? "Workflow trust metric — finalized demo rows"
            : "Workflow trust metric — finalized rows"}
        </h3>
        <span
          className={`mono text-[22px] font-medium ${
            allVerified && hasFinalized ? "text-brand-700" : "text-text-primary"
          }`}
        >
          {headlineRate}
          <span className="ml-1 text-[12px] font-normal text-text-subtle">
            procedurally verified
          </span>
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[13px] text-text-secondary">
        Verification is <strong>procedural</strong>: a finalized row counts only when it
        was decided through a defensible path — a deterministic rule auto-approval, a
        correction-memory replay of a prior human decision, or an explicit human review.
        Unreviewed model auto-approvals and demo-stub results are <strong>not</strong>{" "}
        verified, even when the model returns high confidence.{" "}
        <em>
          This is a workflow trust boundary, not a guarantee of accounting or tax
          correctness, and not a substitute for CPA review.
        </em>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Finalized rows" value={trust.finalized_count} />
        <Tile
          label="Verified"
          value={trust.verified_count}
          tone={allVerified && hasFinalized ? "good" : "neutral"}
        />
        <Tile
          label="Silently finalized uncertain"
          value={trust.unverified_finalized_count}
          tone={trust.unverified_finalized_count > 0 ? "warn" : "neutral"}
        />
        <Tile
          label="Review-required"
          value={trust.review_required_count}
          tone={trust.review_required_count > 0 ? "warn" : "neutral"}
        />
        <Tile
          label="Deterministic-backed"
          value={trust.deterministic_count}
          help="memory + rules"
        />
        <Tile
          label="Human-reviewed"
          value={trust.human_reviewed_count}
          help="approved or corrected"
        />
      </div>
      {trust.unverified_finalized_count > 0 && (
        <p className="mt-3 text-[12px] text-amber-900">
          <strong>{trust.unverified_finalized_count}</strong> finalized row
          {trust.unverified_finalized_count === 1 ? "" : "s"} ended in{" "}
          <span className="mono">auto_approved</span> without going through a deterministic
          rule, correction memory, or human review. Send these to the review queue before
          treating the categorization as final.
        </p>
      )}
    </section>
  );
}

function Tile({
  label,
  value,
  tone = "neutral",
  help,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "neutral";
  help?: string;
}) {
  const valueClass =
    tone === "good"
      ? "text-brand-700"
      : tone === "warn"
        ? "text-amber-800"
        : "text-text-primary";
  return (
    <div className="rounded border border-surface-border bg-surface-panel p-3">
      <p className="field-label">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-medium ${valueClass}`}>{value}</p>
      {help && <p className="mt-0.5 text-[11px] text-text-subtle">{help}</p>}
    </div>
  );
}
