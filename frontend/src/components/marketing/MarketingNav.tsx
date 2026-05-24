"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Logomark } from "@/components/ui/Logomark";
import { REPO_URL } from "@/lib/site";

type NavItem = { href: string; label: string; primary?: boolean };

const ITEMS: NavItem[] = [
  { href: "/cleanup", label: "Cleanup", primary: true },
  { href: "/handoff", label: "Handoff" },
  { href: "/demo", label: "Demo" },
  { href: "/technical-story", label: "Technical story" },
  { href: "/evals", label: "Evals" },
  { href: "/app", label: "App" },
  { href: "/about", label: "About Michael" },
];

/**
 * Public marketing nav used by `/`, `/about`, `/technical-story`.
 *
 * Below `md` the secondary links collapse behind a hamburger so the
 * primary "Demo" CTA + logomark stay visible at any phone width
 * without horizontal overflow.
 */
export function MarketingNav() {
  const [open, setOpen] = useState(false);

  // Close the drawer on route change / Esc / outside click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="relative border-b border-surface-border px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-text-primary">
          <Logomark size={22} className="text-brand-600" />
          <span className="font-display text-[17px] font-medium sm:text-[18px]">LedgerLens</span>
        </Link>

        {/* Desktop / large-tablet inline nav (≥ md) */}
        <div className="hidden items-center gap-4 text-[13px] md:flex lg:gap-5">
          <Link
            href="/cleanup"
            className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-500"
          >
            Start monthly cleanup →
          </Link>
          <Link href="/handoff" className="font-medium text-brand-700 hover:text-brand-800">
            Handoff
          </Link>
          <Link href="/demo" className="text-text-secondary hover:text-text-primary">
            Demo
          </Link>
          <Link href="/technical-story" className="text-text-secondary hover:text-text-primary">
            Technical story
          </Link>
          <Link href="/evals" className="text-text-secondary hover:text-text-primary">
            Evals
          </Link>
          <Link
            href="/about"
            className="font-medium text-text-primary hover:text-brand-700"
          >
            About Michael
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-text-primary"
          >
            GitHub
          </a>
        </div>

        {/* Mobile: primary CTA stays visible, secondary links go behind a sheet */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/cleanup"
            className="rounded-md bg-brand-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-500"
          >
            Cleanup →
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="marketing-mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-surface-border text-text-primary hover:bg-surface-sunken"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div
          id="marketing-mobile-menu"
          className="absolute inset-x-0 top-full z-40 border-b border-surface-border bg-surface-panel shadow-lg md:hidden"
        >
          <ul className="mx-auto flex max-w-6xl flex-col divide-y divide-surface-border text-[14px]">
            {ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block px-5 py-3.5 ${
                    item.primary
                      ? "font-medium text-brand-700"
                      : item.href === "/about"
                        ? "font-medium text-text-primary"
                        : "text-text-secondary"
                  } hover:bg-surface-sunken`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="block px-5 py-3.5 text-text-secondary hover:bg-surface-sunken"
              >
                GitHub
              </a>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
