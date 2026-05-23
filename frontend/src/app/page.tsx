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
import { Logomark } from "@/components/ui/Logomark";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "unset";
const REPO_URL = "https://github.com/mpalmer79/LedgerLens";
const ARCHITECTURE_URL = `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`;
const LINKEDIN_URL = "https://linkedin.com/in/michael-palmer";

export default function Page() {
  return (
    <div className="bg-surface-page text-text-primary min-h-screen">
      {/* Top nav */}
      <nav className="border-b border-surface-border px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Logomark size={24} className="text-brand-600" />
            <span className="font-display text-[18px] font-medium">LedgerLens</span>
          </Link>
          <div className="flex items-center gap-6 text-[13px]">
            <Link
              href="/demo"
              className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-500"
            >
              Start the 3-minute demo →
            </Link>
            <Link
              href="/app"
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              Open app
            </Link>
            <Link
              href="/evals"
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              Eval evidence
            </Link>
            <a
              href={REPO_URL}
              className="text-text-secondary transition-colors hover:text-text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Portfolio-demo chip */}
      <section className="border-b border-surface-border bg-surface-sunken/40">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-8 py-4">
          <span className="mt-0.5 inline-block whitespace-nowrap rounded bg-brand-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-800">
            Portfolio demo
          </span>
          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">What you&apos;re looking at:</span>{" "}
            a working full-stack prototype of an AI-assisted bookkeeping workflow. The data is
            synthetic and the deployed instance runs in zero-cost demo mode (no paid API spend);
            every other layer — the backend pipeline, the review workflow, the audit trail, the
            eval harness — is real.
          </p>
        </div>
      </section>

      {/* Hero — business-first */}
      <section className="px-8 pt-12 pb-12 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.5px] text-brand-600">
            For small-business bookkeeping cleanup
          </p>
          <h1 className="font-display text-4xl font-medium leading-[1.15] text-text-primary md:text-5xl">
            Turn messy bank transactions into a{" "}
            <span className="text-brand-600">reviewed small-business ledger.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-text-secondary">
            LedgerLens helps small-business owners categorize expenses, flag uncertain
            transactions, remember human corrections, and export a clean ledger — without
            blindly trusting AI.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/demo"
              className="inline-flex items-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
            >
              Start the 3-minute demo →
            </Link>
            <a
              href={ARCHITECTURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border-strong bg-transparent px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-sunken"
            >
              View the technical architecture
              <ExternalLink size={14} className="text-text-subtle" />
            </a>
          </div>
        </div>
      </section>

      {/* Three business value cards */}
      <section className="mx-auto max-w-6xl px-8">
        <h2 className="font-display text-[26px] font-medium text-text-primary">
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

      {/* The bookkeeping mess (problem statement) */}
      <section className="mx-auto mt-20 max-w-5xl px-8">
        <div className="rounded-lg border border-surface-border bg-surface-panel p-6">
          <h2 className="font-display text-[22px] font-medium text-text-primary">
            The monthly cleanup problem
          </h2>
          <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
            Every month a small-business owner sees lines like these — some obvious, others
            ambiguous, several risky. A blind AI guess on a payroll run or a State Farm payment
            can quietly land in the wrong account and stay there until tax season.
          </p>
          <ul className="mono mt-4 grid grid-cols-1 gap-y-1 text-[12px] text-text-secondary sm:grid-cols-2">
            <li>COMCAST BUSINESS INTERNET MAR</li>
            <li>QUICKBOOKS ONLINE PLUS</li>
            <li>ADP PAYROLL BI-WEEKLY</li>
            <li>STATE FARM POLICY 49KF-NH</li>
            <li>STRIPE PROCESSING FEE</li>
            <li>STAPLES STORE 4471</li>
            <li>AMAZON BUSINESS ORDER 113-44</li>
            <li>ACH TRANSFER VENDOR REF 99812</li>
          </ul>
          <p className="mt-4 text-[13px] text-text-secondary">
            <Link href="/demo" className="text-brand-700 underline">
              Walk through the demo →
            </Link>{" "}
            to see how the layered pipeline handles each one.
          </p>
        </div>
      </section>

      {/* Recruiter-facing technical credibility */}
      <section className="mx-auto mt-20 max-w-6xl px-8">
        <h2 className="font-display text-[26px] font-medium text-text-primary">
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
          <Link href="/evals" className="text-brand-700 underline">
            See the eval evidence →
          </Link>{" "}
          for raw model performance and calibration. The product&apos;s headline number
          isn&apos;t raw model accuracy — it&apos;s{" "}
          <strong>finalized rows verified before export</strong>, the topic of the next
          section.
        </p>
      </section>

      {/* Trust boundary — the product's headline number */}
      <section className="mx-auto mt-20 max-w-5xl px-8">
        <div className="rounded-lg border-2 border-brand-600 bg-brand-100 p-6">
          <p className="mb-2 inline-block rounded bg-brand-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            Trust metric
          </p>
          <h2 className="font-display text-[24px] font-medium text-brand-900">
            100% of finalized guided-demo ledger rows are verified before export.
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-brand-800">
            That&apos;s not a claim about raw model accuracy. Raw AI accuracy on adversarial
            bookkeeping data is not the right trust boundary for financial workflows — the eval
            page reports it honestly (model-only ≈ 63% on the synthetic dataset). The number
            above is what the product actually guarantees: a finalized row is only counted
            when its category came from a deterministic rule auto-approval, a correction-memory
            replay of a prior human decision, or an explicit human review on this row.
          </p>
          <ul className="mt-4 space-y-1 text-[13px] text-brand-900">
            <li>· Uncertain transactions silently finalized: <strong>0</strong></li>
            <li>· Demo-stub results are never finalized — they route to review.</li>
            <li>· Unreviewed model auto-approvals are never finalized — they require sign-off.</li>
            <li>· The CSV export carries a per-row <span className="mono">verified</span> column for downstream filtering.</li>
          </ul>
          <p className="mt-4 text-[12px] text-brand-700">
            <Link href="/demo" className="underline">
              Walk the guided demo →
            </Link>{" "}
            to see the trust panel update in real time as the pipeline runs.
          </p>
        </div>
      </section>

      {/* Live API health */}
      <section className="mx-auto mt-20 max-w-3xl px-8">
        <h2 className="mb-6 text-center font-display text-[18px] font-medium text-text-primary">
          Live API health
        </h2>
        <CheckApiButton apiBaseUrl={API_BASE_URL} />
      </section>

      {/* Footer */}
      <footer className="mt-24 border-t border-surface-border px-8 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <p className="text-sm text-text-primary">
                Built by{" "}
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:text-brand-500"
                >
                  Michael Palmer
                </a>
              </p>
              <p className="mt-1 text-[13px] text-text-subtle">PalmerAI Solutions</p>
            </div>
            <div className="flex flex-col gap-2 text-[13px] sm:items-end">
              <Link href="/demo" className="text-text-secondary hover:text-text-primary">
                Guided demo
              </Link>
              <Link href="/app" className="text-text-secondary hover:text-text-primary">
                Open the app
              </Link>
              <Link href="/evals" className="text-text-secondary hover:text-text-primary">
                Eval evidence
              </Link>
              <a
                href={ARCHITECTURE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                Architecture
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                GitHub repo
              </a>
            </div>
          </div>
          <p className="mt-8 border-t border-surface-border pt-6 text-[11px] text-text-subtle">
            © {new Date().getFullYear()} PalmerAI Solutions. LedgerLens is a portfolio project
            built to demonstrate AI-systems engineering practice. No financial data leaves your
            environment.
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
