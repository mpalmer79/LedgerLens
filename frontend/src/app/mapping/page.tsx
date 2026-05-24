"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ErrorState, LoadingState } from "@/components/ui/DataState";
import { listRules } from "@/lib/api/client";
import type { BusinessRuleMap } from "@/lib/api/types";

/**
 * Category mapping explorer.
 *
 * Read-only view of the active business's intent → COA mapping. The
 * map is currently a Python file (`business_rule_maps.py`) so we
 * can't edit it from the UI yet. Surfacing it here makes the
 * boundary explicit: an owner can see what intents are mapped to
 * what categories, which intents are blocked-fallback, and which
 * are unmapped.
 *
 * The brief deliberately asks for a read-only explorer this sprint:
 * an editable wizard needs per-tenant storage which needs the auth
 * /tenant model that is design-only this PR.
 */

type State = {
  loading: boolean;
  error: unknown;
  mapping: BusinessRuleMap | null;
};

export default function CategoryMappingPage() {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    mapping: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await listRules();
      setState({ loading: false, error: null, mapping: res.mapping });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mapping = state.mapping;
  const mappedCount = mapping?.entries.length ?? 0;
  const blockedCount = mapping?.block_fallback_intents?.length ?? 0;
  const unmappedCount = mapping?.unmapped_intents?.length ?? 0;

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Category mapping
        </p>
        <h1 className="mt-2 font-display text-[clamp(22px,5vw,30px)] font-medium leading-tight text-text-primary">
          How rule intents become categories
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          Every deterministic rule carries an <code>intent</code> like{" "}
          <code>parts_inventory</code> or <code>fuel_vehicle</code>. This page shows the
          mapping the active demo business uses to turn each intent into a chart-of-accounts
          code. Read-only — the map is configured in code today.
        </p>
        <p className="mt-2 max-w-3xl text-[12px] text-text-subtle">
          Production per-business mapping configuration requires auth and tenant isolation,
          which is not implemented. See{" "}
          <Link href="/technical-story" className="text-brand-700 underline">
            technical story
          </Link>{" "}
          for the production-readiness plan.
        </p>
      </header>

      {state.error !== null && <ErrorState error={state.error} onRetry={() => void load()} />}

      {state.loading && <LoadingState label="Loading category mapping…" />}

      {!state.loading && mapping !== null && (
        <>
          <section
            className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
            data-testid="mapping-summary"
          >
            <SummaryCard label="Active business" value={mapping.business_name ?? mapping.business_id} />
            <SummaryCard label="Mapped intents" value={String(mappedCount)} />
            <SummaryCard label="Blocked fallback" value={String(blockedCount)} />
            <SummaryCard label="Unmapped" value={String(unmappedCount)} />
          </section>

          <section className="mt-6">
            <h2 className="font-display text-[18px] font-medium text-text-primary">
              Mapped intents
            </h2>
            <p className="mt-1 text-[12px] text-text-subtle">
              The rule layer uses the mapped category code below instead of the rule&apos;s
              hard-coded default.
            </p>
            <ul className="mt-3 divide-y divide-surface-border rounded border border-surface-border">
              {mapping.entries.length === 0 && (
                <li className="p-3 text-[13px] text-text-subtle">No intents mapped.</li>
              )}
              {mapping.entries.map((e) => (
                <li
                  key={e.intent}
                  className="grid grid-cols-1 gap-1 p-3 text-[13px] sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
                >
                  <code className="text-text-primary">{e.intent}</code>
                  <span className="text-text-secondary">
                    [{e.category_code}] {e.category_name ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {(mapping.block_fallback_intents?.length ?? 0) > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-[18px] font-medium text-text-primary">
                Blocked fallback intents
              </h2>
              <p className="mt-1 text-[12px] text-text-subtle">
                For these intents the active business refuses the rule&apos;s own default
                category. Matching transactions are routed to review instead of
                auto-categorized.
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {mapping.block_fallback_intents?.map((i) => (
                  <li
                    key={i}
                    className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
                  >
                    <code>{i}</code> · routed to review
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(mapping.unmapped_intents?.length ?? 0) > 0 && (
            <section className="mt-6">
              <h2 className="font-display text-[18px] font-medium text-text-primary">
                Unmapped intents
              </h2>
              <p className="mt-1 text-[12px] text-text-subtle">
                These intents appear on rules but have no override here — the rule&apos;s
                hard-coded default category is used.
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {mapping.unmapped_intents?.map((i) => (
                  <li
                    key={i}
                    className="rounded border border-surface-border bg-surface-page px-3 py-2 text-[13px] text-text-secondary"
                  >
                    <code>{i}</code> · rule default in use
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8 text-[12px] text-text-subtle">
            Want to edit the map?{" "}
            <Link href="/rules" className="text-brand-700 underline">
              Open /rules
            </Link>{" "}
            for the full rule listing. Editable per-business mapping is the next planned
            workflow — see{" "}
            <Link href="/technical-story" className="text-brand-700 underline">
              technical story
            </Link>{" "}
            for prerequisites.
          </p>
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
