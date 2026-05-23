import { PlayCircle } from "lucide-react";

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
          {/* Video / placeholder takes 3/5; storyboard takes 2/5. */}
          <div className="lg:col-span-3">
            <h2 className="font-display text-[22px] font-medium text-text-primary">
              Watch LedgerLens in 30 seconds
            </h2>
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
                <Placeholder />
              )}
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
            {!hasLoom && (
              <p className="mt-3 text-[11px] text-text-subtle">
                Recording on its way. The storyboard above matches the guided demo
                exactly — you can walk the live workflow instead.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Placeholder() {
  return (
    <div
      role="img"
      aria-label="30-second walkthrough coming soon"
      className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-brand-100 via-surface-panel to-brand-100 text-center"
    >
      <PlayCircle size={48} className="text-brand-600" aria-hidden="true" />
      <p className="mt-3 font-display text-[16px] font-medium text-text-primary">
        30-second walkthrough coming soon
      </p>
      <p className="mt-1 max-w-sm px-6 text-[12px] text-text-secondary">
        Until the recording is up, walk the live demo — every step in the storyboard
        is wired through the real backend.
      </p>
    </div>
  );
}
