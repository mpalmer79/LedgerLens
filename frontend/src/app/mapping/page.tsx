"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ErrorState, LoadingState } from "@/components/ui/DataState";
import {
  ApiError,
  getMappingProfile,
  resetMappingProfile,
  updateMappingEntry,
  type MappingEntry,
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

export default function CategoryMappingPage() {
  const [state, setState] = useState<State>(INITIAL_STATE);

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
