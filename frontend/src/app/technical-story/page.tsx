import type { Metadata } from "next";
import Link from "next/link";

import { MarketingNav } from "@/components/marketing/MarketingNav";
import { TrustPipeline } from "@/components/TrustPipeline";
import {
  ARCHITECTURE_URL,
  GITHUB_PROFILE_URL,
  LINKEDIN_URL,
  REPO_URL,
  TRUST_METRIC_DOC_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Technical story | LedgerLens",
  description:
    "How LedgerLens layers correction memory, deterministic rules, review routing, audit trails, and a configurable model fallback into a verified bookkeeping workflow.",
};

const LLM_VS_LEDGER: { capability: string; wrapper: string; ledger: string }[] = [
  {
    capability: "Input shape",
    wrapper: "Free-form chat prompt",
    ledger: "Persisted transaction with normalized fields",
  },
  {
    capability: "Decision logic",
    wrapper: "One model call returns one answer",
    ledger: "Memory → rules → fallback → confidence routing",
  },
  {
    capability: "Uncertainty handling",
    wrapper: "Hallucinates an answer",
    ledger: "Routes to a human review queue",
  },
  {
    capability: "Improvement loop",
    wrapper: "Manual prompt tuning",
    ledger: "Human corrections become deterministic memory rules",
  },
  {
    capability: "Audit trail",
    wrapper: "None by default",
    ledger: "AuditEvent on every state change, with provider attribution",
  },
  {
    capability: "Trust metric",
    wrapper: "Model accuracy (if measured at all)",
    ledger: "Procedurally verified rows — workflow trust boundary, not CPA-correct",
  },
  {
    capability: "Cost control on public demo",
    wrapper: "Pays per call",
    ledger: "Demo-stub mode never imports the SDK (regression-tested)",
  },
];

const STACK: string[] = [
  "Next.js 14 (App Router)",
  "TypeScript",
  "FastAPI",
  "SQLAlchemy 2.0",
  "SQLAlchemy 2.0 models (SQLite for demo, Postgres-compatible in principle)",
  "Docker",
  "Railway",
  "Anthropic Claude Haiku 4.5 (opt-in)",
  "pytest",
  "Vitest",
  "ruff",
  "mypy --strict",
];

