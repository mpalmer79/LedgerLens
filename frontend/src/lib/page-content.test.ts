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
const IMPORT = readPage("transactions/import/page.tsx");

// ── Homepage ──────────────────────────────────────────────────────────────


describe("homepage content", () => {
  it("uses the shared responsive MarketingNav", () => {
    expect(HOMEPAGE).toContain("MarketingNav");
  });

  it("leads with the monthly cleanup / accountant handoff framing", () => {
    expect(HOMEPAGE.toLowerCase()).toContain("monthly bookkeeping cleanup");
    expect(HOMEPAGE).toContain("verified handoff");
    expect(HOMEPAGE).not.toMatch(/100\s*%\s*ai\s*accurate/i);
  });

  it("uses /cleanup as the primary CTA (not /demo)", () => {
    expect(HOMEPAGE).toContain('href="/cleanup"');
    expect(HOMEPAGE).toContain("Start monthly cleanup");
  });

  it("offers a clear /handoff CTA", () => {
    expect(HOMEPAGE).toContain('href="/handoff"');
    expect(HOMEPAGE).toContain("View accountant handoff");
  });

  it("keeps secondary CTAs for /demo and /technical-story", () => {
    expect(HOMEPAGE).toContain('href="/demo"');
    expect(HOMEPAGE).toContain('href="/technical-story"');
  });

  it("renders the before/after section", () => {
    expect(HOMEPAGE).toContain("accountant-ready handoff");
    expect(HOMEPAGE).toContain("After LedgerLens");
  });

  it("renders the example handoff preview card with the sample-scenario name", () => {
    expect(HOMEPAGE).toContain("Example: Granite State Auto Repair");
    expect(HOMEPAGE).toContain("Fictional sample scenario");
    expect(HOMEPAGE).toContain("March 2026 cleanup before accountant handoff");
    // Illustrative numbers match the audit doc's expected outcome.
    expect(HOMEPAGE).toContain('value="42"');
    expect(HOMEPAGE).toContain('value="28"');
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

  it("includes the Granite State Auto Repair sample scenario on the homepage", () => {
    expect(HOMEPAGE).toContain("Granite State Auto Repair");
    expect(HOMEPAGE.toLowerCase()).toContain("fictional sample");
  });

  it("explicitly disclaims accounting-software framing", () => {
    // The only "accounting software" reference must be the negation.
    expect(HOMEPAGE).toContain("not accounting software");
    // No standalone positive claim like "AI accounting software".
    expect(HOMEPAGE.toLowerCase()).not.toMatch(/\bai accounting software\b/);
  });

  it("frames the headline as procedural verification, not CPA-correct", () => {
    expect(HOMEPAGE).toContain("procedurally verified");
    expect(HOMEPAGE).toMatch(/not\s+a\s+substitute\s+for\s+CPA/);
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

  it("includes the production-readiness boundary section + boundary docs", () => {
    expect(TECH_STORY).toContain("Production-readiness boundary");
    expect(TECH_STORY).toContain("SECURITY_AND_PRODUCTION_READINESS.md");
    expect(TECH_STORY).toContain("ACCOUNTING_DOMAIN_BOUNDARY.md");
    expect(TECH_STORY).toContain("SMALL_BUSINESS_UX_ROADMAP.md");
    expect(TECH_STORY).toContain("portfolio-grade workflow demo");
    // JSX wraps the disclaimer phrase across lines, check for tokens.
    expect(TECH_STORY).toMatch(/not\s+production\s+accounting\s+software/);
  });
});

// ── Transactions import — demo upload guardrails ─────────────────────────


describe("transactions/import page content", () => {
  it("warns against uploading real bank / customer / employee data", () => {
    expect(IMPORT).toContain("Public demo");
    expect(IMPORT.toLowerCase()).toMatch(/do\s+not\s+upload\s+real\s+bank/);
    expect(IMPORT.toLowerCase()).toContain("synthetic");
    expect(IMPORT.toLowerCase()).toMatch(/customer\s+information/);
    expect(IMPORT.toLowerCase()).toMatch(/employee\s+information/);
    expect(IMPORT.toLowerCase()).toMatch(/account\s+numbers/);
  });

  it("notes there is no authentication or tenant isolation", () => {
    expect(IMPORT.toLowerCase()).toMatch(/no\s+authentication/);
    expect(IMPORT.toLowerCase()).toMatch(/no\s+tenant\s+isolation/);
  });

  it("renders the CSV mapping wizard with drag-and-drop + sample download", () => {
    // Wizard step indicator + entry points.
    expect(IMPORT).toMatch(/Drag\s+&amp;\s+drop\s+a\s+CSV\s+here/);
    expect(IMPORT).toContain("Choose CSV file");
    expect(IMPORT).toContain("/samples/granite-state-bank-sample.csv");
    expect(IMPORT).toContain("Download sample CSV");
    expect(IMPORT).toContain("Load sample into wizard");
  });

  it("renders the column-mapping + amount-mode + validate steps", () => {
    // Step bar
    expect(IMPORT).toContain("Map columns");
    expect(IMPORT).toContain("Validate");
    // Mapping fields
    expect(IMPORT).toContain("Single signed amount column");
    expect(IMPORT).toContain("Separate debit");
    expect(IMPORT).toContain("Debit (outflow)");
    expect(IMPORT).toContain("Credit (inflow)");
    // Validation summary fields
    expect(IMPORT).toContain("Need attention");
    expect(IMPORT).toContain("Blank rows skipped");
  });

  it("posts a reminder before final import + routes user to /cleanup on done", () => {
    expect(IMPORT.toLowerCase()).toMatch(/reminder.*no\s+authentication/);
    expect(IMPORT).toContain('href="/cleanup"');
    expect(IMPORT).toContain("Start monthly cleanup");
  });

  it("does NOT claim production accounting software or 100% AI accuracy", () => {
    expect(IMPORT.toLowerCase()).not.toMatch(/production\s+accounting\s+software/);
    expect(IMPORT.toLowerCase()).not.toMatch(/100\s*%\s*ai\b/);
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
    expect(DEMO).toContain(
      "procedurally verified categorization, not an AI answer",
    );
  });

  it("renders the sample-cleanup-scenario card driven by /demo/scenario", () => {
    expect(DEMO).toContain("Sample cleanup scenario");
    expect(DEMO).toContain("getDemoScenario");
    expect(DEMO).toContain("Fictional sample data");
  });

  it("guards seed/reset buttons against double-click", () => {
    expect(DEMO).toContain("resetting");
    expect(DEMO).toContain("Resetting…");
    // Both seed and reset short-circuit if already in flight.
    expect(DEMO).toContain("double-click guard");
  });

  it("treats scenario load as non-critical so it can fail silently", () => {
    // Status + samples are in a try block; scenario load is in its own
    // try block that swallows errors so the rest of the page works.
    expect(DEMO).toContain("Scenario card just won't render");
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
    expect(EVALS).toContain("Procedurally verified rows");
  });

  it("preserves the production pipeline summary", () => {
    expect(EVALS).toContain("Production categorization pipeline");
    expect(EVALS).toContain("correction memory");
    expect(EVALS).toContain("deterministic rules");
    expect(EVALS).toContain("model fallback");
  });

  it("renders the Business-specific rule mapping section when a mapped run exists", () => {
    // The section is gated on `comparison.runs.some(r => r.mapping?.enabled)`.
    expect(EVALS).toContain("Business-specific rule mapping");
    expect(EVALS).toContain("business-specific-rule-mapping"); // anchor for /rules cross-link
    expect(EVALS).toContain("rule-categorizer-mapped-v1");
    expect(EVALS).toContain("Mapping outcomes");
    expect(EVALS).toContain("Top unmapped intents");
  });

  it("calls out that mapped rules do not replace review", () => {
    // JSX wraps the disclaimer across multiple lines, so we check tokens
    // rather than the joined string.
    expect(EVALS).toContain("do not make the model perfect");
    expect(EVALS).toMatch(/not\s+replace\s+review/);
    expect(EVALS).toContain("workflow-level");
    expect(EVALS.toLowerCase()).toContain("not raw");
  });

  it("renders the per-business mapped-rule breakdown table", () => {
    expect(EVALS).toContain("Per-business mapped-rule breakdown");
    expect(EVALS).toContain("Granite State Auto Service");
    expect(EVALS).toContain("Lighthouse Roasters");
    expect(EVALS).toContain("Northwind Design Co.");
    expect(EVALS).toContain("Best mapped-row accuracy");
    expect(EVALS).toContain("Biggest rule gap");
    expect(EVALS).toContain("Top unmapped intents");
    expect(EVALS).toContain("RULE_GAP_ANALYSIS.md");
  });

  it("notes the Batch #1 parts-vendor rule addition + measured impact", () => {
    expect(EVALS).toContain("Batch #1");
    // JSX wraps "parts-vendor" across lines in the source.
    expect(EVALS).toMatch(/parts-vendor\s+rules/);
    // Honest before/after numbers stay in copy.
    expect(EVALS).toContain("22.2%");
    expect(EVALS).toContain("44.7%");
  });
});

// ── App dashboard ─────────────────────────────────────────────────────────


describe("app dashboard content", () => {
  it("uses the outcome-focused headline", () => {
    expect(APP_DASH).toContain("Small-business bookkeeping cleanup");
  });

  it("renders an empty state that leads with the cleanup assistant", () => {
    expect(APP_DASH).toContain("Open cleanup assistant");
    expect(APP_DASH).toContain("Try guided demo");
    expect(APP_DASH).toContain("Import transactions");
    expect(APP_DASH).toContain("View technical story");
    expect(APP_DASH).toContain('href="/cleanup"');
  });

  it('renders the "Why this matters" panel', () => {
    expect(APP_DASH).toContain("Why this matters");
  });

  it("flags portfolio demo mode when active", () => {
    expect(APP_DASH).toContain("Portfolio demo mode");
  });

  it("uses the shared ErrorState with a retry handler", () => {
    expect(APP_DASH).toContain("ErrorState");
    expect(APP_DASH).toContain("onRetry");
    // Secondary action points back to the cleanup checklist (the primary CTA).
    expect(APP_DASH).toContain("Open cleanup checklist");
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

  it("surfaces the sample-scenario context when demo data is present", () => {
    // Header badge reads off the scenario from the handoff response.
    expect(CLEANUP).toContain("Sample data");
    expect(CLEANUP).toContain("scenario.business_name");
    expect(CLEANUP).toContain("scenario.cleanup_month");
    // Empty-state names the Granite State Auto Repair scenario.
    expect(CLEANUP).toContain("Granite State Auto Repair");
    expect(CLEANUP).toContain("Try the sample scenario");
  });

  it("uses the shared LoadingState and ErrorState on the load path", () => {
    expect(CLEANUP).toContain("LoadingState");
    expect(CLEANUP).toContain("ErrorState");
    // Retry path is wired up via the load() callback.
    expect(CLEANUP).toContain("onRetry");
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

  it("includes auto-shop-friendly templates introduced with the sample scenario", () => {
    // Parts vendors (NAPA / AutoZone / O'Reilly / Advance / LKQ / tire dist).
    expect(QUESTIONS).toContain("What were these parts for?");
    expect(QUESTIONS).toContain("Shop inventory");
    expect(QUESTIONS).toContain("Customer job");
    // Owner-side transfers / cash withdrawals.
    expect(QUESTIONS).toContain("What was this transfer?");
    expect(QUESTIONS).toContain("Owner draw");
    // Deposits — revenue side.
    expect(QUESTIONS).toContain("Is this a customer deposit or other revenue?");
    expect(QUESTIONS).toContain("Customer payment (revenue)");
    // Home improvement stores.
    expect(QUESTIONS).toContain("Shop supplies");
    expect(QUESTIONS).toContain("Building repair");
  });

  it("ships Owner Answers v2 structured templates with stable keys", () => {
    // Stable question keys the backend receives + persists.
    expect(QUESTIONS).toContain('key: "unknown_ach_transfer"');
    expect(QUESTIONS).toContain('key: "marketplace_purchase"');
    expect(QUESTIONS).toContain('key: "home_improvement_store"');
    expect(QUESTIONS).toContain('key: "owner_transfer"');
    expect(QUESTIONS).toContain('key: "parts_vendor"');
    expect(QUESTIONS).toContain('key: "customer_deposit"');
    expect(QUESTIONS).toContain('key: "default_uncertain_transaction"');
    // resolutionAction + suggestedResolution are the v2 structured fields.
    expect(QUESTIONS).toContain("resolutionAction");
    expect(QUESTIONS).toContain("suggestedResolution");
  });

  it("renders the optional owner-note field + handoff helper copy", () => {
    expect(QUESTIONS).toContain("Optional note for your accountant");
    expect(QUESTIONS).toContain("Add context for your accountant");
    expect(QUESTIONS).toContain("Your answer will be saved in the accountant handoff package");
    expect(QUESTIONS).toContain("does not blindly finalize the accounting category");
  });

  it("flags accountant-review answers with an inline warning treatment", () => {
    // "Needs accountant review" answers carry `accountantFollowUp: true` and
    // the JSX swaps to the amber-toned button class.
    expect(QUESTIONS).toContain("accountant review");
    expect(QUESTIONS).toContain("border-amber-300");
  });

  it("records owner answers via the four explicit resolution endpoints", () => {
    expect(QUESTIONS).toContain("correctReview");
    expect(QUESTIONS).toContain("approveReview");
    expect(QUESTIONS).toContain("markUncategorizable");
    // SAFETY: "Needs accountant review" answers route to the dedicated
    // accountant-review endpoint, not the approve endpoint.
    expect(QUESTIONS).toContain("markForAccountantReview");
  });

  it("never silently approves a Needs accountant review answer", () => {
    // The /accountant-review path must be the one called for the
    // needs_accountant_review resolution action.
    expect(QUESTIONS).toContain('case "needs_accountant_review"');
    expect(QUESTIONS).toContain("markForAccountantReview(id");
    // The handler is a switch on resolutionAction — not an inference
    // from categoryCode presence.
    expect(QUESTIONS).toContain("switch (answer.resolutionAction)");
  });

  it("does not force accounting jargon as the first thing the owner sees", () => {
    // The first multiple-choice label inside each template is plain English,
    // never a bare COA code.
    expect(QUESTIONS).toMatch(/Vendor payment|Office supplies|Business fuel|Software subscription/);
  });

  it("links to the full review queue as an escape hatch", () => {
    expect(QUESTIONS).toContain('href="/review"');
  });

  it("uses shared ErrorState/EmptyState for page-level data states", () => {
    expect(QUESTIONS).toContain("ErrorState");
    expect(QUESTIONS).toContain("EmptyState");
    expect(QUESTIONS).toContain("LoadingState");
    // Empty-state body names the next steps.
    expect(QUESTIONS).toContain("No owner questions right now");
    expect(QUESTIONS).toContain("View accountant handoff");
  });

  it("surfaces inline per-card save errors instead of clearing the queue", () => {
    expect(QUESTIONS).toContain("saveErrors");
    expect(QUESTIONS).toContain("Could not save this answer");
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

  it("clarifies that the handoff is not CPA-reviewed books", () => {
    expect(HANDOFF.toLowerCase()).toContain("not cpa-reviewed");
    expect(HANDOFF.toLowerCase()).toContain("procedural");
    // JSX wraps "accounting\n          review" across lines.
    expect(HANDOFF.toLowerCase()).toMatch(/not\s+a\s+substitute\s+for\s+accounting\s+review/);
  });

  it("offers markdown + reviewed + follow-up CSV downloads", () => {
    expect(HANDOFF).toContain("getHandoffMarkdownUrl");
    expect(HANDOFF).toContain("getHandoffReviewedCsvUrl");
    expect(HANDOFF).toContain("getHandoffFollowupCsvUrl");
    expect(HANDOFF).toContain("getLedgerExportUrl");
    expect(HANDOFF.toLowerCase()).toContain("download handoff summary");
    expect(HANDOFF.toLowerCase()).toContain("download reviewed categorization csv");
    expect(HANDOFF.toLowerCase()).toContain("download follow-up / unresolved csv");
    expect(HANDOFF.toLowerCase()).toContain("download full categorization csv");
    // Don't claim QBO / IIF / direct QuickBooks compatibility.
    expect(HANDOFF.toLowerCase()).toContain("not a quickbooks import");
    expect(HANDOFF.toLowerCase()).toContain("not a true accounting ledger");
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

  it("surfaces the sample-scenario context when handoff.scenario is set", () => {
    expect(HANDOFF).toContain("handoff?.scenario");
    expect(HANDOFF).toContain("scenario.business_name");
    expect(HANDOFF).toContain("Sample data");
    expect(HANDOFF.toLowerCase()).toContain("demo handoff");
  });

  it("uses shared ErrorState/EmptyState/LoadingState", () => {
    expect(HANDOFF).toContain("ErrorState");
    expect(HANDOFF).toContain("EmptyState");
    expect(HANDOFF).toContain("LoadingState");
  });

  it("renders a no-handoff-yet empty state with cleanup CTAs", () => {
    expect(HANDOFF).toContain("No handoff package yet");
    expect(HANDOFF).toContain("Start monthly cleanup");
    expect(HANDOFF).toContain("Try the sample scenario");
  });

  it("probes the export URL and surfaces inline download errors", () => {
    expect(HANDOFF).toContain("handleDownload");
    expect(HANDOFF).toContain('method: "HEAD"');
    expect(HANDOFF).toContain("Could not download the markdown handoff");
    expect(HANDOFF).toContain("Could not download the reviewed categorization CSV");
  });

  it("renders the Owner Answers v2 structured fields", () => {
    // v1 / v2 split — the page checks `a.owner_question_key != null` to
    // decide which rendering to use.
    expect(HANDOFF).toContain("owner_question_key");
    expect(HANDOFF).toContain("owner_answer_label");
    expect(HANDOFF).toContain("owner_note");
    expect(HANDOFF).toContain("Needs accountant follow-up");
    expect(HANDOFF).toContain("Suggested resolution");
  });
});

// ── Rules (per-business intent mapping) ──────────────────────────────────


const RULES = readPage("rules/page.tsx");

describe("rules page content", () => {
  it("explains the per-business mapping layer", () => {
    expect(RULES).toContain("Per-business mapping");
    expect(RULES).toContain("parts_inventory");
    expect(RULES).toContain("Active business mapping");
  });

  it("renders rule intent + mapped category columns", () => {
    expect(RULES).toContain("Intent");
    expect(RULES).toContain("Mapped category");
    expect(RULES).toContain("mapped_category_code");
    expect(RULES).toContain("mapped_category_name");
  });

  it("uses the shared loading/error states", () => {
    expect(RULES).toContain("LoadingState");
    expect(RULES).toContain("ErrorState");
  });

  it("calls out unmapped-intent fallback behavior", () => {
    expect(RULES.toLowerCase()).toContain("safe fallback");
    expect(RULES).toContain("business_rule_maps");
  });

  it("links to /evals#business-specific-rule-mapping", () => {
    expect(RULES).toContain("/evals#business-specific-rule-mapping");
    expect(RULES).toContain("View multi-business rule evals");
  });

  it("notes that mapped-rule evals cover all three eval businesses", () => {
    expect(RULES.toLowerCase()).toContain("auto repair");
    expect(RULES.toLowerCase()).toContain("coffee shop");
    expect(RULES.toLowerCase()).toContain("design agency");
  });

  it("describes the Batch #1 parts-vendor rules and intents", () => {
    expect(RULES).toContain("Batch #1");
    expect(RULES).toContain("NAPA");
    expect(RULES).toContain("AutoZone");
    expect(RULES).toContain("parts_inventory");
    expect(RULES).toContain("tires_inventory");
    // Safety language — ambiguous purchases still route to questions.
    expect(RULES.toLowerCase()).toContain("home depot");
    // JSX wraps "owner questions" across two lines in the source.
    expect(RULES.toLowerCase()).toMatch(/owner\s+questions/);
  });
});

// ── Claims-regression sweep ───────────────────────────────────────────────
//
// Live-surface phrases that conflict with the productization boundary.
// Any reintroduction would re-open a hole the boundary PR closed.

const REVIEW = readPage("review/page.tsx");
const LAYOUT = readPage("layout.tsx");
const TRUST_PIPELINE = readFileSync(
  join(SRC, "components", "TrustPipeline.tsx"),
  "utf-8",
);
const SITE_LIB = readFileSync(join(SRC, "lib", "site.ts"), "utf-8");
const GENERATED_WALKTHROUGH = readFileSync(
  join(SRC, "components", "marketing", "GeneratedWalkthrough.tsx"),
  "utf-8",
);

describe("claims regression sweep — live surfaces", () => {
  it("no live route says 'verified ledger export'", () => {
    for (const [name, src] of [
      ["homepage", HOMEPAGE],
      ["about", ABOUT],
      ["tech_story", TECH_STORY],
      ["demo", DEMO],
      ["app", APP_DASH],
      ["review", REVIEW],
      ["handoff", HANDOFF],
      ["layout", LAYOUT],
      ["TrustPipeline", TRUST_PIPELINE],
      ["site lib", SITE_LIB],
      ["GeneratedWalkthrough", GENERATED_WALKTHROUGH],
    ] as const) {
      expect(
        src.toLowerCase().includes("verified ledger"),
        `${name} should not contain 'verified ledger'`,
      ).toBe(false);
    }
  });

  it("/app does not tell users to bring a real bank export", () => {
    expect(APP_DASH.toLowerCase()).not.toContain("bring a real bank");
    expect(APP_DASH.toLowerCase()).not.toContain("real bank export");
  });

  it("/demo no longer says bare 'Postgres-ready'", () => {
    expect(DEMO).not.toContain("Postgres-ready persistence");
    // The replacement makes the dev-vs-deploy reality explicit.
    expect(DEMO.toLowerCase()).toContain("postgres-compatible in principle");
  });

  it("/review no longer says 'final ledger export'", () => {
    expect(REVIEW.toLowerCase()).not.toContain("final ledger export");
    expect(REVIEW.toLowerCase()).toContain("reviewed categorization export");
  });

  it("homepage says 'procedurally verified' not 'verified ledger rows'", () => {
    expect(HOMEPAGE.toLowerCase()).toContain("procedurally verified rows");
    expect(HOMEPAGE.toLowerCase()).not.toContain("verified ledger rows");
  });

  it("TrustPipeline final step labels itself as a categorization handoff", () => {
    expect(TRUST_PIPELINE).toContain("Reviewed categorization handoff");
    expect(TRUST_PIPELINE).not.toContain("Verified ledger export");
  });

  it("site lib title/description no longer claims a verified ledger", () => {
    expect(SITE_LIB.toLowerCase()).not.toMatch(/verified[\s-]ledger/);
  });
});

describe("review page mobile-first content", () => {
  it("offers all four explicit actions", () => {
    expect(REVIEW).toContain("Approve prediction");
    expect(REVIEW).toContain("Correct");
    // The safe path the safety-fix added.
    expect(REVIEW).toContain("Needs accountant review");
    expect(REVIEW).toContain("Exclude / non-business");
  });

  it("Needs accountant review calls the safe endpoint, not approve", () => {
    expect(REVIEW).toContain("markForAccountantReview");
  });

  it("action buttons have at least 44px tap targets", () => {
    // The grid wraps the four buttons; each button declares min-h-[44px].
    expect(REVIEW).toContain("min-h-[44px]");
    // Mobile-first grid: 1 column on phone, 2 on small, 4 on large.
    expect(REVIEW).toMatch(/grid-cols-1[^"]*sm:grid-cols-2[^"]*lg:grid-cols-4/);
  });

  it("shows a progress indicator", () => {
    expect(REVIEW).toContain("review-progress");
    expect(REVIEW).toMatch(/pending — pick an explicit action per card/);
  });
});

const ADMIN = readPage("admin/page.tsx");

describe("admin / tenant foundation page", () => {
  it("renders foundation status with explicit not-production framing", () => {
    expect(ADMIN).toContain("Tenant foundation");
    expect(ADMIN).toContain("schema foundation only");
    expect(ADMIN).toContain("Authentication and tenant isolation are not fully implemented");
    expect(ADMIN).toMatch(/Do not upload real bank\s+data/);
  });

  it("lists every model the foundation phase adds + their status", () => {
    expect(ADMIN).toContain("User model");
    expect(ADMIN).toContain("Tenant / Organization model");
    expect(ADMIN).toContain("Membership model");
    expect(ADMIN).toContain("Business model");
    expect(ADMIN).toContain("Route protection");
    expect(ADMIN).toContain("Production auth");
    expect(ADMIN).toContain("Full tenant enforcement");
    // Each of those is marked as "not implemented" / "not complete" via
    // explicit string literals in the component.
    expect(ADMIN).toContain("not implemented");
    expect(ADMIN).toContain("not complete");
  });

  it("does not ship a fake login form", () => {
    // No password / email input that would imply a real auth flow.
    expect(ADMIN).not.toContain('type="password"');
    expect(ADMIN).not.toContain('type="email"');
    expect(ADMIN).not.toMatch(/<form[\s>]/);
    // The placeholder is honest about why login is missing.
    expect(ADMIN).toContain("Login UI is intentionally not implemented");
  });

  it("links to the relevant docs (not mailto, not tel)", () => {
    expect(ADMIN).toContain("SECURITY_AND_PRODUCTION_READINESS.md");
    expect(ADMIN).toContain("AUTH_TENANT_FOUNDATION.md");
    expect(ADMIN).toContain("ACCOUNTING_DOMAIN_BOUNDARY.md");
    expect(ADMIN).not.toMatch(/href="mailto:/);
    expect(ADMIN).not.toMatch(/href="tel:/);
  });

  it("calls the foundation status endpoint to source the snapshot", () => {
    expect(ADMIN).toContain("getFoundationStatus");
  });
});

const MAPPING = readPage("mapping/page.tsx");

describe("category mapping editable wizard", () => {
  it("renders the public-demo warning and active-business context", () => {
    expect(MAPPING).toContain("mapping-warning");
    expect(MAPPING).toMatch(/Public demo — these settings are not protected/);
    expect(MAPPING).toContain("Active business");
    expect(MAPPING).toMatch(/Do not upload real bank/);
    expect(MAPPING).toMatch(/not\s+a true accounting ledger/);
  });

  it("uses the new editable API surface", () => {
    expect(MAPPING).toContain("getMappingProfile");
    expect(MAPPING).toContain("updateMappingEntry");
    expect(MAPPING).toContain("resetMappingProfile");
  });

  it("renders the category dropdown + block-fallback + save controls", () => {
    expect(MAPPING).toMatch(/<select[\s\S]*?id=\{`code-/);
    expect(MAPPING).toMatch(/<input[^>]*type="checkbox"/);
    expect(MAPPING).toContain('data-testid={`block-${e.intent}`}');
    expect(MAPPING).toContain('data-testid={`save-${e.intent}`}');
    expect(MAPPING).toContain('data-testid="mapping-reset"');
  });

  it("shows mapped / unmapped / fallback-blocked badges", () => {
    expect(MAPPING).toContain('"mapped"');
    expect(MAPPING).toContain('"unmapped"');
    expect(MAPPING).toContain('"fallback_blocked"');
    expect(MAPPING).toContain("fallback blocked");
  });

  it("has 44px tap targets on the editable controls", () => {
    // The select, the save button, and the reset button each declare min-h-[44px].
    const occurrences = MAPPING.match(/min-h-\[44px\]/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it("does not claim production tenant isolation or real-bank safety", () => {
    expect(MAPPING.toLowerCase()).not.toContain("tenant-isolated");
    expect(MAPPING.toLowerCase()).not.toContain("production-secure");
    expect(MAPPING.toLowerCase()).not.toContain("safe for real bank");
    // No tel: / mailto: links sneak in.
    expect(MAPPING).not.toMatch(/href="mailto:/);
    expect(MAPPING).not.toMatch(/href="tel:/);
  });
});

const DEMO_UNAVAILABLE_COMPONENT = readFileSync(
  join(SRC, "components", "app", "DemoUnavailablePanel.tsx"),
  "utf-8",
);

describe("demo unavailable fallback (Phase 7)", () => {
  it("DemoUnavailablePanel renders polished copy, not raw backend errors", () => {
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("DemoUnavailablePanel");
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("Demo dependencies temporarily unavailable");
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("partially unavailable");
    // Three CTAs the spec required.
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("Try again");
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("Open cleanup checklist");
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("Open technical story");
    // Public-demo warning is preserved.
    expect(DEMO_UNAVAILABLE_COMPONENT).toMatch(/Do not upload real\s+bank\s+data/);
    // Never the primary "Is the backend running?" line.
    expect(DEMO_UNAVAILABLE_COMPONENT).not.toContain("Is the backend running");
    // 44px tap targets on the action buttons.
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("min-h-[44px]");
  });

  it("/app integrates the polished panel and probes /demo/ready", () => {
    expect(APP_DASH).toContain("DemoUnavailablePanel");
    expect(APP_DASH).toContain("getDemoReady");
    // /app does not lead with a raw backend message during outage.
    expect(APP_DASH).not.toContain("Is the backend running?");
  });

  it("/demo integrates the polished panel and probes /demo/ready", () => {
    expect(DEMO).toContain("DemoUnavailablePanel");
    expect(DEMO).toContain("getDemoReady");
    expect(DEMO).not.toContain("Is the backend running?");
  });

  it("health / readiness copy doesn't imply /health alone proves demo readiness", () => {
    // The unavailable panel explicitly distinguishes the API process
    // from the demo database checks.
    expect(DEMO_UNAVAILABLE_COMPONENT).toContain("The API process is up");
    expect(DEMO_UNAVAILABLE_COMPONENT.toLowerCase()).toContain("demo database checks");
  });

  it("does not claim production-ready / real-bank-data-safe / true ledger", () => {
    for (const [name, src] of [
      ["DemoUnavailablePanel", DEMO_UNAVAILABLE_COMPONENT],
      ["/app", APP_DASH],
      ["/demo", DEMO],
    ] as const) {
      expect(
        src.toLowerCase().includes("production ready"),
        `${name} should not claim production-ready`,
      ).toBe(false);
      expect(
        src.toLowerCase().includes("safe for real bank"),
        `${name} should not claim real-bank-data safety`,
      ).toBe(false);
      // "true accounting ledger" claim
      expect(
        /true accounting ledger/i.test(src) && !/not a true accounting ledger/i.test(src),
        `${name} should not claim true accounting ledger`,
      ).toBe(false);
    }
  });
});

const START = readPage("start/page.tsx");
const APP_SHELL = readFileSync(
  join(SRC, "components", "app", "AppShell.tsx"),
  "utf-8",
);
const STATIC_HANDOFF = readFileSync(
  join(SRC, "components", "app", "StaticHandoffSamplePreview.tsx"),
  "utf-8",
);

describe("owner /start page", () => {
  it("renders the five-step owner workflow with stable testid", () => {
    expect(START).toContain('data-testid="start-steps"');
    // The data-testid is built with a template literal; the literal
    // string "start-step-" appears once and each step number resolves
    // at render time from the STEPS array.
    expect(START).toContain("`start-step-${step.number}`");
    for (const num of ["01", "02", "03", "04", "05"]) {
      expect(START).toContain(`number: "${num}"`);
    }
    // The five step titles are present.
    expect(START).toContain("Use the sample CSV or synthetic test data");
    expect(START).toContain("Import and map CSV columns");
    expect(START).toContain("Confirm category mappings");
    expect(START).toContain("Answer plain-English owner questions");
    expect(START).toContain("Export the accountant handoff");
  });

  it("links each step at the right workflow surface", () => {
    // Step CTA paths live in object literals — assert the literal paths.
    expect(START).toContain('href: "/demo"');
    expect(START).toContain('href: "/transactions/import"');
    expect(START).toContain('href: "/mapping"');
    expect(START).toContain('href: "/questions"');
    expect(START).toContain('href: "/handoff"');
  });

  it("ships the workflow FAQ on /start", () => {
    expect(START).toContain('data-testid="start-faq"');
    expect(START).toContain("Is this a product I can buy?");
    expect(START).toContain("Can I upload real bank data?");
    expect(START).toContain("Does it connect to my bank?");
    expect(START).toContain("Does it use QuickBooks, Xero, or Plaid?");
    expect(START).toContain("ambiguous vendors like Amazon or Costco");
    expect(START).toContain("Can my accountant log in?");
    expect(START).toContain('What does \\"verified\\" mean?');
    expect(START).toContain("Where does the data live");
    expect(START).toContain("What would production require?");
  });

  it("repeats the public-demo warning above the steps", () => {
    expect(START).toContain('data-testid="start-public-demo-warning"');
    expect(START).toMatch(/Do not upload real bank\s+data/);
  });

  it("includes the hiring-manager portfolio CTA without email/phone/resume", () => {
    expect(START).toContain("portfolio prototype");
    expect(START).toContain("View technical story");
    expect(START).toContain("View GitHub repo");
    expect(START).not.toMatch(/href="mailto:/);
    expect(START).not.toMatch(/href="tel:/);
    expect(START.toLowerCase()).not.toContain("resume.pdf");
    expect(START.toLowerCase()).not.toContain("request a demo");
    // The FAQ legitimately mentions "no pricing" — what we care about is
    // that there's no positive pricing claim (`$N / month`, `free trial`).
    expect(START).not.toMatch(/\$\s*\d+\s*\/?\s*(mo|month|yr|year)/i);
    expect(START.toLowerCase()).not.toContain("free trial");
  });

  it("does not overclaim production safety or accounting correctness", () => {
    expect(START.toLowerCase()).not.toContain("production saas");
    expect(START.toLowerCase()).not.toContain("safe for real bank");
    expect(START.toLowerCase()).not.toMatch(/100\s*%\s*ai/);
    // Not asserting the page mentions "true accounting ledger" — it
    // doesn't have to. We just guard against an unnegated claim.
    if (/true accounting ledger/i.test(START)) {
      expect(START).toMatch(/not a true accounting ledger/i);
    }
  });
});

describe("owner-grouped navigation", () => {
  it("renders the owner-path nav first and the technical nav second", () => {
    expect(APP_SHELL).toContain('data-testid="owner-nav"');
    expect(APP_SHELL).toContain('data-testid="advanced-nav"');
    // Owner-nav order is the five-step workflow.
    expect(APP_SHELL).toContain('{ href: "/start", label: "Start" }');
    expect(APP_SHELL).toContain('{ href: "/transactions/import", label: "Import" }');
    expect(APP_SHELL).toContain('{ href: "/cleanup", label: "Cleanup" }');
    expect(APP_SHELL).toContain('{ href: "/questions", label: "Questions" }');
    expect(APP_SHELL).toContain('{ href: "/handoff", label: "Handoff" }');
  });

  it("technical nav still exposes every advanced page", () => {
    for (const href of [
      "/demo",
      "/app",
      "/transactions",
      "/review",
      "/mapping",
      "/corrections",
      "/rules",
      "/ledger",
      "/evals",
    ]) {
      expect(APP_SHELL).toContain(`href: "${href}"`);
    }
  });

  it("labels the two nav groups visibly", () => {
    expect(APP_SHELL).toContain("Owner path");
    expect(APP_SHELL).toContain("Technical");
  });
});

describe("homepage FAQ + portfolio CTA", () => {
  it("renders the workflow FAQ block", () => {
    expect(HOMEPAGE).toContain('data-testid="homepage-faq"');
    expect(HOMEPAGE).toContain("Is this a product I can buy?");
    expect(HOMEPAGE).toContain("Can I upload real bank data?");
    expect(HOMEPAGE).toContain("Does it connect to my bank?");
  });

  it("renders the portfolio CTA with technical-story / GitHub / LinkedIn", () => {
    expect(HOMEPAGE).toContain('data-testid="homepage-portfolio-cta"');
    expect(HOMEPAGE).toContain("portfolio prototype");
    expect(HOMEPAGE).toContain("View technical story");
    expect(HOMEPAGE).toContain("View GitHub");
    expect(HOMEPAGE).toContain("Connect on LinkedIn");
  });

  it("does not add commercial conversion (email/phone/resume/pricing/request-demo)", () => {
    // No email / phone / resume / mailto / tel.
    expect(HOMEPAGE).not.toMatch(/href="mailto:/);
    expect(HOMEPAGE).not.toMatch(/href="tel:/);
    expect(HOMEPAGE.toLowerCase()).not.toMatch(/resume\.pdf|cv\.pdf|"\/resume"|"\/cv"/);
    expect(HOMEPAGE.toLowerCase()).not.toContain("request a demo");
    expect(HOMEPAGE.toLowerCase()).not.toContain("contact form");
    // No pricing copy.
    expect(HOMEPAGE).not.toMatch(/\$\s*\d+\s*\/?\s*(mo|month|yr|year)/i);
    expect(HOMEPAGE.toLowerCase()).not.toContain("free trial");
  });
});

describe("/handoff static fallback (Phase 2)", () => {
  it("StaticHandoffSamplePreview renders polished sample data + retry", () => {
    expect(STATIC_HANDOFF).toContain('data-testid="static-handoff-sample"');
    expect(STATIC_HANDOFF).toContain("Static sample preview");
    expect(STATIC_HANDOFF).toContain("live backend temporarily unavailable");
    expect(STATIC_HANDOFF).toContain('data-testid="static-handoff-retry"');
    // Reviewed categorization, owner answers, accountant follow-up sections.
    expect(STATIC_HANDOFF).toContain("Reviewed categorization summary");
    expect(STATIC_HANDOFF).toContain("Questions answered by owner");
    expect(STATIC_HANDOFF).toContain("Owner flagged for accountant review");
    expect(STATIC_HANDOFF).toContain("Accountant CSV exports");
    // Not-tax-advice disclaimer survives in the fallback too.
    expect(STATIC_HANDOFF).toContain("not tax advice");
    // The Granite State fictional sample is the source of the rows.
    expect(STATIC_HANDOFF).toContain("Granite State Auto Repair");
  });

  it("/handoff renders the static fallback when the backend fails", () => {
    expect(HANDOFF).toContain("StaticHandoffSamplePreview");
    // Replaces the old ErrorState on the error branch.
    expect(HANDOFF).toMatch(
      /state\.error !== null[\s\S]*?<StaticHandoffSamplePreview/,
    );
  });

  it("static fallback does not claim live data or production accuracy", () => {
    expect(STATIC_HANDOFF.toLowerCase()).not.toContain("real bank");
    expect(STATIC_HANDOFF.toLowerCase()).not.toMatch(/100\s*%\s*ai/);
    expect(STATIC_HANDOFF.toLowerCase()).not.toMatch(/production[\s-]?ready/);
    expect(STATIC_HANDOFF).not.toMatch(/href="mailto:/);
    expect(STATIC_HANDOFF).not.toMatch(/href="tel:/);
  });
});

describe("AppShell readiness truth (Workstream A)", () => {
  it("does not ship the misleading 'API: ok' wording any more", () => {
    expect(APP_SHELL).not.toContain('"API: ok"');
    // The old single-source HealthDot is replaced.
    expect(APP_SHELL).not.toMatch(/HealthDot/);
    expect(APP_SHELL).not.toMatch(/useBackendHealth\(/);
  });

  it("renders the five readiness states the spec calls for", () => {
    for (const state of [
      "checking",
      "process_ok_demo_ready",
      "process_ok_demo_degraded",
      "process_ok_demo_unavailable",
      "process_unreachable",
    ]) {
      expect(APP_SHELL).toContain(`"${state}"`);
    }
  });

  it("calls /health for liveness and /demo/ready for demo readiness", () => {
    expect(APP_SHELL).toContain("getHealth()");
    expect(APP_SHELL).toContain("getDemoReady()");
  });

  it("renders the labelled status indicator with both signals", () => {
    expect(APP_SHELL).toContain('data-testid="appshell-readiness"');
    expect(APP_SHELL).toContain('"Process: ok"');
    expect(APP_SHELL).toContain('"Demo: ready"');
    expect(APP_SHELL).toContain('"Demo: degraded"');
    expect(APP_SHELL).toContain('"Demo: unavailable"');
    expect(APP_SHELL).toContain('"Backend: unreachable"');
    // Accessible tooltip distinguishing the two concerns.
    expect(APP_SHELL).toContain(
      "Process liveness is separate from demo database readiness",
    );
  });

  it("does not overclaim full demo readiness from /health alone", () => {
    // The lowercase corpus has no remaining 'api: ok' badge text.
    expect(APP_SHELL.toLowerCase()).not.toContain("api: ok");
    // No accidental claim that the demo is production-ready / safe.
    expect(APP_SHELL.toLowerCase()).not.toContain("production ready");
    expect(APP_SHELL.toLowerCase()).not.toContain("safe for real bank");
    expect(APP_SHELL.toLowerCase()).not.toMatch(/100\s*%\s*ai/);
    expect(APP_SHELL).not.toMatch(/href="mailto:/);
    expect(APP_SHELL).not.toMatch(/href="tel:/);
  });
});

describe("import wizard saved profile UI (Workstream B)", () => {
  it("renders the profile selector with the spec test-id", () => {
    expect(IMPORT).toContain('data-testid="saved-import-profiles"');
    expect(IMPORT).toContain('data-testid="import-profile-select"');
    expect(IMPORT).toContain("No saved profile — detect columns");
  });

  it("calls the saved-profile API surface", () => {
    expect(IMPORT).toContain("listImportProfiles");
    expect(IMPORT).toContain("validateImportProfileHeaders");
    expect(IMPORT).toContain("createImportProfile");
  });

  it("renders the save-current-mapping form when a CSV is parsed", () => {
    expect(IMPORT).toContain('data-testid="save-profile-name"');
    expect(IMPORT).toContain('data-testid="save-profile-button"');
    expect(IMPORT).toContain("Save mapping as profile");
    // The save button blocks until required mappings are present.
    expect(IMPORT).toContain("missingRequired.length > 0");
  });

  it("explains that profiles save headers only — no rows", () => {
    expect(IMPORT).toMatch(/Profiles\s+save column names and mapping choices only/);
    expect(IMPORT).toContain("no rows are saved");
  });

  it("surfaces missing-header and extra-header warnings", () => {
    expect(IMPORT).toContain('data-testid="profile-validation"');
    expect(IMPORT).toContain("missing the saved profile");
    expect(IMPORT).toContain("Extra columns are okay");
    expect(IMPORT).toContain("bank may have changed the export format");
  });

  it("keeps the public-demo warning and demo disclaimers intact", () => {
    expect(IMPORT).toContain("Public demo — do not upload real bank data");
    expect(IMPORT.toLowerCase()).not.toMatch(/safe for real bank/);
    expect(IMPORT.toLowerCase()).not.toMatch(/100\s*%\s*ai/);
    expect(IMPORT).not.toMatch(/href="mailto:/);
    expect(IMPORT).not.toMatch(/href="tel:/);
  });
});

describe("mapping recategorization preview (Workstream C)", () => {
  it("renders a per-intent preview-impact section with the spec testid", () => {
    expect(MAPPING).toContain("data-testid={`preview-impact-${intent}`}");
    expect(MAPPING).toContain("data-testid={`preview-impact-button-${intent}`}");
  });

  it("calls the read-only preview endpoint", () => {
    expect(MAPPING).toContain("previewMappingChange");
  });

  it("labels the section as preview-only with no apply", () => {
    expect(MAPPING).toContain(
      "Preview impact — apply flow not implemented yet",
    );
    expect(MAPPING).toContain("Nothing has been changed yet");
    expect(MAPPING).toContain(
      "Human-corrected and accountant-follow-up rows are protected",
    );
    expect(MAPPING).toContain(
      "updating current rows requires explicit review",
    );
  });

  it("renders eligible / protected badges on the row list", () => {
    expect(MAPPING).toContain('"eligible"');
    expect(MAPPING).toContain('"protected"');
    expect(MAPPING).toContain("Affected");
    expect(MAPPING).toContain("Would route to review");
    expect(MAPPING).toContain("Protected");
  });

  it("does not introduce a silent apply CTA", () => {
    // No button literally labelled "Apply" appears in the preview UI.
    expect(MAPPING).not.toMatch(/>\s*Apply\s*</);
    expect(MAPPING).not.toContain("Apply selected");
    expect(MAPPING).not.toContain("Recategorize all");
  });

  it("does not overclaim production safety or accounting correctness", () => {
    expect(MAPPING.toLowerCase()).not.toContain("production saas");
    expect(MAPPING.toLowerCase()).not.toContain("safe for real bank");
    expect(MAPPING.toLowerCase()).not.toMatch(/100\s*%\s*ai/);
    expect(MAPPING).not.toMatch(/href="mailto:/);
    expect(MAPPING).not.toMatch(/href="tel:/);
  });
});
