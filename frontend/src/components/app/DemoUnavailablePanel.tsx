"use client";

import Link from "next/link";

/**
 * Public-demo dependency-unavailable panel.
 *
 * Shown by /app and /demo when /demo/ready reports `ready: false`
 * or the readiness call itself errors. Polished copy keeps the
 * public demo credible during partial backend outages — never a
 * raw network-error message as the primary line.
 */
export function DemoUnavailablePanel({
  onRetry,
  notReadyTables,
  requestId,
}: {
  onRetry: () => void;
  notReadyTables?: string[];
  requestId?: string | null;
}) {
  return (
    <section
      role="alert"
      data-testid="demo-unavailable-panel"
      className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide">
        Demo dependencies temporarily unavailable
      </p>
      <h2 className="mt-1 font-display text-[18px] font-medium text-text-primary">
        The demo workspace is partially unavailable right now
      </h2>
      <p className="mt-2 text-[13px]">
        The API process is up, but one or more demo database checks
        are failing. This usually happens during a deploy window or a
        Railway database migration. Your guided demo will work again
        once the dependency catches up.
      </p>
      {notReadyTables && notReadyTables.length > 0 && (
        <p className="mt-2 text-[12px] text-amber-800">
          Affected dependencies:{" "}
          <span className="mono">{notReadyTables.join(", ")}</span>
        </p>
      )}
      {requestId && (
        <p className="mt-1 text-[11px] text-amber-800">
          Request ID for logs: <span className="mono">{requestId}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
          data-testid="demo-unavailable-retry"
        >
          Try again
        </button>
        <Link
          href="/cleanup"
          className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-panel px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
        >
          Open cleanup checklist
        </Link>
        <Link
          href="/technical-story"
          className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-panel px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
        >
          Open technical story
        </Link>
      </div>
      <p className="mt-3 text-[11px] text-amber-800">
        This is a public demo on synthetic data. Do not upload real
        bank data.
      </p>
    </section>
  );
}
