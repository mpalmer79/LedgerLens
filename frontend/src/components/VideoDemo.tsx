import Link from "next/link";

import { GeneratedWalkthrough } from "@/components/marketing/GeneratedWalkthrough";
import { LOOM_URL } from "@/lib/site";

const STORYBOARD: { step: number; label: string }[] = [
  { step: 1, label: "Import this month's bank activity" },
  { step: 2, label: "Obvious vendors handled first" },
  { step: 3, label: "Uncertain rows become owner questions" },
  { step: 4, label: "Answers create accountant context" },
  { step: 5, label: "Verified rows stay separated from review" },
  { step: 6, label: "Export the accountant handoff package" },
];

export function VideoDemo() {
  const hasLoom = LOOM_URL.length > 0;

  return (
    <section className="mx-auto max-w-5xl px-8">
      <div className="rounded-lg border border-surface-border bg-surface-panel p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Video / generated walkthrough takes 3/5; storyboard takes 2/5. */}
          <div className="lg:col-span-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-[22px] font-medium text-text-primary">
                Watch the cleanup-to-handoff flow
              </h2>
              {!hasLoom && (
                <span className="inline-flex items-center rounded-full border border-surface-border bg-surface-page px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-subtle">
                  Generated walkthrough
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-text-secondary">
              See messy monthly transactions become a verified accountant handoff package
              — through obvious-vendor rules, owner questions, and verified-vs-review
              separation.
            </p>
            <div className="mt-4 aspect-video w-full overflow-hidden rounded-md border border-surface-border bg-surface-sunken">
              {hasLoom ? (
                <iframe
                  src={LOOM_URL}
                  title="LedgerLens cleanup-to-handoff walkthrough"
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full"
                />
              ) : (
                <GeneratedWalkthrough />
              )}
            </div>
            {!hasLoom && (
              <p className="mt-2 text-[11px] text-text-subtle">
                This animation shows the same monthly cleanup journey a real Loom can
                replace later. Set <span className="mono">NEXT_PUBLIC_LOOM_URL</span> on
                the deploy to swap it.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/cleanup"
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Start monthly cleanup →
              </Link>
              <Link
                href="/handoff"
                className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
              >
                View accountant handoff
              </Link>
              <Link
                href="/technical-story"
                className="inline-flex items-center text-[12px] font-medium text-text-secondary hover:text-text-primary"
              >
                Read the technical story →
              </Link>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="field-label">Mini storyboard</p>
            <ol className="mt-3 space-y-2 text-[13px]">
              {STORYBOARD.map((s) => (
                <li
                  key={s.step}
                  className="flex items-start gap-2 rounded border border-surface-border bg-surface-page p-2"
                >
                  <span className="mono mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-medium text-brand-800">
                    {s.step}
                  </span>
                  <span className="text-text-primary">{s.label}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-text-subtle">
              {hasLoom
                ? "The storyboard matches the recording and the live /cleanup workflow."
                : "Storyboard matches the live /cleanup workflow. Walk it for real to watch the handoff package fill in from the persisted database."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
