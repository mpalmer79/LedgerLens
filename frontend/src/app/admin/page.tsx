"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app/AppShell";
import { ErrorState, LoadingState } from "@/components/ui/DataState";
import { getFoundationStatus, type FoundationStatus } from "@/lib/api/client";

/**
 * Admin / Tenant Foundation shell.
 *
 * Renders the backend's honest snapshot of what does and does not
 * exist yet. There is NO login form. This sprint ships only the
 * schema foundation; production authentication, sessions, and
 * tenant enforcement are explicitly future work.
 */

type State = {
  loading: boolean;
  error: unknown;
  status: FoundationStatus | null;
};

export default function AdminPage() {
  const [state, setState] = useState<State>({
    loading: true,
    error: null,
    status: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const status = await getFoundationStatus();
      setState({ loading: false, error: null, status });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const status = state.status;

  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Tenant foundation
        </p>
        <h1 className="mt-2 font-display text-[clamp(22px,5vw,30px)] font-medium leading-tight text-text-primary">
          Admin shell — schema foundation only
        </h1>
        <div
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900"
          data-testid="admin-shell-warning"
        >
          <p className="font-medium">
            Authentication and tenant isolation are not fully implemented in this
            public demo.
          </p>
          <p className="mt-1">
            This page reports what exists in the schema today. There is no login
            UI. Public-demo routes remain unauthenticated. Do not upload real bank
            data.
          </p>
        </div>
      </header>

      {state.error !== null && (
        <ErrorState error={state.error} onRetry={() => void load()} />
      )}

      {state.loading && <LoadingState label="Loading foundation status…" />}

      {!state.loading && status !== null && (
        <>
          <section className="mt-6">
            <h2 className="font-display text-[18px] font-medium text-text-primary">
              Foundation status
            </h2>
            <ul
              className="mt-3 divide-y divide-surface-border rounded border border-surface-border"
              data-testid="foundation-status-list"
            >
              <StatusRow label="User model" ok={status.tenant_models_present} note="added" />
              <StatusRow
                label="Tenant / Organization model"
                ok={status.tenant_models_present}
                note="added"
              />
              <StatusRow
                label="Membership model"
                ok={status.tenant_models_present}
                note="added"
              />
              <StatusRow
                label="Business model"
                ok={status.tenant_models_present}
                note="added"
              />
              <StatusRow
                label="Demo tenant seeded"
                ok={status.demo_tenant_available}
                note={status.demo_tenant_available ? "ledgerlens-demo" : "not seeded"}
              />
              <StatusRow
                label="Demo business seeded"
                ok={status.demo_business_available}
                note={
                  status.demo_business_available
                    ? "granite-state-auto-repair"
                    : "not seeded"
                }
              />
              <StatusRow
                label="Route protection"
                ok={false}
                note="not implemented"
              />
              <StatusRow
                label="Production auth"
                ok={status.auth_implemented}
                note="not implemented"
              />
              <StatusRow
                label="Full tenant enforcement"
                ok={status.tenant_enforcement_complete}
                note="not complete"
              />
              <StatusRow
                label="Public demo data only"
                ok={true}
                note="synthetic / sample CSVs only"
              />
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-[18px] font-medium text-text-primary">
              Counts (current workspace)
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <CountCard label="Users" value={status.user_count} />
              <CountCard label="Tenants" value={status.tenant_count} />
              <CountCard label="Memberships" value={status.membership_count} />
              <CountCard label="Businesses" value={status.business_count} />
            </dl>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-[18px] font-medium text-text-primary">
              Honesty warnings (from backend)
            </h2>
            <ul className="mt-3 space-y-2">
              {status.warnings.map((w) => (
                <li
                  key={w}
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
                >
                  {w}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="font-display text-[18px] font-medium text-text-primary">
              Login UI
            </h2>
            <p
              className="mt-3 rounded border border-surface-border bg-surface-panel p-3 text-[13px] text-text-secondary"
              data-testid="login-placeholder"
            >
              Login UI is intentionally not implemented in this public demo.
              Adding a fake form would imply security that does not exist. The
              auth Phase 2 PR will ship a real session-based login behind a
              feature flag.
            </p>
          </section>

          <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DocLink
              href="https://github.com/mpalmer79/LedgerLens/blob/main/docs/SECURITY_AND_PRODUCTION_READINESS.md"
              title="Security &amp; production readiness"
            />
            <DocLink
              href="https://github.com/mpalmer79/LedgerLens/blob/main/docs/AUTH_TENANT_FOUNDATION.md"
              title="Auth / tenant foundation blueprint"
            />
            <DocLink
              href="https://github.com/mpalmer79/LedgerLens/blob/main/docs/ACCOUNTING_DOMAIN_BOUNDARY.md"
              title="Accounting domain boundary"
            />
          </section>

          <p className="mt-8 text-[12px] text-text-subtle">
            See{" "}
            <Link href="/technical-story" className="text-brand-700 underline">
              the technical story
            </Link>{" "}
            for the full production-readiness roadmap and current honest framing.
          </p>
        </>
      )}
    </AppShell>
  );
}

function StatusRow({
  label,
  ok,
  note,
}: {
  label: string;
  ok: boolean;
  note: string;
}) {
  return (
    <li className="grid grid-cols-1 gap-1 p-3 text-[13px] sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
      <span className="text-text-primary">{label}</span>
      <span
        className={
          ok
            ? "inline-flex items-center gap-1 text-emerald-700"
            : "inline-flex items-center gap-1 text-amber-800"
        }
      >
        <span className="mono">{ok ? "✓" : "·"}</span>
        <span>{note}</span>
      </span>
    </li>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-surface-border bg-surface-panel p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </p>
      <p className="mt-1 mono text-[18px] font-medium text-text-primary">{value}</p>
    </div>
  );
}

function DocLink({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded border border-surface-border bg-surface-panel p-3 text-[13px] text-text-primary hover:bg-brand-100"
    >
      {title} →
    </a>
  );
}
