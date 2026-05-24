/**
 * Contract tests for the generated walkthrough.
 *
 * The animation itself is CSS-driven (no JS state), so these tests focus
 * on what's *in* the rendered DOM — every scene's headline, the explicit
 * "100% verified finalized demo ledger" framing, and the absence of any
 * "100% AI accuracy" / "100% accurate AI" phrasing. These are the
 * honesty guarantees the homepage and `/walkthrough` route depend on.
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

  it("renders all six scene titles", () => {
    expect(html).toContain("LedgerLens"); // scene 1 title
    expect(html).toContain("Messy bank activity"); // scene 2
    expect(html).toContain("Layered decisioning"); // scene 3
    expect(html).toContain("Review is the safety layer"); // scene 4
    expect(html).toContain("Corrections become memory"); // scene 5
    expect(html).toContain("Verified ledger export"); // scene 6
  });

  it("renders the workflow-trust phrasing on the final scene", () => {
    expect(html).toContain("100%");
    expect(html).toContain("verified finalized demo ledger");
    expect(html).toContain("workflow-level trust metric");
  });

  it("does not claim raw model accuracy", () => {
    const lower = html.toLowerCase();
    expect(lower).not.toMatch(/100\s*%\s*ai\b/);
    expect(lower).not.toMatch(/100\s*%\s*accurate\s+ai/);
    expect(lower).not.toMatch(/raw\s+model\s+accuracy\s+of\s+100/);
  });

  it("includes the layered-pipeline labels", () => {
    expect(html).toContain("Memory");
    expect(html).toContain("Rules");
    expect(html).toContain("Review");
  });

  it("includes the review-routing example transaction", () => {
    expect(html).toContain("ACH TRANSFER VENDOR REF 99812");
    expect(html).toContain("Needs Review");
  });

  it("includes the correction-memory mapping example", () => {
    expect(html).toContain("UNKNOWN VENDOR");
    expect(html).toContain("Repairs &amp; Maintenance");
  });
});
