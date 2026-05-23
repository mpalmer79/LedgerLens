import {
  ClipboardCheck,
  Database,
  Filter,
  Sparkles,
  UserCheck,
} from "lucide-react";

type Variant = "default" | "compact";

type Step = {
  icon: React.ReactNode;
  label: string;
  explainer: string;
  tone: "neutral" | "deterministic" | "review" | "final";
};

const STEPS: Step[] = [
  {
    icon: <Database size={18} className="text-text-secondary" />,
    label: "Messy transactions",
    explainer:
      "Cryptic merchant strings, payroll runs, vague ACH transfers — the monthly cleanup problem.",
    tone: "neutral",
  },
  {
    icon: <Sparkles size={18} className="text-brand-700" />,
    label: "Correction memory",
    explainer:
      "Prior human corrections replay at zero cost. The system learns deterministically, not through model training.",
    tone: "deterministic",
  },
  {
    icon: <Filter size={18} className="text-brand-700" />,
    label: "Deterministic rules",
    explainer:
      "A curated rule table for obvious vendors (QuickBooks, Zoom, Staples). High confidence, zero cost, auditable.",
    tone: "deterministic",
  },
  {
    icon: <UserCheck size={18} className="text-amber-700" />,
    label: "Review routing",
    explainer:
      "Anything uncertain — demo-stub fallback or mid-confidence model — goes to a human. No silent guessing on financial data.",
    tone: "review",
  },
  {
    icon: <ClipboardCheck size={18} className="text-brand-700" />,
    label: "Verified ledger export",
    explainer:
      "Only rows backed by review, memory, or a rule auto-approval are counted as finalized. The CSV carries a per-row verified column.",
    tone: "final",
  },
];

function toneClasses(tone: Step["tone"]): string {
  switch (tone) {
    case "deterministic":
      return "border-brand-200 bg-brand-100";
    case "review":
      return "border-amber-200 bg-amber-50";
    case "final":
      return "border-brand-600 bg-brand-100 ring-1 ring-brand-600/30";
    default:
      return "border-surface-border bg-surface-panel";
  }
}

export function TrustPipeline({ variant = "default" }: { variant?: Variant }) {
  const compact = variant === "compact";
  return (
    <div
      className={
        compact
          ? "grid grid-cols-1 gap-2 sm:grid-cols-5"
          : "grid grid-cols-1 gap-3 md:grid-cols-5"
      }
      role="list"
      aria-label="LedgerLens layered categorization pipeline"
    >
      {STEPS.map((step, i) => (
        <div
          key={step.label}
          role="listitem"
          className={`relative rounded-lg border p-3 ${toneClasses(step.tone)}`}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-panel">
              {step.icon}
            </span>
            <span className="text-[12px] font-medium uppercase tracking-wide text-text-subtle">
              Step {i + 1}
            </span>
          </div>
          <p className="mt-2 font-display text-[14px] font-medium text-text-primary">
            {step.label}
          </p>
          {!compact && (
            <p className="mt-1 text-[12px] leading-snug text-text-secondary">
              {step.explainer}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
