"use client";

import Link from "next/link";

import { AppShell } from "@/components/app/AppShell";

/**
 * Owner-facing "Start here" path.
 *
 * Pure static — no backend dependency, so this page is always
 * presentable even during a partial outage. The five steps mirror
 * the actual workflow; each one links to the page that does the
 * real work.
 */

const STEPS: ReadonlyArray<{
  number: string;
  title: string;
  body: string;
  cta: { href: string; label: string };
  secondary?: { href: string; label: string };
}> = [
  {
    number: "01",
    title: "Use the sample CSV or synthetic test data",
    body: "LedgerLens is a public portfolio demo. Do not upload real bank data. The guided demo loads a 42-row fictional auto-repair-shop scenario; the import wizard ships with a downloadable sample CSV.",
    cta: { href: "/demo", label: "Start guided demo" },
    secondary: { href: "/transactions/import", label: "Open import wizard" },
  },
  {
    number: "02",
    title: "Import and map CSV columns",
    body: "Drop or paste a bank CSV. The wizard auto-detects Date / Description / Amount (or Debit / Credit) columns and lets you fix anything it gets wrong before committing the rows.",
    cta: { href: "/transactions/import", label: "Open import wizard" },
  },
  {
    number: "03",
    title: "Confirm category mappings",
    body: "Review how rule intents like parts_inventory or fuel_vehicle resolve to chart-of-accounts codes for the active business. Edits persist; block-fallback routes ambiguous matches to review instead of auto-categorizing.",
    cta: { href: "/mapping", label: "Open category mapping" },
  },
  {
    number: "04",
    title: "Answer plain-English owner questions",
    body: "For rows the rule layer can't safely finalize, LedgerLens asks the owner one short question per card. \"Needs accountant review\" and \"Not sure\" never silently approve a predicted category — they route to the accountant follow-up bucket.",
    cta: { href: "/questions", label: "Open owner questions" },
    secondary: { href: "/review", label: "Open full review queue" },
  },
  {
    number: "05",
    title: "Export the accountant handoff",
    body: "Get a markdown summary + two accountant-friendly CSVs (reviewed + follow-up). Every export carries the workflow-verified badge, the owner's plain-English answers inline, and the disclaimer that this is not tax advice and not a substitute for accounting review.",
    cta: { href: "/handoff", label: "View sample handoff" },
  },
];

const FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "Is this a product I can buy?",
    a: "No. LedgerLens is a portfolio project, not a commercial SaaS. There is no signup, no pricing, no subscription.",
  },
  {
    q: "Can I upload real bank data?",
    a: "No. The public demo runs on a single shared database with no authentication and no per-tenant isolation. Use the bundled sample CSV or invented data only.",
  },
  {
    q: "Does it connect to my bank?",
    a: "No. There is no Plaid, MX, Yodlee, or direct-bank integration. The only way data enters the demo is the CSV import wizard.",
  },
  {
    q: "Does it use QuickBooks, Xero, or Plaid?",
    a: "No. The CSV exports are formatted for human accountant review. They are not QuickBooks / QBO / IIF / Xero import files. Direct integrations are documented as future work in the security roadmap.",
  },
  {
    q: "What happens to ambiguous vendors like Amazon or Costco?",
    a: "They route to the owner-question flow with a small multiple-choice template. The owner picks the category that applies (or flags it for accountant review). The model never silently chooses a category for an ambiguous vendor.",
  },
  {
    q: "Can my accountant log in?",
    a: "Not yet. Auth Phase 1 ships the user / tenant / membership schema; Phase 2 will add login + the accountant role. Today the accountant collaboration surface is the exported handoff package.",
  },
  {
    q: "What does \"verified\" mean?",
    a: "Workflow-verified, not CPA-verified. A row counts as verified when its final category came through a deterministic rule, a correction-memory replay, or an explicit human review. It is not a claim about accounting or tax correctness.",
  },
  {
    q: "Where does the data live in this demo?",
    a: "Synthetic / sample CSVs in a public Railway Postgres database that's shared across visitors. No real PII, no real bank statements. The two warnings on the import page repeat this on every visit.",
  },
  {
    q: "What would production require?",
    a: "Auth + tenant isolation (Phase 2 schema work in progress), PII redaction before any LLM call, backups + retention policy, payment integration if billed, and a proper Plaid / accounting-software integration. The full roadmap lives in docs/SECURITY_AND_PRODUCTION_READINESS.md.",
  },
];

export default function StartPage() {
  return (
    <AppShell>
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-brand-600">
          Start here
        </p>
        <h1 className="mt-2 font-display text-[clamp(24px,5vw,32px)] font-medium leading-tight text-text-primary">
          Owner workflow in five steps
        </h1>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          LedgerLens is a monthly bookkeeping cleanup assistant. The five
          steps below mirror the actual workflow — sample data goes in, a
          reviewed accountant handoff comes out. The whole thing is built
          to be cleaned up in under a coffee break on a phone.
        </p>
        <div
          role="alert"
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900"
          data-testid="start-public-demo-warning"
        >
          <p className="font-medium">
            Public demo — use synthetic / sample data only.
          </p>
          <p className="mt-1">
            There is no authentication and no per-tenant isolation on this
            deploy. Do not upload real bank data, customer information,
            employee information, or account numbers.
          </p>
        </div>
      </header>

      <section
        className="mt-6 grid grid-cols-1 gap-4"
        data-testid="start-steps"
      >
        {STEPS.map((step) => (
          <article
            key={step.number}
            className="rounded-lg border border-surface-border bg-surface-panel p-4"
            data-testid={`start-step-${step.number}`}
          >
            <div className="flex items-baseline gap-3">
              <span className="mono text-[20px] font-medium text-brand-600">
                {step.number}
              </span>
              <h2 className="font-display text-[18px] font-medium text-text-primary">
                {step.title}
              </h2>
            </div>
            <p className="mt-2 text-[13px] text-text-secondary">{step.body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={step.cta.href}
                className="inline-flex min-h-[44px] items-center rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                {step.cta.label} →
              </Link>
              {step.secondary && (
                <Link
                  href={step.secondary.href}
                  className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-page px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
                >
                  {step.secondary.label}
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-[22px] font-medium text-text-primary">
          Owner questions, answered plainly
        </h2>
        <p className="mt-1 text-[12px] text-text-subtle">
          The kind of questions an owner asks before spending 15 minutes on
          a new tool.
        </p>
        <dl
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
          data-testid="start-faq"
        >
          {FAQ.map(({ q, a }) => (
            <div
              key={q}
              className="rounded border border-surface-border bg-surface-panel p-4"
            >
              <dt className="text-[13px] font-medium text-text-primary">{q}</dt>
              <dd className="mt-2 text-[13px] text-text-secondary">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 rounded-lg border border-surface-border bg-surface-panel p-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand-600">
          For hiring managers and collaborators
        </p>
        <h2 className="mt-1 font-display text-[20px] font-medium text-text-primary">
          LedgerLens is a portfolio prototype
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] text-text-secondary">
          If you&apos;re reviewing Michael Palmer for AI workflow, software
          engineering, or solutions roles, the technical story page is the
          fastest read. The GitHub repo carries the full source, every
          docs/ folder, and the test suite.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/technical-story"
            className="inline-flex min-h-[44px] items-center rounded bg-brand-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
          >
            View technical story →
          </Link>
          <a
            href="https://github.com/mpalmer79/LedgerLens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-page px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
          >
            View GitHub repo
          </a>
          <Link
            href="/about"
            className="inline-flex min-h-[44px] items-center rounded border border-surface-border bg-surface-page px-3 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
          >
            About the builder
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
