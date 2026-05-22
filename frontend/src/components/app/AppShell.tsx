"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logomark } from "@/components/ui/Logomark";
import { ApiError, getHealth } from "@/lib/api/client";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/transactions/import", label: "Import" },
  { href: "/transactions", label: "Transactions" },
  { href: "/review", label: "Review queue" },
  { href: "/ledger", label: "Ledger" },
  { href: "/evals", label: "Eval evidence" },
];

type HealthState = "checking" | "ok" | "unreachable";

function useBackendHealth(): HealthState {
  const [state, setState] = useState<HealthState>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await getHealth();
        if (!cancelled) setState("ok");
      } catch (err) {
        if (!cancelled) setState(err instanceof ApiError ? "unreachable" : "unreachable");
      }
    };
    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return state;
}

function HealthDot({ state }: { state: HealthState }) {
  const map = {
    checking: { color: "bg-text-subtle", label: "Checking API…" },
    ok: { color: "bg-brand-600", label: "API: ok" },
    unreachable: { color: "bg-severity-critical", label: "API: unreachable" },
  };
  const { color, label } = map[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle">
      <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const health = useBackendHealth();

  return (
    <div className="bg-surface-page text-text-primary min-h-screen">
      <header className="border-b border-surface-border bg-surface-panel">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/app" className="flex items-center gap-2 text-text-primary">
              <Logomark size={22} className="text-brand-600" />
              <span className="font-display text-[17px] font-medium">LedgerLens</span>
              <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
                Demo prototype
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <HealthDot state={health} />
              <Link
                href="/"
                className="text-[12px] text-text-subtle hover:text-text-primary"
              >
                ← Landing
              </Link>
            </div>
          </div>
          <nav className="mt-3 -mb-px flex flex-wrap gap-x-5 gap-y-1 overflow-x-auto text-[14px]">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/app" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "border-b-2 border-brand-600 pb-2 font-medium text-text-primary"
                      : "border-b-2 border-transparent pb-2 text-text-secondary hover:text-text-primary"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