export default function TechnicalStoryPage() {
  return (
    <div className="bg-surface-page text-text-primary min-h-screen overflow-x-hidden">
      <MarketingNav />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header>
          <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-brand-600">
            Engineering story
          </p>
          <h1 className="mt-3 font-display text-[clamp(26px,6vw,40px)] font-medium leading-tight text-text-primary">
            Built like an AI workflow system, not an LLM wrapper.
          </h1>
          <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-text-secondary">
            LedgerLens is a portfolio demonstration of layered AI design with operational
            discipline built in. This page exists so a recruiter or engineering reviewer
            can evaluate the depth in under 60 seconds.
          </p>
        </header>

        {/* Reviewer takeaway — the one-card version of this page. */}
        <section className="mt-8 rounded-lg border-2 border-brand-600 bg-brand-100 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
            Reviewer takeaway
          </p>
          <p className="mt-2 font-display text-[18px] font-medium text-brand-900">
            LedgerLens demonstrates layered AI decisioning, full-stack implementation,
            persistent workflow state, evaluation discipline, and deployment readiness.
          </p>
          <p className="mt-2 text-[13px] text-brand-800">
            The rest of this page exists to back up that sentence. Skim the sections, or
            jump straight to <Link href="/demo" className="underline">/demo</Link> /{" "}
            <Link href="/evals" className="underline">/evals</Link> /{" "}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline">
              GitHub
            </a>
            .
          </p>
        </section>

        {/* 1. Product problem */}
        <Section number="01" title="Product problem">
          <p className="text-[14px] leading-relaxed text-text-secondary">
            Small businesses need monthly bookkeeping cleanup. Bank exports are full of
            cryptic merchant strings, payroll runs, and ambiguous ACH transfers. A blind AI
            guess on a State Farm payment or a Stripe payout can quietly contaminate the
            books and stay wrong until tax season. The product&apos;s job is to make the
            obvious cases cheap, route the uncertain ones to a human, and guarantee that
            nothing reaches a finalized ledger without a defensible authority.
          </p>
        </Section>

        {/* 2. System architecture */}
        <Section number="02" title="System architecture">
          <p className="mb-5 text-[14px] leading-relaxed text-text-secondary">
            Every transaction passes through the same layered pipeline. The fallback layer
            is configurable: the public deploy uses a zero-cost demo stub; private
            development switches it to Claude Haiku 4.5 with one env-var change.
          </p>
          <TrustPipeline />
          <p className="mt-4 text-[12px] text-text-subtle">
            Audit events are written on every state change.{" "}
            <a
              href={ARCHITECTURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline"
            >
              Full architecture document →
            </a>
          </p>
        </Section>

        {/* 3. Why not an LLM wrapper */}
        <Section number="03" title="Why this is not an LLM wrapper">
          {/* Mobile: stacked cards. ≥ sm: comparison table. */}
          <ul className="space-y-3 sm:hidden">
            {LLM_VS_LEDGER.map((row) => (
              <li
                key={`m-${row.capability}`}
                className="rounded-md border border-surface-border bg-surface-page p-3 text-[13px]"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  {row.capability}
                </p>
                <p className="mt-2 text-text-subtle">
                  <span className="mono text-[10px] uppercase tracking-wide">LLM wrapper</span>
                  <br />
                  {row.wrapper}
                </p>
                <p className="mt-2 text-text-primary">
                  <span className="mono text-[10px] uppercase tracking-wide text-brand-700">
                    LedgerLens
                  </span>
                  <br />
                  {row.ledger}
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full table-fixed text-left text-[13px]">
              <thead className="border-b border-surface-border">
                <tr>
                  <th className="field-label w-1/3 py-2 pr-3">Capability</th>
                  <th className="field-label w-1/3 py-2 pr-3 text-text-subtle">
                    Typical LLM wrapper
                  </th>
                  <th className="field-label w-1/3 py-2 text-brand-700">LedgerLens</th>
                </tr>
              </thead>
              <tbody>
                {LLM_VS_LEDGER.map((row) => (
                  <tr key={row.capability} className="border-b border-surface-border/40 last:border-0">
                    <td className="py-1.5 pr-3 text-text-primary">{row.capability}</td>
                    <td className="py-1.5 pr-3 text-text-subtle">{row.wrapper}</td>
                    <td className="py-1.5 text-text-primary">{row.ledger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Bullet>Deterministic rules run <em>before</em> the model fallback.</Bullet>
            <Bullet>Human corrections become reusable memory — auditable, not opaque.</Bullet>
            <Bullet>Mid-confidence and unfamiliar transactions are routed to review.</Bullet>
            <Bullet>The verified-ledger trust metric is workflow-level, not model-level.</Bullet>
            <Bullet>Every state change writes an <span className="mono">AuditEvent</span>.</Bullet>
            <Bullet>Public demo mode runs at zero paid spend — regression-tested.</Bullet>
            <Bullet>Eval harness reports ECE / MCE / confusion pairs / routing metrics.</Bullet>
            <Bullet>Typed contracts on the API client; mypy --strict; ruff; CI gates per PR.</Bullet>
          </ul>
        </Section>

        {/* 4. Stack */}
        <Section number="04" title="Stack">
          <ul className="flex flex-wrap gap-2">
            {STACK.map((tech) => (
              <li
                key={tech}
                className="rounded-md border border-surface-border bg-surface-panel px-2.5 py-1 text-[12px] font-medium text-text-primary"
              >
                {tech}
              </li>
            ))}
          </ul>
        </Section>

        {/* 5. Trust model */}
        <Section number="05" title="Trust model">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-surface-border bg-surface-panel p-5">
              <p className="field-label">Model metric</p>
              <p className="mt-1 font-display text-[18px] font-medium text-text-primary">
                Raw prediction accuracy
              </p>
              <p className="mt-2 text-[13px] text-text-secondary">
                Measured honestly on the synthetic eval dataset. Roughly 63% overall,
                42% adversarial. Reported on{" "}
                <Link href="/evals" className="text-brand-700 underline">
                  /evals
                </Link>{" "}
                with ECE, MCE, calibration warnings, and confusion-pair reports.
              </p>
            </div>
            <div className="rounded-lg border-2 border-brand-600 bg-brand-100 p-5">
              <p className="field-label">Product metric</p>
              <p className="mt-1 font-display text-[18px] font-medium text-brand-900">
                Procedurally verified rows
              </p>
              <p className="mt-2 text-[13px] text-brand-800">
                Workflow trust boundary (not a CPA guarantee): a finalized row is verified iff it came from a
                deterministic rule auto-approval, a correction-memory replay, or an
                explicit human review.{" "}
                <a
                  href={TRUST_METRIC_DOC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Trust metric doc →
                </a>
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-text-subtle">
            Raw model accuracy is reported honestly because it&apos;s the right number for
            evaluating the model. It is <em>not</em> the right number for evaluating the
            product, which is why the trust boundary is workflow-level.
          </p>
        </Section>

        {/* 6. What this demonstrates */}
        <Section number="06" title="What this demonstrates">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ProofCard
              title="AI systems design"
              body="Layered decision logic. Confidence routing. Sentinel for UNCATEGORIZABLE. Provider attribution per result."
            />
            <ProofCard
              title="Full-stack software engineering"
              body="FastAPI + SQLAlchemy 2.0 models that can run against Postgres in principle. Next.js + typed client. Dockerfile-based Railway deploys for both services. Production migration management, backups, and retention policies are documented as roadmap items."
            />
            <ProofCard
              title="Practical product thinking"
              body="Trust boundary is workflow-level. Empty states guide first-time visitors. Recruiter-facing About + Technical Story pages."
            />
            <ProofCard
              title="Cost control"
              body="Demo-stub mode keeps the public deploy at $0 paid spend. A regression test asserts the Anthropic SDK is never imported in that mode."
            />
            <ProofCard
              title="Human-in-the-loop workflows"
              body="Review queue, correction memory from real human decisions, audit trail on every state change, accountant handoff export reflects review state."
            />
            <ProofCard
              title="Evaluation discipline"
              body="Routing metrics. ECE / MCE per slice. Separated model-only vs deterministic calibration. Per-tenant COA caveat documented, not hidden."
            />
          </ul>
        </Section>

        <Section number="11" title="Production-readiness boundary">
          <p className="mt-2 max-w-3xl text-[14px] text-text-secondary">
            LedgerLens is a <strong>portfolio-grade workflow demo</strong>, not production accounting software. The engineering is real, the eval numbers are honest, the trust metric is defensible — but several production gaps are intentionally documented rather than half-built:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-text-secondary">
            <li>
              No authentication, no tenant model, no tenant-scoped row queries.
              Single-tenant public demo only.
            </li>
            <li>
              No production migration management (Alembic isn&apos;t wired);
              <span className="mono"> init_db()</span> uses{" "}
              <span className="mono">create_all()</span>.
            </li>
            <li>
              No PII redaction before LLM calls; demo-stub mode is the only
              firewall on the public deploy.
            </li>
            <li>
              No double-entry bookkeeping, no bank reconciliation, no split
              transactions, no sales-tax handling.
            </li>
            <li>
              &ldquo;Verified&rdquo; is procedural — a defensible authority
              signed off on the row. Not CPA-correct.
            </li>
          </ul>
          <p className="mt-3 max-w-3xl text-[13px] text-text-secondary">
            Two boundary docs spell it out without hand-waving:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
            <li>
              <a
                href={`${REPO_URL}/blob/main/docs/SECURITY_AND_PRODUCTION_READINESS.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 underline"
              >
                docs/SECURITY_AND_PRODUCTION_READINESS.md
              </a>{" "}
              — auth / tenancy / rate-limiting / observability / migrations /
              backups / retention roadmap (Phase A → E).
            </li>
            <li>
              <a
                href={`${REPO_URL}/blob/main/docs/ACCOUNTING_DOMAIN_BOUNDARY.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 underline"
              >
                docs/ACCOUNTING_DOMAIN_BOUNDARY.md
              </a>{" "}
              — what LedgerLens does and does not do in accounting-domain
              terms; what would be required for production accounting
              correctness.
            </li>
            <li>
              <a
                href={`${REPO_URL}/blob/main/docs/SMALL_BUSINESS_UX_ROADMAP.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 underline"
              >
                docs/SMALL_BUSINESS_UX_ROADMAP.md
              </a>{" "}
              — CSV mapping wizard, account-mapping wizard, mobile-first
              review queue.
            </li>
          </ul>
        </Section>

        <footer className="mt-16 border-t border-surface-border pt-6 text-[12px] text-text-subtle">
          <p>
            Built by{" "}
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline"
            >
              Michael Palmer
            </a>{" "}
            (PalmerAI Solutions, Michael&apos;s personal portfolio brand). Source on{" "}
            <a
              href={GITHUB_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline"
            >
              GitHub
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 rounded-lg border border-surface-border bg-surface-panel p-6">
      <div className="flex items-baseline gap-3">
        <span className="mono rounded bg-brand-600 px-2 py-0.5 text-[11px] font-medium text-white">
          {number}
        </span>
        <h2 className="font-display text-[20px] font-medium text-text-primary">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded border border-surface-border bg-surface-page p-3 text-[13px] text-text-primary">
      {children}
    </li>
  );
}

function ProofCard({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded border border-surface-border bg-surface-page p-3 text-[13px]">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-text-secondary">{body}</p>
    </li>
  );
}
