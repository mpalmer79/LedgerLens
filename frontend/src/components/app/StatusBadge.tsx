import { statusLabel } from "@/lib/format";

const STYLES: Record<string, string> = {
  auto_approved: "bg-brand-100 text-brand-800 border-brand-200",
  needs_review: "bg-amber-100 text-amber-800 border-amber-200",
  uncategorizable: "bg-surface-sunken text-text-secondary border-surface-border",
  corrected: "bg-brand-100 text-brand-800 border-brand-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-surface-sunken text-text-subtle border-surface-border",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? STYLES.pending;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${style}`}
    >
      {statusLabel(status)}
    </span>
  );
}
