"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { StatusBadge } from "@/components/app/StatusBadge";
import {
  ApiError,
  approveReview,
  correctReview,
  getReviewQueue,
  listCategories,
  markForAccountantReview,
  markUncategorizable,
} from "@/lib/api/client";
import type { Category, ReviewQueueItem } from "@/lib/api/types";
import { formatAmount, formatConfidence } from "@/lib/format";

type RowState = {
  correctCode: string;
  note: string;
  busy: boolean;
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [queue, cats] = await Promise.all([
        getReviewQueue({ limit: 100 }),
        listCategories().catch(() => [] as Category[]),
      ]);
      setItems(queue.items);
      setCategories(cats);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : String(err),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateRow(txId: string, patch: Partial<RowState>) {
    setRowState((prev) => {
      const existing = prev[txId] ?? { correctCode: "", note: "", busy: false };
      return { ...prev, [txId]: { ...existing, ...patch } };
    });
  }

  async function runAction(
    txId: string,
    name: string,
    fn: () => Promise<unknown>,
  ) {
    setActionError(null);
    updateRow(txId, { busy: true });
    try {
      await fn();
      // Drop the item from the queue locally; reload to keep audit and counts honest.
      setItems((prev) => prev?.filter((i) => i.transaction.id !== txId) ?? prev);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
          : `${name} failed: ${String(err)}`,
      );
    } finally {
      updateRow(txId, { busy: false });
    }
  }

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[clamp(22px,5vw,28px)] font-medium leading-tight text-text-primary">
            Review is the safety layer.
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] text-text-secondary">
            Items land here when correction memory, deterministic rules, and the configured
            fallback cannot safely finalize them. Pick one explicit action per row:{" "}
            <strong>Approve prediction</strong>, <strong>Correct</strong>,{" "}
            <strong>Needs accountant review</strong>, or{" "}
            <strong>Exclude / non-business</strong>.
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-medium text-amber-900">
          {items?.length ?? 0} pending
        </span>
      </header>

      {!loading && items && items.length > 0 && (
        <p
          className="mt-2 text-[12px] text-text-subtle"
          aria-live="polite"
          data-testid="review-progress"
        >
          {items.length} pending — pick an explicit action per card.
        </p>
      )}

      <aside className="mt-4 rounded border border-brand-200 bg-brand-100 p-3 text-[12px] text-brand-800">
        <p className="font-medium">What happens when you correct?</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-secondary">
          <li>The correction is stored as a deterministic memory rule.</li>
          <li>Similar future transactions are categorized from memory at zero cost.</li>
          <li>The audit trail records the decision with reviewer and timestamp.</li>
          <li>The reviewed categorization export uses your reviewed category, not the prediction.</li>
        </ul>
      </aside>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          {actionError}
        </div>
      )}

      {loading && <p className="mt-6 text-[14px] text-text-subtle">Loading…</p>}

      {!loading && items && items.length === 0 && (
        <div className="mt-8 rounded-lg border border-brand-200 bg-brand-100 p-8 text-center">
          <p className="text-[16px] font-medium text-text-primary">Queue is clear.</p>
          <p className="mt-2 text-[14px] text-text-secondary">
            All categorized transactions have been resolved.{" "}
            <Link href="/ledger" className="text-brand-700 hover:text-brand-800">
              View the ledger →
            </Link>
          </p>
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <ul className="mt-6 space-y-4">
          {items.map((item) => {
            const tx = item.transaction;
            const r = item.latest_result;
            const rs = rowState[tx.id] ?? { correctCode: "", note: "", busy: false };
            const lowConfidence = r.confidence < 0.7;
            return (
              <li
                key={tx.id}
                className={`rounded-lg border p-4 ${
                  lowConfidence
                    ? "border-amber-300 bg-amber-50"
                    : "border-brand-200 bg-brand-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/transactions/${tx.id}`}
                      className="font-display text-[16px] font-medium text-text-primary hover:text-brand-700"
                    >
                      {tx.description}
                    </Link>
                    <p className="mono mt-1 text-[12px] text-text-subtle">
                      {tx.transaction_date} · {formatAmount(tx.amount_cents, tx.currency)}
                      {tx.merchant && ` · ${tx.merchant}`}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="mt-3 rounded border border-surface-border bg-surface-panel p-3 text-[13px]">
                  <p>
                    <span className="text-text-subtle">Predicted:</span>{" "}
                    <span className="mono text-text-subtle">[{r.predicted_category_code}]</span>{" "}
                    <span className="text-text-primary">{r.predicted_category_name}</span>{" "}
                    — confidence{" "}
                    <span className={`mono ${lowConfidence ? "text-amber-800" : "text-text-primary"}`}>
                      {formatConfidence(r.confidence)}
                    </span>
                  </p>
                  <SourceTag provider={r.model_provider} />
                  {r.explanation && (
                    <p className="mt-1 text-[12px] italic text-text-secondary">{r.explanation}</p>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="field-label">Correct to category</label>
                    <select
                      className="mt-1 w-full rounded border border-surface-border bg-surface-panel px-2 py-1.5 text-[13px]"
                      value={rs.correctCode}
                      onChange={(e) => updateRow(tx.id, { correctCode: e.target.value })}
                      disabled={categories.length === 0}
                    >
                      <option value="">— select —</option>
                      {categories.map((c) => (
                        <option key={c.code} value={c.code}>
                          [{c.code}] {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="field-label">Reviewer note (optional)</label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded border border-surface-border bg-surface-panel px-2 py-1.5 text-[13px]"
                      value={rs.note}
                      onChange={(e) => updateRow(tx.id, { note: e.target.value })}
                      placeholder="why this correction"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    disabled={rs.busy}
                    onClick={() =>
                      runAction(tx.id, "Approve", () => approveReview(tx.id, rs.note || undefined))
                    }
                    className="min-h-[44px] rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                  >
                    Approve prediction
                  </button>
                  <button
                    type="button"
                    disabled={rs.busy || !rs.correctCode}
                    onClick={() =>
                      runAction(tx.id, "Correct", () =>
                        correctReview(tx.id, rs.correctCode, rs.note || undefined),
                      )
                    }
                    className="min-h-[44px] rounded border-2 border-brand-600 bg-surface-panel px-3 py-2 text-[13px] font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                  >
                    Correct
                  </button>
                  <button
                    type="button"
                    disabled={rs.busy}
                    onClick={() =>
                      runAction(tx.id, "Needs accountant review", () =>
                        markForAccountantReview(tx.id, rs.note || undefined, {
                          accountant_follow_up_required: true,
                        }),
                      )
                    }
                    title="Defer to an accountant. Does not finalize the predicted category."
                    className="min-h-[44px] rounded border border-amber-400 bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Needs accountant review
                  </button>
                  <button
                    type="button"
                    disabled={rs.busy}
                    onClick={() =>
                      runAction(tx.id, "Exclude / non-business", () =>
                        markUncategorizable(tx.id, rs.note || undefined),
                      )
                    }
                    className="min-h-[44px] rounded border border-surface-border bg-surface-panel px-3 py-2 text-[13px] text-text-secondary hover:bg-surface-sunken disabled:opacity-50"
                  >
                    Exclude / non-business
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

function SourceTag({ provider }: { provider: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    correction_memory: { label: "Memory", tone: "bg-brand-200 text-brand-800" },
    rule_categorizer: { label: "Rule", tone: "bg-brand-200 text-brand-800" },
    demo_stub: { label: "Demo Stub", tone: "bg-surface-sunken text-text-secondary" },
    anthropic: { label: "Model", tone: "bg-surface-sunken text-text-subtle" },
  };
  const entry = map[provider] ?? { label: provider, tone: "bg-surface-sunken text-text-subtle" };
  return (
    <p className="mt-1 text-[11px] text-text-subtle">
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${entry.tone}`}
      >
        {entry.label}
      </span>
    </p>
  );
}
