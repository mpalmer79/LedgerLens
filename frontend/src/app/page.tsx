import Link from "next/link";
import {
  Database,
  ExternalLink,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Wallet,
  Workflow,
} from "lucide-react";

import { CheckApiButton } from "@/components/CheckApiButton";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { TrustPipeline } from "@/components/TrustPipeline";
import { VideoDemo } from "@/components/VideoDemo";
import {
  ARCHITECTURE_URL,
  GITHUB_PROFILE_URL,
  LINKEDIN_URL,
  REPO_URL,
  TRUST_METRIC_DOC_URL,
} from "@/lib/site";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "unset";

export default function Page() {
  return (
    <div className="bg-surface-page text-text-primary min-h-screen overflow-x-hidden">
      <MarketingNav />

      {/* Portfolio-demo chip */}
      <section className="border-b border-surface-border bg-surface-sunken/40">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 sm:px-6 lg:px-8 py-4">
          <span className="mt-0.5 inline-block whitespace-nowrap rounded bg-brand-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-800">
            Portfolio demo
          </span>
          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">What you&apos;re looking at:</span>{" "}
            a working full-stack prototype of an AI-assisted bookkeeping workflow. The data
            is synthetic; the deployed instance runs in zero-cost demo mode (no paid API
            spend). The backend pipeline, review workflow, audit trail, and eval harness are
            all real.
          </p>
        </div>
      </section>

      {/* Hero — business-first + premium trust card */}
      <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-12 md:pt-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.5px] text-brand-600">
              Monthly bookkeeping cleanup assistant
            </p>
            <h1 className="font-display text-[clamp(28px,7vw,48px)] font-medium leading-[1.1] text-text-primary md:text-5xl break-words">
              Clean up this month&apos;s books and send your accountant a{" "}
              <span className="text-brand-600">verified handoff.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-text-secondary">
              LedgerLens helps small business owners import bank activity, classify
              obvious vendors, answer plain-English review questions, and export a
              verified ledger package — without blindly trusting AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/cleanup"
                className="inline-flex items-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
              >
                Start monthly cleanup →
              </Link>
              <Link
                href="/handoff"
                className="inline-flex items-center gap-1.5 rounded-md border-2 border-brand-600 bg-transparent px-5 py-2.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                View accountant handoff
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                3-min guided demo →
              </Link>
              <Link
                href="/technical-story"
                className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                Engineering story →
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                About Michael →
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                GitHub →
              </a>
            </div>
            <p className="mt-5 max-w-2xl text-[13px] text-text-subtle">
              Built by{" "}
              <Link href="/about" className="text-text-secondary underline hover:text-text-primary">
                Michael Palmer
              </Link>{" "}
              as a portfolio project demonstrating AI workflow engineering, full-stack
              development, and practical product thinking.
            </p>
          </div>

          {/* Premium trust card — replaces the old raw-accuracy stat. */}
          <aside className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-xl border-2 border-brand-600 bg-gradient-to-br from-brand-100 via-surface-panel to-brand-100 p-6 shadow-sm">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-600/10 blur-2xl" />
              <p className="inline-block rounded bg-brand-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                Trust boundary
              </p>
              <p className="mt-4 font-display text-[clamp(40px,10vw,56px)] font-medium leading-none text-brand-900">
                100%
              </p>
              <p className="mt-1 text-[14px] font-medium uppercase tracking-wide text-brand-700">
                verified finalized demo ledger
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-brand-800">
                Finalized rows are backed by human review, correction memory, or
                deterministic rules <strong>before they appear in the handoff package.</strong>{" "}
                Workflow-level trust metric — not raw model accuracy.
              </p>
              <Link
                href="/evals"
                className="mt-3 inline-flex items-center text-[12px] font-medium text-brand-700 underline hover:text-brand-800"
              >
                See raw model evals →
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Visual pipeline — the system story in one row */}
      <section className="mx-auto mt-12 max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[22px] font-medium text-text-primary">
          The pipeline in one row
        </h2>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          Every transaction passes through the same layered workflow. The fallback layer is
          configurable: the public deploy uses a zero-cost demo stub; private development
          switches it to the real Anthropic model with one env-var change.
        </p>
        <div className="mt-5">
          <TrustPipeline />
        </div>
      </section>

      {/* Before / After */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[24px] font-medium text-text-primary">
          From messy transactions to accountant-ready handoff.
        </h2>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          Every small-business owner has the same Monday-of-the-month problem. Here&apos;s
          what the workflow looks like before and after.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Before
            </p>
            <ul className="mt-3 space-y-2 text-[13px] text-text-secondary">
              <li>· Uncategorized bank activity in a spreadsheet</li>
              <li>· Vague ACH transfers nobody remembers</li>
              <li>· Owner unsure what the Costco run was actually for</li>
              <li>· Accountant follow-up scattered across texts and emails</li>
              <li>· No clear review status anywhere</li>
            </ul>
          </div>
          <div className="rounded-lg border-2 border-brand-600 bg-brand-100 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
              After LedgerLens
            </p>
            <ul className="mt-3 space-y-2 text-[13px] text-brand-900">
              <li>· Obvious vendors classified by rules or correction memory</li>
              <li>· Uncertain rows routed to plain-English owner questions</li>
              <li>· Your answers captured as review notes for the accountant</li>
              <li>· Verified ledger rows separated from unresolved items</li>
              <li>· Markdown + CSV handoff package ready to send</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            What you get in the handoff package
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-y-2 text-[13px] text-text-primary sm:grid-cols-3">
            <li>✓ Verified ledger summary</li>
            <li>✓ Unresolved questions</li>
            <li>✓ Owner answers</li>
            <li>✓ Corrections learned</li>
            <li>✓ CSV export</li>
            <li>✓ Markdown handoff report</li>
          </ul>
        </div>
      </section>

      {/* Handoff preview card */}
      <section className="mx-auto mt-16 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-surface-border bg-surface-panel p-1 shadow-sm">
          <div className="rounded-lg bg-surface-page p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
                Example handoff preview
              </p>
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-subtle">
                illustrative
              </span>
            </div>
            <h3 className="mt-2 font-display text-[20px] font-medium text-text-primary">
              Accountant handoff package — March 2026
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <PreviewTile label="Transactions imported" value="24" />
              <PreviewTile label="Verified finalized rows" value="18" tone="good" />
              <PreviewTile label="Owner questions answered" value="4" />
              <PreviewTile label="Still needs review" value="2" tone="warn" />
              <PreviewTile label="Corrections learned" value="3" />
              <PreviewTile label="Verification rate" value="100%" tone="good" />
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PreviewBlock title="Ready for accountant">
                Verified rows backed by review, memory, or a deterministic rule.
                Export as CSV or copy from the markdown summary.
              </PreviewBlock>
              <PreviewBlock title="Needs review">
                Two items the owner flagged for accountant follow-up — explained in the
                owner-answers section, never silently finalized.
              </PreviewBlock>
              <PreviewBlock title="Owner answers">
                Plain-English notes captured during the questions workflow. Forwarded
                with the handoff so the accountant has business context.
              </PreviewBlock>
              <PreviewBlock title="Corrections learned">
                New (merchant → category) rules saved this month. The system will reuse
                them next month at zero model cost.
              </PreviewBlock>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/handoff"
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Open the live handoff page →
              </Link>
              <Link
                href="/cleanup"
                className="inline-flex items-center rounded-md border border-surface-border-strong px-4 py-2 text-[13px] font-medium text-text-primary hover:bg-surface-sunken"
              >
                Start monthly cleanup
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-text-subtle">
              The numbers above are illustrative. The live{" "}
              <Link href="/handoff" className="underline">/handoff</Link>{" "}
              page is driven by the actual database.
            </p>
          </div>
        </div>
      </section>

      {/* 30-second walkthrough */}
      <section className="mt-16">
        <VideoDemo />
      </section>

      {/* Three business value cards */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[24px] font-medium text-text-primary">
          Why a small-business owner cares
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <ValueCard
            icon={<Wallet size={22} className="text-brand-600" />}
            title="Save bookkeeping cleanup time"
            body="Obvious vendors — QuickBooks, Zoom, Staples, Stripe fees, fuel — are categorized automatically by deterministic rules. No prompt engineering, no waiting on a model."
          />
          <ValueCard
            icon={<ShieldCheck size={22} className="text-brand-600" />}
            title="Reduce expensive mistakes"
            body="Ambiguous transactions — Amazon orders, vague ACH transfers, unfamiliar vendors — are routed to a review queue instead of guessed. Wrong categories cost real money at tax time."
          />
          <ValueCard
            icon={<ListChecks size={22} className="text-brand-600" />}
            title="Improve with every correction"
            body="When a reviewer corrects a transaction, that decision becomes reusable memory. The next similar vendor is categorized from the prior correction at zero cost — auditable, not opaque."
          />
        </div>
      </section>

      {/* Recruiter-facing technical credibility */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-[24px] font-medium text-text-primary">
          Built like an AI workflow system, not an LLM wrapper.
        </h2>
        <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
          The product story is bookkeeping. The engineering story is layered AI design with
          cost control and auditability built in.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TechCard
            icon={<Workflow size={20} className="text-brand-600" />}
            title="Layered decision logic"
            body="Correction memory → deterministic rules → demo stub (or real model) → confidence routing → human review."
          />
          <TechCard
            icon={<Database size={20} className="text-brand-600" />}
            title="Full-stack persistence"
            body="FastAPI + SQLAlchemy 2.0 + Postgres-ready (SQLite for demo). Idempotent migrations, seeded chart of accounts, lazy provider config."
          />
          <TechCard
            icon={<ShieldCheck size={20} className="text-brand-600" />}
            title="Audit trail on every state change"
            body="Categorize, correct, approve, reject, demo seed/reset — each writes an AuditEvent with provider attribution. The model never claims authorship of a stub decision."
          />
          <TechCard
            icon={<Sparkles size={20} className="text-brand-600" />}
            title="Demo-safe zero-cost mode"
            body="CATEGORIZER_MODE=demo_stub guarantees no paid API calls. The anthropic SDK is never imported in demo mode (regression-tested)."
          />
          <TechCard
            icon={<ListChecks size={20} className="text-brand-600" />}
            title="Honest evaluation"
            body="Routing + calibration + confusion-pair metrics. ECE and high-confidence warning. Rules-only and hybrid eval modes. Tenant-COA caveat called out, not hidden."
          />
          <TechCard
            icon={<Workflow size={20} className="text-brand-600" />}
            title="Typed contract end-to-end"
            body="Next.js 14 App Router with a typed API client. Vitest on the client; pytest, ruff, mypy --strict on the backend. CI gates per PR."
          />
        </div>
        <p className="mt-6 text-[13px] text-text-secondary">
          <Link href="/technical-story" className="text-brand-700 underline">
            Full engineering story →
          </Link>{" "}
          ·{" "}
          <Link href="/evals" className="text-brand-700 underline">
            eval evidence →
          </Link>{" "}
          ·{" "}
          <a
            href={TRUST_METRIC_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-700 underline"
          >
            trust metric doc →
          </a>
        </p>
      </section>

      {/* About-Michael strip */}
      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-surface-border bg-surface-panel p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-brand-600">
                About the builder
              </p>
              <h2 className="mt-2 font-display text-[20px] font-medium text-text-primary">
                Michael Palmer
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                Computer Science student and software/AI developer with 25 years of
                automotive retail and operations experience, including enterprise
                implementation work at CDK Global. Building practical AI workflow systems
                with guardrails, auditability, and human oversight.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-500"
              >
                Read more about Michael →
              </Link>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary"
              >
                LinkedIn <ExternalLink size={12} />
              </a>
              <a
                href={GITHUB_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-text-primary"
              >
                GitHub <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Live API health */}
      <section className="mx-auto mt-20 max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-center font-display text-[16px] font-medium text-text-primary">
          Live API health
        </h2>
        <CheckApiButton apiBaseUrl={API_BASE_URL} />
      </section>

      {/* Footer */}
      <footer className="mt-24 border-t border-surface-border px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="text-sm text-text-primary">LedgerLens</p>
              <p className="mt-1 text-[13px] text-text-subtle">
                Portfolio project by{" "}
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 hover:text-brand-500"
                >
                  Michael Palmer
                </a>
                . PalmerAI Solutions is Michael&apos;s personal portfolio brand for
                practical AI workflow systems — not a commercial SaaS.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-[13px] sm:items-end">
              <Link href="/demo" className="text-text-secondary hover:text-text-primary">
                Guided demo
              </Link>
              <Link
                href="/technical-story"
                className="text-text-secondary hover:text-text-primary"
              >
                Technical story
              </Link>
              <Link href="/evals" className="text-text-secondary hover:text-text-primary">
                Eval evidence
              </Link>
              <Link href="/about" className="text-text-secondary hover:text-text-primary">
                About Michael
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                GitHub repo
              </a>
              <a
                href={GITHUB_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                GitHub profile
              </a>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                LinkedIn
              </a>
              <a
                href={ARCHITECTURE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                Architecture
              </a>
            </div>
          </div>
          <p className="mt-8 border-t border-surface-border pt-6 text-[11px] text-text-subtle">
            © {new Date().getFullYear()} Michael Palmer. LedgerLens is a portfolio project
            built to demonstrate AI-systems engineering practice. No financial data leaves
            your environment.
          </p>
        </div>
      </footer>
    </div>
  );
}

type CardProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

function ValueCard({ icon, title, body }: CardProps) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-6">
      {icon}
      <h3 className="mb-2 mt-4 font-display text-[17px] font-medium text-text-primary">
        {title}
      </h3>
      <p className="text-[14px] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function TechCard({ icon, title, body }: CardProps) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-[15px] font-medium text-text-primary">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}

function PreviewTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  const valueClass =
    tone === "good"
      ? "text-brand-700"
      : tone === "warn"
        ? "text-amber-800"
        : "text-text-primary";
  return (
    <div className="rounded-md border border-surface-border bg-surface-panel p-3">
      <p className="field-label">{label}</p>
      <p className={`mt-1 font-display text-[22px] font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}

function PreviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-surface-border bg-surface-panel p-3">
      <p className="text-[12px] font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{children}</p>
    </div>
  );
}
