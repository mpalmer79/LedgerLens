/**
 * Contract tests for the generated walkthrough.
 *
 * The animation itself is CSS-driven (no JS state), so these tests focus
 * on what's *in* the rendered DOM — every scene's headline, the explicit
 * "100% verified finalized demo ledger" framing, and the absence of any
 * "100% AI accuracy" / "100% accurate AI" phrasing. These are the
 * honesty guarantees the homepage and `/walkthrough` route depend on.
 *
 * The story arc tested here is the six-step cleanup → handoff narrative
 * that PR #38 introduced (see docs/WALKTHROUGH_HANDOFF_RESCRIPT_AUDIT.md).
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { GeneratedWalkthrough } from "./GeneratedWalkthrough";

const html = renderToStaticMarkup(<GeneratedWalkthrough />);

describe("GeneratedWalkthrough — content", () => {
  it("renders the LedgerLens wordmark and the 30-second-walkthrough badge", () => {
    expect(html).toContain("LedgerLens");
    expect(html).toContain("30-second walkthrough");
  });

  it("renders all six new scene titles in the cleanup → handoff arc", () => {
    expect(html).toContain("Monthly bookkeeping cleanup"); // scene 1
    expect(html).toContain("Obvious vendors handled first"); // scene 2
    expect(html).toContain("Uncertain rows become owner questions"); // scene 3
    expect(html).toContain("Answers create accountant context"); // scene 4
    expect(html).toContain("Verified rows stay separated from unresolved items"); // scene 5
    expect(html).toContain("Export the accountant handoff package"); // scene 6
  });

  it("renders scene step labels", () => {
    expect(html).toContain("Step 1 of 6");
    expect(html).toContain("Step 6 of 6");
  });

  it("renders the workflow-trust phrasing on the final scene", () => {
    expect(html).toContain("100%");
    expect(html).toContain("verified finalized demo ledger");
    expect(html).toContain("workflow-level trust metric");
    expect(html).toContain("0 uncertain rows silently finalized");
  });

  it("does not claim raw model accuracy", () => {
    const lower = html.toLowerCase();
    expect(lower).not.toMatch(/100\s*%\s*ai\b/);
    expect(lower).not.toMatch(/100\s*%\s*accurate\s+ai/);
    expect(lower).not.toMatch(/raw\s+model\s+accuracy\s+of\s+100/);
  });

  it("renders an owner question with plain-English choices", () => {
    expect(html).toContain("What was this ACH transfer for?");
    expect(html).toContain("Vendor payment");
    expect(html).toContain("Owner draw");
    expect(html).toContain("Office supplies");
    expect(html).toContain("Needs accountant review");
    expect(html).toContain("Not sure");
  });

  it("renders owner-answer review notes routed at the handoff", () => {
    expect(html).toContain("ACH TRANSFER VENDOR REF 99812");
    expect(html).toContain("AMAZON MARKETPLACE");
  });

  it("renders the ready-vs-needs-review split", () => {
    expect(html).toContain("Ready for accountant");
    expect(html).toContain("Needs review");
    expect(html).toContain("Workflow-level verification, not raw model accuracy.");
  });

  it("renders the handoff package preview file label and section list", () => {
    expect(html).toContain("handoff-2026-03.md");
    expect(html).toContain("Owner answers this month");
    expect(html).toContain("Corrections learned");
  });
});
