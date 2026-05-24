"use client";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/DataState";
import {
  ApiError,
  listAuditEventsScoped,
  type AuditEventList,
} from "@/lib/api/client";

/**
 * Audit events — actor-aware workflow traceability for the active
 * demo business. The page surfaces the same warnings the backend
 * carries: this is workflow traceability, not regulatory compliance.
 */

type State = {
  loading: boolean;
  error: unknown;
  data: AuditEventList | null;
  filterAction: string;
  filterEntity: string;
};

const INITIAL: State = {
  loading: true,
  error: null,
  data: null,
  filterAction: "",
  filterEntity: "",
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function summarizeDetails(details: Record<string, unknown>): string {
  const before = details.before as Record<string, unknown> | undefined;
  const after = details.after as Record<string, unknown> | undefined;
  const meta = details.metadata as Record<string, unknown> | undefined;
  if (before && after && "category_code" in before && "category_code" in after) {
    return `${String(before.category_code ?? "—")} → ${String(after.category_code ?? "—")}`;
  }
  if (after && "name" in after) {
    return `${String(after.name)}`;
  }
  if (meta && "applied_count" in meta && "requested_count" in meta) {
    return `applied ${String(meta.applied_count)} of ${String(meta.requested_count)} selected`;
  }
  return "—";
}

export default function AuditPage() {
  const [state, setState] = useState<State>(INITIAL);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await listAuditEventsScoped({
        limit: 100,
        action: state.filterAction || undefined,
        entity_type: state.filterEntity || undefined,
      });
      setState((s) => ({ ...s, loading: false, error: null, data }));
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, [state.filterAction, state.filterEntity]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Audit events
        </p>
        <h1 className="mt-2 font-display text-[clamp(22px,5vw,30px)] font-medium leading-tight text-text-primary">
          Workflow traceability for the active demo business
        </h1>
        <div
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900"
          data-testid="audit-warning"
        >
          <p className="font-medium">
            Audit events are for workflow traceability in the demo, not
            regulatory compliance.
          </p>
          <p className="mt-1">
            Actor identity is the seeded demo user; every visitor acts as the
            same actor. Sensitive fields (raw CSV rows, account numbers,
            secrets) are stripped before storage.
          </p>
        </div>
      </header>

      <section
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
        data-testid="audit-filters"
      >
        <label className="text-[12px] text-text-subtle">
          Filter by action
          <input
            type="text"
            value={state.filterAction}
            onChange={(e) =>
              setState((s) => ({ ...s, filterAction: e.target.value }))
            }
            placeholder="e.g. mapping_profile.updated"
            className="mt-1 min-h-[44px] w-full rounded border border-surface-border bg-surface-page px-2 text-[13px]"
          />
        </label>
        <label className="text-[12px] text-text-subtle">
          Filter by entity type
          <input
            type="text"
            value={state.filterEntity}
            onChange={(e) =>
              setState((s) => ({ ...s, filterEntity: e.target.value }))
            }
            placeholder="e.g. mapping_entry"
            className="mt-1 min-h-[44px] w-full rounded border border-surface-border bg-surface-page px-2 text-[13px]"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-[44px] self-end rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
        >
          Refresh
        </button>
      </section>

      {state.error !== null && (
        <ErrorState error={state.error} onRetry={() => void load()} />
      )}
      {state.loading && <LoadingState label="Loading audit events…" />}

      {!state.loading && state.data !== null && state.data.events.length === 0 && (
        <EmptyState
          title="No audit events yet"
          message="Try editing a mapping or saving an import profile to record an event."
        />
      )}

      {!state.loading && state.data !== null && state.data.events.length > 0 && (
        <ul
          className="mt-6 divide-y divide-surface-border rounded border border-surface-border"
          data-testid="audit-events-list"
        >
          {state.data.events.map((e) => (
            <li key={e.id} className="grid grid-cols-1 gap-1 p-3 text-[13px] sm:grid-cols-[1fr_1fr_2fr]">
              <div>
                <p className="font-medium text-text-primary">
                  <code>{e.action}</code>
                </p>
                <p className="mt-1 text-[11px] text-text-subtle">
                  {e.entity_type}
                  {e.entity_id && ` · ${e.entity_id}`}
                </p>
              </div>
              <div>
                <p className="text-text-secondary">
                  {e.actor_display_name ?? "unknown actor"}
                </p>
                <p className="mt-1 text-[11px] text-text-subtle">
                  {formatTimestamp(e.created_at)}
                </p>
                {e.request_id && (
                  <p className="mt-1 truncate text-[11px] text-text-subtle" title={e.request_id}>
                    rid {e.request_id}
                  </p>
                )}
              </div>
              <div>
                <p className="text-text-secondary">{summarizeDetails(e.details)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!state.loading && state.data !== null && (
        <ul className="mt-6 space-y-1 text-[11px] text-text-subtle">
          {state.data.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
