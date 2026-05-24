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
    // accountantFollowUp + suggestedResolution are surfaced.
    expect(QUESTIONS).toContain("accountantFollowUp");
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
    expect(HANDOFF).toContain("Could not download the ledger CSV");
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
