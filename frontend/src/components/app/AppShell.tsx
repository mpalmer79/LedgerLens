"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logomark } from "@/components/ui/Logomark";
import {
  ApiError,
  getDemoReady,
  getHealth,
  getSession,
  type SessionResponse,
} from "@/lib/api/client";

type NavItem = { href: string; label: string };

/**
 * Owner path — the five steps a non-technical visitor follows.
 * Order matches the /start workflow + the small-business UX
 * roadmap. Kept short on purpose; cognitive overload was the
 * single biggest complaint in the owner-experience audit.
 */
const OWNER_NAV: NavItem[] = [
  { href: "/start", label: "Start" },
  { href: "/transactions/import", label: "Import" },
  { href: "/cleanup", label: "Cleanup" },
  { href: "/questions", label: "Questions" },
  { href: "/handoff", label: "Handoff" },
];

/**
 * Advanced / developer surface. Surfaced separately so a hiring
 * manager can still reach every page without burying the owner
 * path in noise.
 */
const ADVANCED_NAV: NavItem[] = [
  { href: "/demo", label: "Guided demo" },
  { href: "/app", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/review", label: "Review queue" },
  { href: "/mapping", label: "Mapping" },
  { href: "/corrections", label: "Learned corrections" },
  { href: "/rules", label: "Rules" },
  { href: "/ledger", label: "Ledger" },
  { href: "/evals", label: "Eval evidence" },
  { href: "/audit", label: "Audit events" },
];

/**
 * Five readiness states the header surfaces. `/health` answers
 * process liveness; `/demo/ready` answers whether the demo data
 * + workflow are usable. Treating them as one signal is exactly
 * what misled reviewers in the recent incident — they're now
 * separate.
 */
type ReadinessState =
  | "checking"
  | "process_ok_demo_ready"
  | "process_ok_demo_degraded"
  | "process_ok_demo_unavailable"
  | "process_unreachable";

function useBackendReadiness(): ReadinessState {
  const [state, setState] = useState<ReadinessState>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await getHealth();
      } catch (err) {
        if (!cancelled) {
          setState(err instanceof ApiError ? "process_unreachable" : "process_unreachable");
        }
        return;
      }
      // Process is alive; ask /demo/ready whether the demo data
      // and workflow tables are queryable. A failure here keeps the
      // header honest about partial outages.
      try {
        const ready = await getDemoReady();
        if (!cancelled) {
          setState(ready.ready ? "process_ok_demo_ready" : "process_ok_demo_degraded");
        }
      } catch {
        if (!cancelled) setState("process_ok_demo_unavailable");
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

/** Header status pill. Mobile-friendly; keeps two concerns visible
 *  without expanding into a full status bar. */
function ReadinessIndicator({ state }: { state: ReadinessState }) {
  // Each entry: dot tone, process label, demo label.
  const map: Record<
    ReadinessState,
    { tone: string; process: string; demo: string; aria: string }
  > = {
    checking: {
      tone: "bg-text-subtle",
      process: "Process: …",
      demo: "Demo: …",
      aria: "Checking backend status",
    },
    process_ok_demo_ready: {
      tone: "bg-brand-600",
      process: "Process: ok",
      demo: "Demo: ready",
      aria: "Backend process ok, demo data ready",
    },
    process_ok_demo_degraded: {
      tone: "bg-amber-500",
      process: "Process: ok",
      demo: "Demo: degraded",
      aria:
        "Backend process is up but one or more demo dependencies are not ready",
    },
    process_ok_demo_unavailable: {
      tone: "bg-amber-500",
      process: "Process: ok",
      demo: "Demo: unavailable",
      aria:
        "Backend process is up but demo readiness check did not respond",
    },
    process_unreachable: {
      tone: "bg-severity-critical",
      process: "Backend: unreachable",
      demo: "",
      aria: "Backend is unreachable",
    },
  };
  const entry = map[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-text-subtle"
      data-testid="appshell-readiness"
      data-readiness-state={state}
      title="Process liveness is separate from demo database readiness."
      aria-label={entry.aria}
    >
      <span className={`h-2 w-2 rounded-full ${entry.tone}`} aria-hidden="true" />
      <span className="whitespace-nowrap">{entry.process}</span>
      {entry.demo && (
        <>
          <span className="hidden text-text-subtle sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden whitespace-nowrap sm:inline">{entry.demo}</span>
        </>
      )}
    </span>
  );
}

function useSession(): SessionResponse | null {
  const [session, setSession] = useState<SessionResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSession();
        if (!cancelled) setSession(data);
      } catch {
        if (!cancelled) setSession(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return session;
}

function SessionBadge({ session }: { session: SessionResponse | null }) {
  if (!session) {
    return (
      <span
        className="hidden items-center gap-1.5 text-[11px] text-text-subtle sm:inline-flex"
        data-testid="session-badge-loading"
      >
        Demo session…
      </span>
    );
  }
  return (
    <span
      className="hidden items-center gap-1.5 text-[11px] text-text-subtle sm:inline-flex"
      data-testid="appshell-session-badge"
      title="Fictional public demo context — not production authentication."
    >
      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900">
        Demo session
      </span>
      <span className="whitespace-nowrap text-text-secondary">{session.business.name}</span>
      <span aria-hidden="true">·</span>
      <span className="whitespace-nowrap text-text-subtle">
        {session.user.display_name}
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const readiness = useBackendReadiness();
  const session = useSession();

  return (
    <div className="bg-surface-page text-text-primary min-h-screen">
      <header className="border-b border-surface-border bg-surface-panel">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/app" className="flex items-center gap-2 text-text-primary">
              <Logomark size={22} className="text-brand-600" />
              <span className="font-display text-[17px] font-medium">LedgerLens</span>
              <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-800">
                Demo prototype
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <SessionBadge session={session} />
              <ReadinessIndicator state={readiness} />
              <Link
                href="/"
                className="text-[12px] text-text-subtle hover:text-text-primary"
              >
                ← Landing
              </Link>
            </div>
          </div>
          <nav
            className="mt-3 -mb-px flex flex-nowrap items-center gap-x-4 overflow-x-auto whitespace-nowrap text-[14px] sm:flex-wrap sm:gap-x-5 sm:gap-y-1 sm:whitespace-normal scrollbar-thin"
            aria-label="Owner workflow"
            data-testid="owner-nav"
          >
            <span
              className="select-none text-[10px] font-medium uppercase tracking-wide text-text-subtle"
              aria-hidden="true"
            >
              Owner path
            </span>
            {OWNER_NAV.map((item) => {
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
          <nav
            className="mt-1 -mb-px flex flex-nowrap items-center gap-x-3 overflow-x-auto whitespace-nowrap text-[12px] sm:flex-wrap sm:gap-x-4 sm:gap-y-1 sm:whitespace-normal scrollbar-thin"
            aria-label="Technical and advanced"
            data-testid="advanced-nav"
          >
            <span
              className="select-none text-[10px] font-medium uppercase tracking-wide text-text-subtle"
              aria-hidden="true"
            >
              Technical
            </span>
            {ADVANCED_NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/app" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "border-b-2 border-brand-600 pb-1.5 font-medium text-text-primary"
                      : "border-b-2 border-transparent pb-1.5 text-text-subtle hover:text-text-primary"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
