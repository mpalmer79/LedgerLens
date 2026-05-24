/**
 * Page-content contracts.
 *
 * Each page in the public surface ships a set of phrases the site
 * leans on for messaging, trust framing, recruiter signal, or
 * honesty. These tests read the page source and assert the phrases
 * are still there.
 *
 * Why static text inspection instead of rendering each page?
 * - `/demo`, `/ledger`, and `/evals` are client components with
 *   hooks and `useEffect`-driven data loading. Rendering them in
 *   a node test environment without mocking the API client + the
 *   eval JSON file system would be heavy.
 * - The content under test is *static copy*. If the strings are in
 *   the file, the page will render them. Static inspection catches
 *   accidental deletions and is the cheapest reliable check.
 *
 * Frontend page render-time wiring is covered by:
 *   - MarketingNav.test.tsx (nav structure)
 *   - GeneratedWalkthrough.test.tsx (animation scenes)
 *   - VideoDemo.test.tsx (Loom fallback)
 *   - site.test.ts (shared constants — no email/phone/resume)
 *   - launch.test.ts (OG asset + doc presence)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..", "src");

function readPage(relPath: string): string {
  return readFileSync(join(SRC, "app", relPath), "utf-8");
}

const HOMEPAGE = readPage("page.tsx");
const ABOUT = readPage("about/page.tsx");
const TECH_STORY = readPage("technical-story/page.tsx");
const DEMO = readPage("demo/page.tsx");
const LEDGER = readPage("ledger/page.tsx");
const EVALS = readPage("evals/page.tsx");
const APP_DASH = readPage("app/page.tsx");
const CLEANUP = readPage("cleanup/page.tsx");
const QUESTIONS = readPage("questions/page.tsx");
const HANDOFF = readPage("handoff/page.tsx");

// ── Homepage ──────────────────────────────────────────────────────────────


describe("homepage content", () => {
  it("uses the shared responsive MarketingNav", () => {
    expect(HOMEPAGE).toContain("MarketingNav");
  });

  it("renders the verified-ledger headline (no raw-accuracy claim)", () => {
    expect(HOMEPAGE).toContain("verified small-business ledger");
    expect(HOMEPAGE).not.toMatch(/100\s*%\s*ai\s*accurate/i);
  });

  it("renders the primary CTA to the guided demo", () => {
    expect(HOMEPAGE).toContain('href="/demo"');
    expect(HOMEPAGE).toContain("Start the 3-minute demo");
  });

  it("renders the technical-story CTA", () => {
    expect(HOMEPAGE).toContain('href="/technical-story"');
    expect(HOMEPAGE).toContain("Read the technical story");
  });

  it("links to /about and includes Michael's name as the builder line", () => {
    expect(HOMEPAGE).toContain('href="/about"');
    expect(HOMEPAGE).toContain("Michael Palmer");
  });

  it("links to GitHub", () => {
    expect(HOMEPAGE).toContain("REPO_URL");
  });

  it("renders the generated-walkthrough section via VideoDemo", () => {
    expect(HOMEPAGE).toContain("<VideoDemo />");
  });

  it("renders the visual TrustPipeline component", () => {
    expect(HOMEPAGE).toContain("<TrustPipeline />");
  });

  it("uses overflow-x-hidden to prevent accidental horizontal scroll", () => {
    expect(HOMEPAGE).toContain("overflow-x-hidden");
  });
});

// ── About ─────────────────────────────────────────────────────────────────


describe("about page content", () => {
  it("uses the shared responsive MarketingNav", () => {
    expect(ABOUT).toContain("MarketingNav");
  });

  it("names Michael Palmer and his pivot", () => {
    expect(ABOUT).toContain("Michael Palmer");
    expect(ABOUT.toLowerCase()).toMatch(/automotive/);
  });

  it("renders LinkedIn and GitHub links via shared constants", () => {
    expect(ABOUT).toContain("LINKEDIN_URL");
    expect(ABOUT).toContain("GITHUB_PROFILE_URL");
  });

  it("does NOT include an email address, phone number, or resume link", () => {
    // Email address
    expect(ABOUT).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(ABOUT.toLowerCase()).not.toContain("mailto:");
    // Resume / CV download link
    expect(ABOUT.toLowerCase()).not.toMatch(/resume\.pdf|cv\.pdf|"\/resume"|"\/cv"/);
    // Loose phone-number heuristic (e.g. "555-123-4567", "+1 555 123 4567")
    // is restricted to checking the literal "phone:" or "tel:" since file
    // contents legitimately contain numbers (sizes, breakpoints, etc.).
    expect(ABOUT.toLowerCase()).not.toContain("tel:");
    expect(ABOUT.toLowerCase()).not.toContain("phone:");
  });

  it("names the role targets Michael is looking for", () => {
    expect(ABOUT.toLowerCase()).toMatch(/ai engineering/);
    expect(ABOUT.toLowerCase()).toMatch(/full-stack/);
  });

  it("connects LedgerLens to professional intent", () => {
    expect(ABOUT).toContain("LedgerLens");
  });
});

// ── Technical Story ───────────────────────────────────────────────────────


describe("technical-story content", () => {
  it("uses the shared responsive MarketingNav", () => {
    expect(TECH_STORY).toContain("MarketingNav");
  });

  it("renders the Reviewer-takeaway card", () => {
    expect(TECH_STORY).toContain("Reviewer takeaway");
  });

  it('renders the "Not an LLM wrapper" comparison content', () => {
    expect(TECH_STORY).toContain("LLM_VS_LEDGER");
    expect(TECH_STORY).toContain("Typical LLM wrapper");
    expect(TECH_STORY).toContain("LedgerLens");
  });

  it("renders comparison rows for input shape, decision logic, audit, trust metric", () => {
    expect(TECH_STORY.toLowerCase()).toContain("input shape");
    expect(TECH_STORY.toLowerCase()).toContain("decision logic");
    expect(TECH_STORY.toLowerCase()).toContain("audit trail");
    expect(TECH_STORY.toLowerCase()).toContain("trust metric");
  });

  it("ships both mobile-card and md+-table layouts for the comparison", () => {
    // Mobile-only stacked list.
    expect(TECH_STORY).toMatch(/space-y-3[^"]*sm:hidden/);
    // Table revealed at sm+.
    expect(TECH_STORY).toMatch(/hidden[^"]*sm:block/);
  });

  it("references the TrustPipeline component", () => {
    expect(TECH_STORY).toContain("TrustPipeline");
  });

  it("links to the GitHub profile and trust-metric doc", () => {
    expect(TECH_STORY).toContain("GITHUB_PROFILE_URL");
    expect(TECH_STORY).toContain("TRUST_METRIC_DOC_URL");
  });
});

// ── Demo ──────────────────────────────────────────────────────────────────


describe("demo page content", () => {
  it('renders the "What to look for" framing panel', () => {
    expect(DEMO).toContain("What to look for");
  });

  it("frames the workflow as avoiding blind automation", () => {
    expect(DEMO.toLowerCase()).toMatch(/avoids?\s+blind\s+automation/);
  });

  it("renders the TrustPanel and DemoOutcome on step 6", () => {
    expect(DEMO).toContain("TrustPanel");
    expect(DEMO).toContain("DemoOutcome");
  });

  it("does not claim raw model accuracy in the demo copy", () => {
    expect(DEMO.toLowerCase()).not.toMatch(/100\s*%\s*ai\b/);
    expect(DEMO.toLowerCase()).not.toMatch(/100\s*%\s*accurate\s+ai/);
  });

  it('renders the "verified, not an AI answer" headline on step 6', () => {
    expect(DEMO).toContain("verified ledger, not an AI answer");
  });
});

// ── Ledger ────────────────────────────────────────────────────────────────


describe("ledger page content", () => {
  it("renders the trust warning copy when unverified rows exist", () => {
    // String literals are split across JSX lines, so we look for the
    // adjacent tokens rather than a single joined phrase.
    expect(LEDGER).toContain("unverified");
    expect(LEDGER).toContain("finalized row");
    expect(LEDGER.toLowerCase()).toContain("review unverified rows before");
  });

  it('renders the "Every finalized row is verified" positive confirmation', () => {
    expect(LEDGER).toContain("Every finalized row is verified");
  });

  it("guards the export button with a confirm dialog when verification is incomplete", () => {
    expect(LEDGER).toContain("window.confirm");
  });

  it("renders the TrustPanel", () => {
    expect(LEDGER).toContain("TrustPanel");
  });

  it("frames the page as a reviewed ledger export, not an AI answer", () => {
    expect(LEDGER.toLowerCase()).toContain("not an ai response");
  });
});

// ── Evals ─────────────────────────────────────────────────────────────────


describe("evals page content", () => {
  it("renders the trust-boundary callout", () => {
    expect(EVALS).toContain("Trust boundary");
    expect(EVALS).toContain("Raw model accuracy is not the product trust boundary");
  });

  it("links to the trust-metric doc", () => {
    expect(EVALS.toLowerCase()).toContain("trust_metric.md");
  });

  it("contrasts the model metric vs the product metric explicitly", () => {
    expect(EVALS).toContain("Model metric");
    expect(EVALS).toContain("Product metric");
    expect(EVALS).toContain("Verified finalized ledger");
  });

  it("preserves the production pipeline summary", () => {
    expect(EVALS).toContain("Production categorization pipeline");
    expect(EVALS).toContain("correction memory");
    expect(EVALS).toContain("deterministic rules");
    expect(EVALS).toContain("model fallback");
  });
});

// ── App dashboard ─────────────────────────────────────────────────────────


describe("app dashboard content", () => {
  it("uses the outcome-focused headline", () => {
    expect(APP_DASH).toContain("Small-business bookkeeping cleanup");
  });

  it("renders a three-card empty state for first-time visitors", () => {
    expect(APP_DASH).toContain("Start guided demo");
    expect(APP_DASH).toContain("Import transactions");
    expect(APP_DASH).toContain("View technical story");
  });

  it('renders the "Why this matters" panel', () => {
    expect(APP_DASH).toContain("Why this matters");
  });

  it("flags portfolio demo mode when active", () => {
    expect(APP_DASH).toContain("Portfolio demo mode");
  });
});

// ── Cleanup ──────────────────────────────────────────────────────────────


describe("cleanup page content", () => {
  it("frames the page as monthly bookkeeping cleanup", () => {
    expect(CLEANUP).toContain("Monthly bookkeeping cleanup");
    expect(CLEANUP.toLowerCase()).toMatch(/this month/);
  });

  it("renders all six guided steps", () => {
    expect(CLEANUP).toContain("Import this month");
    expect(CLEANUP).toContain("Classify obvious vendors");
    expect(CLEANUP).toContain("Review uncertain items");
    expect(CLEANUP).toContain("Answer owner questions");
    expect(CLEANUP).toContain("Verify the ledger");
    expect(CLEANUP).toContain("Export accountant handoff package");
  });

  it("links each step to its workflow page", () => {
    // Step actionHref values are populated via ternary expressions, so we
    // assert that each target URL literal appears anywhere in the source.
    for (const href of [
      "/transactions/import",
      "/transactions",
      "/review",
      "/questions",
      "/ledger",
      "/handoff",
    ]) {
      expect(CLEANUP).toContain(`"${href}"`);
    }
  });

  it("renders the CleanupImpactSummary when handoff data is available", () => {
    expect(CLEANUP).toContain("CleanupImpactSummary");
  });

  it("offers an empty-state shortcut to the guided demo and CSV import", () => {
    expect(CLEANUP).toContain('href="/demo"');
    expect(CLEANUP).toContain('href="/transactions/import"');
  });
});

// ── Questions ────────────────────────────────────────────────────────────


describe("questions page content", () => {
  it("frames itself as plain-English questions", () => {
    expect(QUESTIONS).toContain("Owner questions");
    expect(QUESTIONS.toLowerCase()).toMatch(/plain[\s-]english/);
  });

  it("ships at least four question templates", () => {
    // The TEMPLATES array contains four pattern-matched templates plus a default.
    expect(QUESTIONS).toContain("What was this transfer for?");
    expect(QUESTIONS).toContain("What was this purchase mainly for?");
    expect(QUESTIONS).toContain("Was this vehicle expense business-related?");
    expect(QUESTIONS).toContain("Is this a business software or service subscription?");
  });

  it("records owner answers as reviewer notes via existing endpoints", () => {
    expect(QUESTIONS).toContain("correctReview");
    expect(QUESTIONS).toContain("approveReview");
    expect(QUESTIONS).toContain("markUncategorizable");
  });

  it("does not force accounting jargon as the first thing the owner sees", () => {
    // The first multiple-choice label inside each template is plain English,
    // never a bare COA code.
    expect(QUESTIONS).toMatch(/Vendor payment|Office supplies|Business fuel|Software subscription/);
  });

  it("links to the full review queue as an escape hatch", () => {
    expect(QUESTIONS).toContain('href="/review"');
  });
});

// ── Handoff ──────────────────────────────────────────────────────────────


describe("handoff page content", () => {
  it("renders all required handoff sections", () => {
    expect(HANDOFF).toContain("Accountant handoff package");
    expect(HANDOFF).toContain("Ready for accountant");
    expect(HANDOFF).toContain("Needs owner / accountant review");
    expect(HANDOFF).toContain("Questions answered by owner");
    expect(HANDOFF).toContain("Corrections learned this month");
  });

  it("renders TrustPanel + CleanupImpactSummary", () => {
    expect(HANDOFF).toContain("TrustPanel");
    expect(HANDOFF).toContain("CleanupImpactSummary");
  });

  it("offers both markdown handoff and CSV ledger downloads", () => {
    expect(HANDOFF).toContain("getHandoffMarkdownUrl");
    expect(HANDOFF).toContain("getLedgerExportUrl");
    expect(HANDOFF.toLowerCase()).toContain("download handoff summary");
    expect(HANDOFF.toLowerCase()).toContain("download full ledger csv");
  });

  it("includes the honesty footer on trust + time-saved", () => {
    expect(HANDOFF).toContain("workflow-level, not raw model accuracy");
    // JSX wraps lines; check tokens individually.
    expect(HANDOFF).toContain("financial guarantee");
    expect(HANDOFF.toLowerCase()).toContain("not a");
  });

  it("links into the questions and review workflows", () => {
    expect(HANDOFF).toContain('href="/questions"');
    expect(HANDOFF).toContain('href="/review"');
  });
});
