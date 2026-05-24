import Link from "next/link";

import { GeneratedWalkthrough } from "@/components/marketing/GeneratedWalkthrough";
import { LOOM_URL } from "@/lib/site";

const STORYBOARD: { step: number; label: string }[] = [
  { step: 1, label: "Import messy transactions" },
  { step: 2, label: "Classify obvious vendors" },
  { step: 3, label: "Route uncertain items to review" },
  { step: 4, label: "Save correction memory" },
  { step: 5, label: "Export verified ledger" },
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
                Watch LedgerLens in 30 seconds
              </h2>
              {!hasLoom && (
                <span className="inline-flex items-center rounded-full border border-surface-border bg-surface-page px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-subtle">
                  Generated walkthrough
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-text-secondary">
              See messy transactions move through rules, review routing, correction memory,
              and verified ledger export.
            </p>
            <div className="mt-4 aspect-video w-full overflow-hidden rounded-md border border-surface-border bg-surface-sunken">
              {hasLoom ? (
                <iframe
                  src={LOOM_URL}
                  title="LedgerLens 30-second walkthrough"
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
                A real Loom recording can replace this when{" "}
                <span className="mono">NEXT_PUBLIC_LOOM_URL</span> is set on the deploy.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Start the live demo →
              </Link>
              <Link
                href="/technical-story"
                className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
              >
                Read the technical story
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
                ? "The storyboard matches the recording and the live /demo workflow."
                : "Storyboard matches the live /demo workflow. Walk it for real to see the trust panel update from the persisted database."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
