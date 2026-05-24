"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ErrorState, LoadingState } from "@/components/ui/DataState";
import {
  ApiError,
  applyMappingPreview,
  getMappingProfile,
  previewMappingChange,
  resetMappingProfile,
  updateMappingEntry,
  type MappingApplyResult,
  type MappingEntry,
  type MappingPreview,
  type MappingProfile,
} from "@/lib/api/client";

/**
 * Category mapping — editable wizard for the active demo business.
 *
 * Demo-safe persistence:
 * - Edits go to the backend's CategoryMappingProfile rows.
 * - No production authentication; the public-demo warning at the
 *   top of the page makes that explicit.
 * - The reset button restores the seeded defaults so reviewers /
 *   next-day visitors can recover a known state.
 */

type DraftMap = Record<
  string,
  { category_code: string; block_fallback: boolean; notes: string; dirty: boolean }
>;

type RowError = { intent: string; message: string };

type State = {
  loading: boolean;
  error: unknown;
  profile: MappingProfile | null;
  drafts: DraftMap;
  saving: Record<string, boolean>;
  rowErrors: Record<string, string>;
  resetting: boolean;
};

const INITIAL_STATE: State = {
  loading: true,
  error: null,
  profile: null,
  drafts: {},
  saving: {},
  rowErrors: {},
  resetting: false,
};

function buildDrafts(entries: MappingEntry[]): DraftMap {
  const out: DraftMap = {};
  for (const e of entries) {
    out[e.intent] = {
      category_code: e.category_code ?? "",
      block_fallback: e.block_fallback,
      notes: e.notes ?? "",
      dirty: false,
    };
  }
  return out;
}

type PreviewState = {
  loading: boolean;
  data: MappingPreview | null;
  error: string | null;
};

