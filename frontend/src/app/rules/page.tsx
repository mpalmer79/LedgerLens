"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ApiError, listRules } from "@/lib/api/client";
import type { Rule } from "@/lib/api/types";

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listRules();
        if (!cancelled) {
          setRules(res.items);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? `${err.message}${err.status ? ` (HTTP ${err.status})` : ""}`
              : String(err),
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <header>
        <h1 className="font-display text-[28px] font-medium text-text-primary">
          Deterministic rules
        </h1>
        <p className="mt-1 max-w-3xl text-[14px] text-text-secondary">
          The rule layer runs after correction memory and before the model. When a transaction
          matches a high-confidence rule, it is categorized deterministically at zero model cost.
          Ambiguous rules with confidence below the auto-approve threshold route to the review
          queue rather than auto-applying. These rules are not AI — they are a curated table.
        </p>
      </header>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 overflow-x-auto rounded-lg border border-brand-200 bg-brand-100">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-brand-200">
            <tr>
              <th className="field-label px-3 py-2">Rule</th>
              <th className="field-label px-3 py-2">Match type</th>
              <th className="field-label px-3 py-2">Patterns</th>
              <th className="field-label px-3 py-2">Category</th>
              <th className="field-label px-3 py-2 text-right">Confidence</th>
              <th className="field-label px-3 py-2 text-right">Priority</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-subtle">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rules && rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-subtle">
                  No active rules.
                </td>
              </tr>
            )}
            {(rules ?? []).map((rule) => {
              const merchants = rule.merchant_patterns;
              const descriptions = rule.description_patterns;
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
                        <span className="mono text-text-primary">{descriptions.join(", ")}</span>
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-text-primary">
                    <span className="mono text-text-subtle">[{rule.category_code}]</span>{" "}
                    {rule.category_name}
                  </td>
                  <td className="mono px-3 py-1.5 text-right text-text-primary">
                    {rule.confidence.toFixed(2)}
                  </td>
                  <td className="mono px-3 py-1.5 text-right text-text-secondary">
                    {rule.priority}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p className="mt-6 max-w-3xl text-[12px] text-text-subtle">
        Rules are loaded from <span className="mono">backend/src/ledgerlens/data/category_rules.json</span>{" "}
        and validated against the active chart of accounts at server startup. Rules pointing at
        inactive or missing categories are skipped at load time. Generic tokens such as{" "}
        <span className="mono">ACH</span>, <span className="mono">POS</span>, or{" "}
        <span className="mono">TRANSFER</span> are stripped from patterns to prevent
        overmatching. When two rules disagree on the same input, the transaction is routed to
        the review queue instead of auto-applying either rule.
      </p>
    </AppShell>
  );
}
