import type { Metadata } from "next";
import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  Code2,
  ExternalLink,
  GraduationCap,
  Layers,
  ShieldCheck,
} from "lucide-react";

import { Logomark } from "@/components/ui/Logomark";
import {
  ARCHITECTURE_URL,
  GITHUB_PROFILE_URL,
  LINKEDIN_URL,
  REPO_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "About Michael Palmer | LedgerLens",
  description:
    "Michael Palmer — software/AI developer with 25 years of automotive retail and operations experience, building practical AI workflow systems with guardrails, auditability, and human oversight.",
};

export default function AboutPage() {
  return (
    <div className="bg-surface-page text-text-primary min-h-screen">
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
            <Link href="/technical-story" className="text-text-secondary hover:text-text-primary">
              Technical story
            </Link>
            <Link href="/evals" className="text-text-secondary hover:text-text-primary">
              Eval evidence
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
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-8 py-16">
        <header>
          <p className="text-[12px] font-medium uppercase tracking-[0.5px] text-brand-600">
            About
          </p>
          <h1 className="mt-3 font-display text-4xl font-medium text-text-primary">
            About Michael Palmer
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-text-secondary">
            I&apos;m Michael Palmer, a computer science student and software/AI developer with a
            background in automotive retail operations, sales enablement, and enterprise
            implementation work. I build practical AI workflow systems that solve messy
            business problems with guardrails, auditability, and human oversight.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              LinkedIn
              <ExternalLink size={14} className="text-white/80" />
            </a>
            <a
              href={GITHUB_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-surface-border-strong px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-sunken"
            >
              GitHub
              <ExternalLink size={14} className="text-text-subtle" />
            </a>
          </div>
        </header>

        {/* Role target */}
        <section className="mt-12 rounded-lg border border-brand-200 bg-brand-100 p-6">
          <h2 className="font-display text-[18px] font-medium text-brand-900">
            What I&apos;m looking for
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-brand-800">
            Opportunities in <strong>AI engineering, applied AI, solutions engineering,
            full-stack software development, and AI workflow automation</strong>. I&apos;m
            especially interested in roles where the work is grounded in a real business
            problem and the system needs to do something more than wrap a model in a chat UI.
          </p>
        </section>

        {/* Background cards */}
        <section className="mt-10">
          <h2 className="font-display text-[22px] font-medium text-text-primary">Background</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BackgroundCard
              icon={<GraduationCap size={20} className="text-brand-600" />}
              title="Computer Science student"
              body="Currently completing a CS degree focused on systems, AI, and software engineering practice."
            />
            <BackgroundCard
              icon={<BriefcaseBusiness size={20} className="text-brand-600" />}
              title="25 years in automotive retail and operations"
              body="Front-line and operational experience across dealer groups — exactly the kind of business that lives or dies on clean bookkeeping."
            />
            <BackgroundCard
              icon={<Building2 size={20} className="text-brand-600" />}
              title="Former CDK Global implementation"
              body="Enterprise software implementation and adoption with dealer customers. I know how messy real-world workflows actually are."
            />
            <BackgroundCard
              icon={<Layers size={20} className="text-brand-600" />}
              title="Full-stack AI workflow builder"
              body="FastAPI, SQLAlchemy, Next.js, typed clients, Docker, Railway deploys. The whole loop, not just the model call."
            />
            <BackgroundCard
              icon={<ShieldCheck size={20} className="text-brand-600" />}
              title="Practical AI deployment focus"
              body="Cost control, audit trails, review routing, calibration — the operational discipline AI products need to be trusted, not just demoed."
            />
            <BackgroundCard
              icon={<Code2 size={20} className="text-brand-600" />}
              title="Honest about what AI can and cannot do"
              body="Eval evidence is published with the project. Limitations are documented. No 100% accuracy claims hide the messy bits."
            />
          </div>
        </section>

        {/* Project connection */}
        <section className="mt-12 rounded-lg border border-surface-border bg-surface-panel p-6">
          <h2 className="font-display text-[18px] font-medium text-text-primary">
            Why LedgerLens
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
            LedgerLens reflects the kind of system I want to build professionally:
            AI-assisted workflows that combine deterministic logic, human review,
            evaluation discipline, and deployment maturity. The product&apos;s headline
            metric is not raw model accuracy — it&apos;s the workflow-level guarantee that
            no row reaches a finalized ledger without a defensible authority backing it.
          </p>
          <p className="mt-3 text-[13px] text-text-subtle">
            <Link href="/technical-story" className="text-brand-700 underline">
              See the engineering story →
            </Link>{" "}
            ·{" "}
            <Link href="/demo" className="text-brand-700 underline">
              walk the 3-minute demo →
            </Link>{" "}
            ·{" "}
            <a
              href={ARCHITECTURE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline"
            >
              read the architecture doc →
            </a>
          </p>
        </section>

        <footer className="mt-16 border-t border-surface-border pt-6 text-[12px] text-text-subtle">
          <p>
            PalmerAI Solutions is Michael Palmer&apos;s personal portfolio brand for
            practical AI workflow systems. LedgerLens is a portfolio project; the
            transactions and businesses in the demo are synthetic.
          </p>
        </footer>
      </main>
    </div>
  );
}

function BackgroundCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-[14px] font-medium text-text-primary">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}
