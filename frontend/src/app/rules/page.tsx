"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ErrorState, LoadingState } from "@/components/ui/DataState";
import { listRules } from "@/lib/api/client";
import type { BusinessRuleMap, Rule } from "@/lib/api/types";

type State = {
  loading: boolean;
  error: unknown;
  rules: Rule[] | null;
  mapping: BusinessRuleMap | null;
};

export default function RulesPage() {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    rules: null,
    mapping: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await listRules();
      setState({
        loading: false,
        error: null,
        rules: res.items,
        mapping: res.mapping ?? null,
      });
    } catch (err) {
      setState({ loading: false, error: err, rules: null, mapping: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <header>
        <h1 className="font-display text-[28px] font-medium text-text-primary">
          Obvious vendors should not require AI.
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-text-secondary">
          LedgerLens uses deterministic rules for vendors that are safe to classify — QuickBooks,
          Zoom, Staples, Shell, Stripe fees, and similar known accounts. Matches at high
          confidence auto-approve at zero cost. Ambiguous vendors like Amazon are intentionally
          routed to review instead. The rule layer reduces model calls and keeps frequent vendors
          consistent across months.
        </p>
        <p className="mt-2 max-w-3xl text-[12px] text-text-subtle">
          <strong>Per-business mapping (new):</strong> each rule now declares an{" "}
          <span className="mono">intent</span> (parts_inventory, payroll, fuel_vehicle, etc.).
          The active business&apos;s mapping resolves that intent to a real COA code. If a
          business&apos;s COA labels parts differently, the rule still fires — the mapping picks
          the right code. Unmapped intents route safely to review.
        </p>
      </header>

      {state.error !== null && (
        <ErrorState error={state.error} onRetry={() => void load()} />
      )}

      {state.loading && <LoadingState label="Loading rules…" />}

      {/* Active business mapping snapshot */}
      {state.mapping && state.mapping.entries.length > 0 && (
        <section className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[18px] font-medium text-text-primary">
              Active business mapping
            </h2>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
              {state.mapping.business_name ?? state.mapping.business_id}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-text-secondary">
            How rule intents resolve to the active business&apos;s chart of accounts.
            A rule&apos;s declared <span className="mono">intent</span> is looked up here
            first; if no override exists, the rule&apos;s own category_code is used.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {state.mapping.entries.map((entry) => (
              <div
                key={entry.intent}
                className="rounded border border-surface-border bg-surface-page p-2 text-[12px]"
              >
                <p className="mono font-medium text-text-primary">{entry.intent}</p>
                <p className="mt-0.5 text-text-secondary">
                  →{" "}
                  <span className="mono text-text-subtle">[{entry.category_code}]</span>{" "}
                  {entry.category_name ?? "(not in active COA)"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Rules table */}
      {!state.loading && state.rules !== null && (
        <section className="mt-6 overflow-x-auto rounded-lg border border-brand-200 bg-brand-100">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-brand-200">
              <tr>
                <th className="field-label px-3 py-2">Rule</th>
                <th className="field-label px-3 py-2">Match type</th>
                <th className="field-label px-3 py-2">Patterns</th>
                <th className="field-label px-3 py-2">Intent</th>
                <th className="field-label px-3 py-2">Mapped category</th>
                <th className="field-label px-3 py-2 text-right">Conf · Priority</th>
              </tr>
            </thead>
            <tbody>
              {state.rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-subtle">
                    No active rules.
                  </td>
                </tr>
              )}
              {state.rules.map((rule) => {
                const merchants = rule.merchant_patterns;
                const descriptions = rule.description_patterns;
                const overridden =
                  rule.mapped_category_code !== null &&
                  rule.mapped_category_code !== rule.category_code;
                return (
                  <tr key={rule.id} className="border-b border-brand-200/50 last:border-0">
                    <td className="px-3 py-1.5">
                      <p className="text-text-primary">{rule.name}</p>
                      <p className="mono text-[11px] text-text-subtle">{rule.id}</p>
                      {rule.explanation && (
                        <p className="mt-0.5 text-[11px] italic text-text-subtle">
                          {rule.explanation}
                        </p>
                      )}
                    </td>
                    <td className="mono px-3 py-1.5 text-[12px] text-text-secondary">
                      {rule.match_type}
                    </td>
                    <td className="px-3 py-1.5">
                      {merchants.length > 0 && (
                        <p className="text-[11px] text-text-secondary">
                          merchant:{" "}
                          <span className="mono text-text-primary">{merchants.join(", ")}</span>
                        </p>
                      )}
                      {descriptions.length > 0 && (
                        <p className="text-[11px] text-text-secondary">
                          description:{" "}
                          <span className="mono text-text-primary">
                            {descriptions.join(", ")}
                          </span>
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-[12px]">
                      {rule.intent ? (
                        <span className="mono text-text-primary">{rule.intent}</span>
                      ) : (
                        <span className="text-text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-text-primary">
                      <span className="mono text-text-subtle">
                        [{rule.mapped_category_code ?? rule.category_code}]
                      </span>{" "}
                      {rule.mapped_category_name ?? rule.category_name}
                      {overridden && (
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-brand-700">
                          overrides rule default [{rule.category_code}]
                        </p>
                      )}
                    </td>
                    <td className="mono px-3 py-1.5 text-right text-text-secondary">
                      {rule.confidence.toFixed(2)} · {rule.priority}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-6 max-w-3xl text-[12px] text-text-subtle">
        Rules are loaded from{" "}
        <span className="mono">backend/src/ledgerlens/data/category_rules.json</span>{" "}
        and validated against the active chart of accounts at server startup. Each rule
        declares an optional <span className="mono">intent</span>. The active business&apos;s
        mapping (<span className="mono">backend/src/ledgerlens/data/business_rule_maps.py</span>)
        resolves the intent to a COA code. When no mapping exists for the intent, the rule&apos;s
        own <span className="mono">category_code</span> is used as a safe fallback. Generic
        tokens such as <span className="mono">ACH</span>, <span className="mono">POS</span>, or{" "}
        <span className="mono">TRANSFER</span> are stripped from patterns to prevent
        overmatching. When two rules disagree on the same input the transaction routes to the
        review queue.
      </p>

      <div className="mt-6 rounded-lg border border-brand-200 bg-brand-100 p-4">
        <p className="text-[13px] text-text-primary">
          Mapped-rule eval coverage now includes auto repair, coffee shop, and
          design agency datasets.
        </p>
        <p className="mt-1 text-[12px] text-text-secondary">
          Each eval business has its own curated intent map (separate from the
          production demo&apos;s Granite State map shown above). The mapped
          variant resolves each rule&apos;s intent through the eval
          business&apos;s mapping; missing intents safely route to review
          instead of forcing a wrong category.
        </p>
        <p className="mt-2 text-[12px] text-text-secondary">
          <strong>Batch #1 (parts vendors):</strong> NAPA, AutoZone, O&apos;Reilly,
          Advance Auto, LKQ, Carquest, and tire distributors use the
          <span className="mono"> parts_inventory</span> and
          <span className="mono"> tires_inventory</span> intents. Each maps
          through the active business&apos;s COA: auto-repair lands in
          Inventory - Parts (1050) / Inventory - Tires (1070); other
          businesses block the fallback so a NAPA charge never silently
          becomes Green Coffee or office supplies. Ambiguous auto-related
          purchases (Amazon, Home Depot, Lowe&apos;s) still route to owner
          questions, not parts.
        </p>
        <Link
          href="/evals#business-specific-rule-mapping"
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500"
        >
          View multi-business rule evals →
        </Link>
      </div>
    </AppShell>
  );
}