export default function CategoryMappingPage() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  // Per-intent preview state. Keyed by intent so multiple rows can be
  // explored independently.
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});

  const runPreview = useCallback(async (intent: string, draft: {
    category_code: string;
    block_fallback: boolean;
  }) => {
    setPreviews((prev) => ({
      ...prev,
      [intent]: { loading: true, data: null, error: null },
    }));
    try {
      const data = await previewMappingChange({
        intent,
        proposed_category_code:
          draft.category_code === "" ? null : draft.category_code,
        block_fallback: draft.block_fallback,
        limit: 200,
      });
      setPreviews((prev) => ({
        ...prev,
        [intent]: { loading: false, data, error: null },
      }));
    } catch (err) {
      const msg = err instanceof ApiError ? err.userMessage : String(err);
      setPreviews((prev) => ({
        ...prev,
        [intent]: { loading: false, data: null, error: msg },
      }));
    }
  }, []);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const profile = await getMappingProfile();
      setState((s) => ({
        ...s,
        loading: false,
        error: null,
        profile,
        drafts: buildDrafts(profile.entries),
      }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setDraft(
    intent: string,
    patch: Partial<{ category_code: string; block_fallback: boolean; notes: string }>,
  ) {
    setState((s) => {
      const existing = s.drafts[intent] ?? {
        category_code: "",
        block_fallback: false,
        notes: "",
        dirty: false,
      };
      const next: DraftMap = {
        ...s.drafts,
        [intent]: { ...existing, ...patch, dirty: true },
      };
      const nextErrors = { ...s.rowErrors };
      delete nextErrors[intent];
      return { ...s, drafts: next, rowErrors: nextErrors };
    });
  }

  async function saveRow(intent: string) {
    const draft = state.drafts[intent];
    if (!draft) return;
    setState((s) => ({ ...s, saving: { ...s.saving, [intent]: true } }));
    try {
      const profile = await updateMappingEntry(intent, {
        category_code: draft.category_code === "" ? null : draft.category_code,
        block_fallback: draft.block_fallback,
        notes: draft.notes === "" ? null : draft.notes,
      });
      setState((s) => ({
        ...s,
        profile,
        drafts: buildDrafts(profile.entries),
        saving: { ...s.saving, [intent]: false },
        rowErrors: (() => {
          const next = { ...s.rowErrors };
          delete next[intent];
          return next;
        })(),
      }));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        saving: { ...s.saving, [intent]: false },
        rowErrors: { ...s.rowErrors, [intent]: message },
      }));
    }
  }

  async function resetAll() {
    setState((s) => ({ ...s, resetting: true, rowErrors: {} }));
    try {
      const profile = await resetMappingProfile();
      setState((s) => ({
        ...s,
        profile,
        drafts: buildDrafts(profile.entries),
        resetting: false,
      }));
    } catch (err) {
      setState((s) => ({ ...s, resetting: false, error: err }));
    }
  }

  const profile = state.profile;

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Category mapping
        </p>
        <h1 className="mt-2 font-display text-[clamp(22px,5vw,30px)] font-medium leading-tight text-text-primary">
          Map LedgerLens intents to your business categories
        </h1>
        <div
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900"
          data-testid="mapping-warning"
        >
          <p className="font-medium">
            Public demo — these settings are not protected by production
            authentication.
          </p>
          <p className="mt-1">
            Use synthetic / sample data only. Do not upload real bank data.
            Editable category mapping is a categorization handoff aid, not
            a true accounting ledger.
          </p>
        </div>
      </header>

      {state.error !== null && (
        <ErrorState error={state.error} onRetry={() => void load()} />
      )}

      {state.loading && <LoadingState label="Loading mapping…" />}

      {!state.loading && profile !== null && (
        <>
          <section
            className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
            data-testid="mapping-summary"
          >
            <SummaryCard
              label="Active business"
              value={profile.business_name ?? profile.business_id}
            />
            <SummaryCard label="Profile source" value={profile.source} />
            <SummaryCard
              label="Mapped"
              value={String(
                profile.entries.filter((e) => e.status === "mapped").length,
              )}
            />
            <SummaryCard
              label="Blocked fallback"
              value={String(
                profile.entries.filter((e) => e.status === "fallback_blocked").length,
              )}
            />
          </section>

          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-[18px] font-medium text-text-primary">
                  Intents and categories
                </h2>
                <p className="mt-1 text-[12px] text-text-subtle">
                  Pick a category for each intent, or block fallback to route
                  matching rows to review instead of auto-categorizing.
                </p>
              </div>
              <button
                type="button"
                disabled={state.resetting}
                onClick={() => void resetAll()}
                className="min-h-[44px] rounded border border-surface-border bg-surface-panel px-3 py-2 text-[13px] font-medium text-text-secondary hover:bg-surface-sunken disabled:opacity-50"
                data-testid="mapping-reset"
              >
                {state.resetting ? "Resetting…" : "Reset demo defaults"}
              </button>
            </div>

            <ul
              className="mt-3 space-y-3"
              data-testid="mapping-entries"
            >
              {profile.entries.map((e) => {
                const draft = state.drafts[e.intent];
                if (!draft) return null;
                const busy = !!state.saving[e.intent];
                const rowError = state.rowErrors[e.intent];
                return (
                  <li
                    key={e.intent}
                    className="rounded-lg border border-surface-border bg-surface-panel p-4"
                    data-testid={`mapping-entry-${e.intent}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <code className="text-[13px] text-text-primary">{e.intent}</code>
                        <StatusBadge status={e.status} />
                      </div>
                      <span className="text-[12px] text-text-subtle">
                        Current:{" "}
                        {e.category_code ? (
                          <span className="mono">
                            [{e.category_code}] {e.category_name ?? "—"}
                          </span>
                        ) : (
                          <span className="italic">unmapped</span>
                        )}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
                      <div>
                        <label className="field-label" htmlFor={`code-${e.intent}`}>
                          Category
                        </label>
                        <select
                          id={`code-${e.intent}`}
                          className="mt-1 min-h-[44px] w-full rounded border border-surface-border bg-surface-page px-2 text-[13px]"
                          value={draft.category_code}
                          disabled={busy || draft.block_fallback}
                          onChange={(ev) =>
                            setDraft(e.intent, { category_code: ev.target.value })
                          }
                        >
                          <option value="">— unmapped —</option>
                          {profile.available_categories.map((c) => (
                            <option key={c.code} value={c.code}>
                              [{c.code}] {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-text-primary">
                        <input
                          type="checkbox"
                          checked={draft.block_fallback}
                          disabled={busy}
                          onChange={(ev) =>
                            setDraft(e.intent, {
                              block_fallback: ev.target.checked,
                              category_code: ev.target.checked ? "" : draft.category_code,
                            })
                          }
                          className="h-5 w-5"
                          data-testid={`block-${e.intent}`}
                        />
                        Block fallback
                      </label>

                      <button
                        type="button"
                        disabled={busy || !draft.dirty}
                        onClick={() => void saveRow(e.intent)}
                        className="min-h-[44px] self-end rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                        data-testid={`save-${e.intent}`}
                      >
                        {busy ? "Saving…" : "Save"}
                      </button>
                    </div>

                    <PreviewImpactSection
                      intent={e.intent}
                      draft={draft}
                      preview={previews[e.intent]}
                      onPreview={() => void runPreview(e.intent, draft)}
                    />

                    <div className="mt-3">
                      <label className="field-label" htmlFor={`notes-${e.intent}`}>
                        Notes (optional)
                      </label>
                      <input
                        id={`notes-${e.intent}`}
                        type="text"
                        className="mt-1 w-full rounded border border-surface-border bg-surface-page px-2 py-1.5 text-[13px]"
                        value={draft.notes}
                        disabled={busy}
                        onChange={(ev) =>
                          setDraft(e.intent, { notes: ev.target.value })
                        }
                        placeholder="why this mapping"
                      />
                    </div>

                    {rowError && (
                      <p
                        role="alert"
                        className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800"
                      >
                        {rowError}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {profile.missing_intents.length > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-[18px] font-medium text-text-primary">
                Other intents
              </h2>
              <p className="mt-1 text-[12px] text-text-subtle">
                Intents the rule layer can produce that this profile hasn&apos;t
                customized yet. They currently inherit the registry default
                and can be added by editing the rule code.
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {profile.missing_intents.map((i) => (
                  <li
                    key={i}
                    className="rounded border border-surface-border bg-surface-page px-3 py-2 text-[13px] text-text-secondary"
                  >
                    <code>{i}</code>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8 text-[12px] text-text-subtle">
            If an intent is unmapped or fallback is blocked, LedgerLens
            routes matching rows to review instead of forcing a category.
            See{" "}
            <Link href="/rules" className="text-brand-700 underline">
              the full rule listing
            </Link>{" "}
            for the underlying intent → category logic.
          </p>

          {profile.warnings.length > 0 && (
            <section className="mt-6">
              <ul className="space-y-2">
                {profile.warnings.map((w) => (
                  <li
                    key={w}
                    className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-surface-border bg-surface-panel p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </p>
      <p className="mt-1 truncate text-[14px] font-medium text-text-primary">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: MappingEntry["status"] }) {
  const map = {
    mapped: { label: "mapped", tone: "bg-emerald-100 text-emerald-800" },
    unmapped: { label: "unmapped", tone: "bg-surface-sunken text-text-secondary" },
    fallback_blocked: {
      label: "fallback blocked",
      tone: "bg-amber-100 text-amber-900",
    },
  };
  const entry = map[status];
  return (
    <span
      className={`ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${entry.tone}`}
    >
      {entry.label}
    </span>
  );
}

function PreviewImpactSection({
  intent,
  draft,
  preview,
  onPreview,
}: {
  intent: string;
  draft: { category_code: string; block_fallback: boolean; notes: string };
  preview: PreviewState | undefined;
  onPreview: () => void;
}) {
  return (
    <details
      className="mt-3 rounded border border-surface-border bg-surface-page"
      data-testid={`preview-impact-${intent}`}
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-text-primary hover:bg-surface-sunken">
        Preview impact (apply selected rows only)
      </summary>
      <div className="border-t border-surface-border p-3 text-[12px]">
        <p className="text-text-subtle">
          Nothing has been changed yet. The preview is read-only.
          Human-corrected and accountant-follow-up rows are protected.
          Mapping edits affect future categorization immediately;
          updating current rows requires explicit review.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={preview?.loading}
            className="min-h-[36px] rounded border border-surface-border bg-surface-panel px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-surface-sunken disabled:opacity-50"
            data-testid={`preview-impact-button-${intent}`}
          >
            {preview?.loading ? "Previewing…" : "Run preview"}
          </button>
          <span className="text-[11px] text-text-subtle">
            Uses{" "}
            {draft.block_fallback
              ? "block_fallback = true (would route to review)"
              : draft.category_code
                ? `proposed code [${draft.category_code}]`
                : "the rule's own default code"}
            .
          </span>
        </div>
        {preview?.error && (
          <p
            role="alert"
            className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800"
          >
            {preview.error}
          </p>
        )}
        {preview?.data && (
          <PreviewSummaryAndRows
            preview={preview.data}
            intent={intent}
            proposedCategoryCode={draft.category_code}
            blockFallback={draft.block_fallback}
          />
        )}
      </div>
    </details>
  );
}

function PreviewSummaryAndRows({
  preview,
  intent,
  proposedCategoryCode,
  blockFallback,
}: {
  preview: MappingPreview;
  intent: string;
  proposedCategoryCode: string;
  blockFallback: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<MappingApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const eligibleRows = preview.rows.filter((r) => r.eligible);
  const allEligibleSelected =
    eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.transaction_id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllEligible() {
    setSelected(new Set(eligibleRows.map((r) => r.transaction_id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function runApply() {
    setApplying(true);
    setApplyError(null);
    try {
      const out = await applyMappingPreview({
        intent,
        proposed_category_code: blockFallback
          ? null
          : proposedCategoryCode === ""
            ? null
            : proposedCategoryCode,
        block_fallback: blockFallback,
        selected_transaction_ids: Array.from(selected),
      });
      setResult(out);
      setSelected(new Set());
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.userMessage : String(err));
    } finally {
      setApplying(false);
      setConfirming(false);
    }
  }

  const applyLabel = blockFallback
    ? "Route selected rows to review"
    : "Apply selected eligible rows";

  return (
    <div className="mt-3" data-testid={`preview-result-${intent}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="Affected" value={String(preview.affected_count)} />
        <SummaryCard label="Eligible" value={String(preview.eligible_count)} />
        <SummaryCard
          label="Would route to review"
          value={String(preview.would_route_to_review_count)}
        />
        <SummaryCard label="Protected" value={String(preview.ineligible_count)} />
      </div>

      {eligibleRows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAllEligible}
            disabled={allEligibleSelected || applying}
            className="min-h-[36px] rounded border border-surface-border bg-surface-panel px-2 py-1 text-[12px] hover:bg-surface-sunken disabled:opacity-50"
            data-testid={`preview-select-all-${intent}`}
          >
            Select all eligible
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selected.size === 0 || applying}
            className="min-h-[36px] rounded border border-surface-border bg-surface-panel px-2 py-1 text-[12px] hover:bg-surface-sunken disabled:opacity-50"
          >
            Clear selection
          </button>
          <span className="text-[11px] text-text-subtle">
            {selected.size} of {eligibleRows.length} eligible selected
          </span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={selected.size === 0 || applying}
            className="min-h-[44px] rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            data-testid={`apply-selected-${intent}`}
          >
            {applyLabel}
          </button>
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900"
          data-testid={`apply-confirm-${intent}`}
        >
          <p className="font-medium">
            This will update only the {selected.size} selected eligible row
            {selected.size === 1 ? "" : "s"}. Human-corrected and
            accountant-follow-up rows will remain protected.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runApply()}
              disabled={applying}
              className="min-h-[44px] rounded bg-amber-700 px-3 py-2 text-[13px] font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              data-testid={`apply-confirm-button-${intent}`}
            >
              {applying ? "Applying…" : "Confirm and apply"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={applying}
              className="min-h-[44px] rounded border border-amber-400 bg-surface-panel px-3 py-2 text-[13px] font-medium text-amber-900 hover:bg-surface-sunken disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {applyError && (
        <p
          role="alert"
          className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800"
        >
          {applyError}
        </p>
      )}

      {result && (
        <div
          className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-[12px] text-emerald-900"
          data-testid={`apply-result-${intent}`}
          role="status"
        >
          <p className="font-medium">
            Applied {result.applied_count} of {result.requested_count} selected.{" "}
            {result.rejected_count > 0 &&
              `${result.rejected_count} rejected (see /audit for details).`}
          </p>
          {result.audit_event_id && (
            <p className="mt-1 text-emerald-800">
              Audit event recorded:{" "}
              <Link href="/audit" className="underline">
                view /audit
              </Link>{" "}
              · id <span className="mono">{result.audit_event_id}</span>.
            </p>
          )}
          {result.rejected_rows.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.rejected_rows.slice(0, 5).map((r) => (
                <li key={r.transaction_id}>
                  <span className="mono">{r.transaction_id}</span> — {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview.rows.length === 0 ? (
        <p className="mt-3 text-[12px] text-text-subtle">
          No matching rows in the current workspace.
        </p>
      ) : (
        <ul
          className="mt-3 space-y-2"
          data-testid={`preview-rows-${intent}`}
        >
          {preview.rows.slice(0, 25).map((r) => {
            const isSelected = selected.has(r.transaction_id);
            return (
              <li
                key={r.transaction_id}
                className={
                  r.eligible
                    ? "rounded border border-surface-border bg-surface-panel p-3 text-[12px]"
                    : "rounded border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900"
                }
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={isSelected}
                      disabled={!r.eligible || applying}
                      onChange={() => toggle(r.transaction_id)}
                      data-testid={`preview-row-select-${r.transaction_id}`}
                    />
                    <span className="mono text-text-subtle">{r.transaction_date}</span>
                  </label>
                  <span
                    className={
                      r.eligible
                        ? "rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800"
                        : "rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900"
                    }
                  >
                    {r.eligible ? "eligible" : "protected"}
                  </span>
                </div>
                <p className="mt-1 text-text-primary">{r.description}</p>
                <p className="mt-1 text-text-secondary">
                  Current:{" "}
                  {r.current_category_code ? (
                    <span className="mono">
                      [{r.current_category_code}] {r.current_category_name ?? "—"}
                    </span>
                  ) : (
                    <span className="italic">unmapped</span>
                  )}{" "}
                  → Proposed:{" "}
                  {r.proposed_category_code ? (
                    <span className="mono">
                      [{r.proposed_category_code}] {r.proposed_category_name ?? "—"}
                    </span>
                  ) : (
                    <span className="italic">route to review</span>
                  )}
                </p>
                {r.reason && <p className="mt-1 italic">Reason: {r.reason}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {preview.rows.length > 25 && (
        <p className="mt-2 text-[11px] text-text-subtle">
          Showing first 25 of {preview.rows.length} rows.
        </p>
      )}
    </div>
  );
}
