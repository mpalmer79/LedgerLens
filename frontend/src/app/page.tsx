import Link from "next/link";
import {
  ExternalLink,
  Fingerprint,
  HelpCircle,
  TrendingUp,
} from "lucide-react";

import { CheckApiButton } from "@/components/CheckApiButton";
import { TransactionCarousel } from "@/components/TransactionCarousel";
import { Logomark } from "@/components/ui/Logomark";
import { loadLatestEvalRun, loadLatestEvalSummary } from "@/lib/evals";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "unset";
const REPO_URL = "https://github.com/mpalmer79/LedgerLens";
const ARCHITECTURE_URL = `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`;
const ADRS_URL = `${REPO_URL}/tree/main/docs/adr`;
const LINKEDIN_URL = "https://linkedin.com/in/michael-palmer";

// Stub-baseline default if no eval JSON is readable at build time.
// Real value: 9.27% from the 2026-05-21 stub run on v0.
const STUB_BASELINE_ACCURACY = 0.0927;

function formatAccuracy(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function Page() {
  const evalSummary = loadLatestEvalSummary();
  const evalRun = loadLatestEvalRun();
  const headlineAccuracy = evalSummary
    ? formatAccuracy(evalSummary.accuracy_overall)
    : formatAccuracy(STUB_BASELINE_ACCURACY);
  const headlineCaption = evalSummary
    ? evalSummary.categorizer.includes("haiku")
      ? "claude haiku 4.5"
      : `${evalSummary.categorizer} (baseline — haiku run pending)`
    : "stub categorizer (baseline — haiku run pending)";

  return (
    <div className="bg-surface-page text-text-primary min-h-screen">
      {/* a. Top nav */}
      <nav className="border-b border-surface-border px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Logomark size={24} className="text-brand-600" />
            <span className="font-display text-[18px] font-medium">LedgerLens</span>
          </Link>
          <div className="flex items-center gap-6 text-[13px]">
            <Link
              href="/evals"
              className="text-text-secondary transition-colors duration-short ease-out-expo hover:text-text-primary"
            >
              Eval results
            </Link>
            <a
              href={ARCHITECTURE_URL}
              className="text-text-secondary transition-colors duration-short ease-out-expo hover:text-text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Architecture
            </a>
            <a
              href={REPO_URL}
              className="text-text-secondary transition-colors duration-short ease-out-expo hover:text-text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* a2. "What am I looking at?" intro */}
      <section className="border-b border-surface-border bg-surface-sunken/40">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-8 py-5">
          <span className="mt-0.5 inline-block whitespace-nowrap rounded bg-brand-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-800">
            Portfolio project
          </span>
          <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
            <span className="font-medium text-text-primary">What you&apos;re looking at:</span>{" "}
            LedgerLens is a working demonstration of an AI-assisted transaction
            categorization system. The transactions, accounts, and businesses are
            synthetic — a hand-crafted dataset of 302 entries across three
            verticals — but the eval pipeline, Claude Haiku 4.5 categorizer,
            calibrated confidence scoring, and dashboard are all real. The
            numbers on the eval page come from a JSON artifact committed to the
            repo, readable by anyone.{" "}
            <a
              href="https://github.com/mpalmer79/LedgerLens"
              className="text-brand-600 underline hover:text-brand-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              See the source on GitHub
            </a>
            .
          </p>
        </div>
      </section>

      {/* b. Hero */}
      <section className="relative overflow-hidden px-8 pt-12 pb-12 md:pt-20 md:pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="pointer-events-none absolute top-0 right-0 h-full w-full md:w-1/2">
            <TransactionCarousel className="h-full w-full" />
          </div>
          <div className="relative">
            <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.5px] text-brand-600">
              AI ENGINEERING · PORTFOLIO PROJECT
            </p>
            <h1 className="max-w-[580px] font-display text-4xl font-medium leading-[1.15] text-text-primary md:text-5xl">
              Categorization you can trust.
              <br />
              <span className="text-brand-600">Calibration you can prove.</span>
            </h1>
            <p className="mt-4 max-w-[520px] text-[16px] leading-relaxed text-text-secondary">
              A bookkeeper-facing copilot that categorizes bank transactions with
              calibrated confidence, routes the uncertain ones to human review, and
              learns from corrections. Backed by an adversarial eval suite.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/evals"
                className="inline-flex items-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-short ease-out-expo hover:bg-brand-500"
              >
                See the eval results →
              </Link>
              <a
                href={ARCHITECTURE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border-strong bg-transparent px-5 py-2.5 text-sm font-medium text-text-primary transition-colors duration-short ease-out-expo hover:bg-surface-sunken"
              >
                Read the architecture
                <ExternalLink size={14} className="text-text-subtle" />
              </a>
            </div>

            {/* c. Stat row */}
            <div className="mt-10 grid grid-cols-1 gap-8 border-t border-surface-border pt-6 sm:grid-cols-3">
              <div>
                <p className="field-label">Current baseline</p>
                <p className="mt-1 font-display text-[24px] font-medium text-text-primary">
                  {headlineAccuracy}
                </p>
                <p className="mt-1 text-[11px] text-text-subtle">
                  {headlineCaption}
                </p>
              </div>
              <div>
                <p className="field-label">Dataset size</p>
                <p className="mt-1 font-display text-[24px] font-medium text-text-primary">
                  302
                </p>
                <p className="mt-1 text-[11px] text-text-subtle">
                  transactions, ~10% adversarial
                </p>
              </div>
              <div>
                <p className="field-label">Verticals</p>
                <p className="mt-1 font-display text-[24px] font-medium text-text-primary">
                  3
                </p>
                <p className="mt-1 text-[11px] text-text-subtle">
                  coffee, agency, auto repair
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* d. Three-pillar section */}
      <section className="mx-auto mt-20 max-w-5xl px-8">
        <h2 className="mb-12 font-display text-[28px] font-medium text-text-primary">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Pillar
            icon={<TrendingUp size={24} className="text-brand-600" />}
            title="Calibrated, not just accurate"
            body="Every prediction returns a confidence score. Below threshold, transactions route to human review instead of contaminating the books. Reliability diagrams live alongside the accuracy numbers."
          />
          <Pillar
            icon={<Fingerprint size={24} className="text-brand-600" />}
            title="Auditable, by design"
            body="Each categorization includes a rationale a reviewer can read in seconds. ADRs document every non-trivial decision. Eval runs are committed JSON artifacts, not metrics in a dashboard with no underlying record."
          />
          <Pillar
            icon={<HelpCircle size={24} className="text-brand-600" />}
            title="Honest about failure modes"
            body="The model returns UNCATEGORIZABLE rather than guess on transactions outside its training distribution. Known limitations and non-goals are documented, not hidden."
          />
        </div>
      </section>

      {/* e. Eval teaser callout */}
      <section className="mx-8 mt-20 md:mx-auto md:max-w-3xl">
        <div className="rounded-lg border-2 border-brand-600 bg-brand-100 p-8">
          <span className="mb-3 inline-block rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            Featured
          </span>
          <h2 className="font-display text-[22px] font-medium text-brand-900">
            See the eval results
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-brand-800">
            {evalRun && evalRun.run_metadata.categorizer_name.includes("haiku") ? (
              <>
                Claude Haiku 4.5 lifts accuracy from a {formatAccuracy(STUB_BASELINE_ACCURACY)}{" "}
                stub baseline to {formatAccuracy(evalRun.metrics.overall.accuracy)} overall, with{" "}
                {formatAccuracy(evalRun.metrics.non_adversarial.accuracy)} on the standard slice
                and {formatAccuracy(evalRun.metrics.adversarial.accuracy)} on adversarial cases.
                Cost: ${evalRun.metrics.overall.cost_per_100.toFixed(2)}/100 transactions.
              </>
            ) : (
              <>
                Stub baseline of {formatAccuracy(STUB_BASELINE_ACCURACY)} established; Claude Haiku
                run pending. Per-business breakdowns, reliability diagrams, and full per-transaction
                outputs are all committed JSON artifacts in the repo.
              </>
            )}
          </p>
          <Link
            href="/evals"
            className="mt-5 inline-flex items-center rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-short ease-out-expo hover:bg-brand-500"
          >
            View the dashboard →
          </Link>
        </div>
      </section>

      {/* f. Live API health */}
      <section className="mx-auto mt-20 max-w-3xl px-8">
        <h2 className="mb-6 text-center font-display text-[22px] font-medium text-text-primary">
          Live API health
        </h2>
        <CheckApiButton apiBaseUrl={API_BASE_URL} />
      </section>

      {/* g. Footer */}
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
              <Link href="/evals" className="text-text-secondary hover:text-text-primary">
                Eval results
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
                href={ADRS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary"
              >
                ADRs
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
            © {new Date().getFullYear()} PalmerAI Solutions. LedgerLens is a
            portfolio project. No financial data leaves your environment.
          </p>
        </div>
      </footer>
    </div>
  );
}

type PillarProps = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

function Pillar({ icon, title, body }: PillarProps) {
  return (
    <div className="rounded-lg border border-brand-200 bg-brand-100 p-6">
      {icon}
      <h3 className="mb-2 mt-4 font-display text-[18px] font-medium text-text-primary">
        {title}
      </h3>
      <p className="text-[14px] leading-relaxed text-text-secondary">{body}</p>
    </div>
  );
}
