import type { CleanupImpact } from "@/lib/api/client";

/**
 * Conservative cleanup-impact summary surfaced to small-business owners.
 *
 * Two estimate inputs come from the backend (see
 * `backend/src/ledgerlens/services/handoff.py`): 1.5 minutes saved per
 * deterministic auto-approval, 2.0 minutes per correction-memory replay.
 * The "estimate" framing is loud on purpose — this is not a financial
 * guarantee, just a back-of-envelope figure to anchor the value.
 */
export function CleanupImpactSummary({
  impact,
  variant = "default",
}: {
  impact: CleanupImpact;
  variant?: "default" | "compact";
}) {
  const minutes = impact.estimated_minutes_saved;
  const hours = minutes >= 60 ? (minutes / 60).toFixed(1) : null;

  return (
    <section
      className={
        variant === "compact"
          ? "rounded-lg border border-brand-200 bg-brand-100 p-4"
          : "rounded-lg border-2 border-brand-600 bg-brand-100 p-5"
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
        Cleanup impact (estimate)
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <p className="font-display text-[clamp(28px,6vw,40px)] font-medium leading-none text-brand-900">
          ~{hours ? `${hours} h` : `${Math.round(minutes)} min`}
        </p>
        <p className="text-[13px] text-brand-800">
          estimated owner time saved on this month&apos;s cleanup
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Transactions imported" value={impact.transactions_imported} />
        <Tile
          label="Handled by rules / memory"
          value={impact.handled_by_rules_or_memory}
          help="zero-cost, deterministic"
        />
        <Tile
          label="Replayed from memory"
          value={impact.handled_by_correction_memory}
          help="prior human corrections"
        />
        <Tile label="Routed to review" value={impact.routed_to_review} />
        <Tile label="Corrections learned" value={impact.corrections_learned} />
      </div>

      <p className="mt-3 text-[11px] text-brand-700">
        <strong>How this is estimated:</strong> 1.5 min per deterministic
        auto-approval, 2.0 min per correction-memory replay. Review-required
        items are <em>not</em> counted — those still need your time. This is a
        rough figure, not a financial guarantee.
      </p>
    </section>
  );
}

function Tile({
  label,
  value,
  help,
}: {
  label: string;
  value: number;
  help?: string;
}) {
  return (
    <div className="rounded border border-surface-border bg-surface-panel p-3">
      <p className="field-label">{label}</p>
      <p className="mt-1 font-display text-[20px] font-medium text-text-primary">{value}</p>
      {help && <p className="mt-0.5 text-[11px] text-text-subtle">{help}</p>}
    </div>
  );
}
